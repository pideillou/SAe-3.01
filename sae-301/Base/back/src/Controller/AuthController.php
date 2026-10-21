<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\TentativeConnexionModel;
use App\Model\UtilisateurModel;

/**
 * Inscription, connexion et déconnexion des clients (CMD-c).
 *
 * L'identité de l'utilisateur connecté est rangée en session, côté serveur. Le
 * client ne détient que l'identifiant de session, dans le cookie PHPSESSID.
 * Les mots de passe ne sont stockés que sous forme d'empreinte bcrypt.
 *
 * Les administrateurs ne passent pas par ici : leur authentification est
 * séparée (voir securite.md).
 */
final class AuthController
{
    /** Longueur minimale d'un mot de passe, en caractères. */
    private const MDP_MIN = 8;

    /** bcrypt ignore tout ce qui dépasse 72 octets : on refuse plutôt que de tronquer. */
    private const MDP_MAX_OCTETS = 72;

    /** Longueur maximale d'un e-mail (colonne VARCHAR(190)). */
    private const EMAIL_MAX = 190;

    private UtilisateurModel $utilisateurs;
    private TentativeConnexionModel $tentatives;

    public function __construct(UtilisateurModel $utilisateurs, TentativeConnexionModel $tentatives)
    {
        $this->utilisateurs = $utilisateurs;
        $this->tentatives   = $tentatives;
    }

    /**
     * POST /api/inscription : { email, mdp, confirmation }
     * Crée le compte et connecte aussitôt le nouvel utilisateur.
     */
    public function inscription(Request $requete): void
    {
        $corps        = $requete->corps();
        $email        = self::normaliserEmail($corps['email'] ?? '');
        $mdp          = is_string($corps['mdp'] ?? null) ? $corps['mdp'] : '';
        $confirmation = is_string($corps['confirmation'] ?? null) ? $corps['confirmation'] : '';

        // Toutes les entrées sont revalidées ici : celles du front ne font pas foi.
        $champs = array_filter([
            'email' => self::erreurEmail($email),
            'mdp'   => self::erreurMotDePasse($mdp),
        ]);

        if (!isset($champs['mdp']) && $mdp !== $confirmation) {
            $champs['confirmation'] = 'Les deux mots de passe ne sont pas identiques.';
        }

        if ($champs !== []) {
            self::refuser($champs);
        }

        $id = $this->utilisateurs->creer($email, password_hash($mdp, PASSWORD_BCRYPT));

        if ($id === null) {
            Response::json([
                'erreur' => 'Un compte existe déjà avec cette adresse e-mail.',
                'champs' => ['email' => 'Un compte existe déjà avec cette adresse e-mail.'],
            ], 409);
        }

        $this->ouvrirSession($id, $email);

        Response::json(['connecte' => true, 'email' => $email], 201);
    }

    /**
     * POST /api/login : { email, mdp }
     */
    public function login(Request $requete): void
    {
        $corps = $requete->corps();
        $email = self::normaliserEmail($corps['email'] ?? '');
        $mdp   = is_string($corps['mdp'] ?? null) ? $corps['mdp'] : '';

        $champs = array_filter([
            'email' => $email === '' ? 'Saisissez votre adresse e-mail.' : null,
            'mdp'   => $mdp === '' ? 'Saisissez votre mot de passe.' : null,
        ]);

        if ($champs !== []) {
            self::refuser($champs);
        }

        // Anti force brute : après trop d'échecs pour cette adresse depuis cette
        // IP, la connexion est refusée un moment, même avec le bon mot de passe.
        $cle = TentativeConnexionModel::cle('client', $email, $_SERVER['REMOTE_ADDR'] ?? '');

        if ($this->tentatives->bloquee($cle)) {
            Response::erreur('Trop de tentatives de connexion. Réessayez dans 15 minutes.', 429);
        }

        $compte = $this->utilisateurs->trouverParEmail($email);

        // Le mot de passe est toujours vérifié, même quand le compte n'existe
        // pas (contre une empreinte factice) : le temps de réponse ne révèle pas
        // si l'adresse est inscrite. Le message est le même dans les deux cas.
        $empreinte = $compte['mot_de_passe'] ?? password_hash('empreinte-factice', PASSWORD_BCRYPT);
        $valide    = password_verify($mdp, $empreinte);

        if ($compte === null || !$valide) {
            $this->tentatives->enregistrerEchec($cle);
            Response::erreur('Adresse e-mail ou mot de passe incorrect.', 401);
        }

        $this->tentatives->oublier($cle);
        $this->ouvrirSession((int) $compte['id'], $compte['email']);

        Response::json(['connecte' => true, 'email' => $compte['email']]);
    }

    /**
     * GET /api/moi : l'état de la session. Toujours 200 : « pas connecté » est
     * une réponse normale, pas une erreur.
     */
    public function moi(): void
    {
        if (!isset($_SESSION['utilisateur_id'])) {
            Response::json(['connecte' => false]);
        }

        Response::json(['connecte' => true, 'email' => $_SESSION['email']]);
    }

    public function logout(): void
    {
        $_SESSION = [];                               // vide la copie en mémoire

        // Supprime le cookie, avec le chemin sous lequel il a été posé : celui
        // que index.php a réglé avant session_start().
        setcookie(session_name(), '', [
            'expires' => time() - 3600,
            'path'    => session_get_cookie_params()['path'],
        ]);

        session_destroy();                            // efface le fichier serveur

        Response::json(['connecte' => false]);
    }

    /**
     * L'utilisateur devient authentifié : on lui attribue un identifiant de
     * session neuf, et on détruit l'ancien (true). Aucun identifiant connu
     * avant ce point ne donne plus accès à la session.
     */
    private function ouvrirSession(int $id, string $email): void
    {
        session_regenerate_id(true);

        $_SESSION['utilisateur_id'] = $id;
        $_SESSION['email']          = $email;
    }

    public static function normaliserEmail(mixed $valeur): string
    {
        return is_string($valeur) ? mb_strtolower(trim($valeur)) : '';
    }

    public static function erreurEmail(string $email): ?string
    {
        if ($email === '') {
            return 'Saisissez votre adresse e-mail.';
        }

        if (mb_strlen($email) > self::EMAIL_MAX || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return 'Cette adresse e-mail n\'est pas valide.';
        }

        return null;
    }

    public static function erreurMotDePasse(string $mdp): ?string
    {
        if ($mdp === '') {
            return 'Choisissez un mot de passe.';
        }

        if (mb_strlen($mdp) < self::MDP_MIN) {
            return 'Le mot de passe doit contenir au moins ' . self::MDP_MIN . ' caractères.';
        }

        if (strlen($mdp) > self::MDP_MAX_OCTETS) {
            return 'Le mot de passe est trop long : utilisez moins de caractères.';
        }

        return null;
    }

    /**
     * Réponse 422 : un message par champ fautif, que le front affiche à côté du
     * champ. Ne rend pas la main.
     *
     * @param array<string, string> $champs
     */
    private static function refuser(array $champs): void
    {
        Response::json(['erreur' => 'Le formulaire contient des erreurs.', 'champs' => $champs], 422);
    }
}
