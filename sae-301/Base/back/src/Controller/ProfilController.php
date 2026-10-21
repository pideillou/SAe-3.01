<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CommandeModel;
use App\Model\UtilisateurModel;

/**
 * Espace personnel du client (SUI-b) : son profil, ses informations modifiables
 * et un aperçu de ses commandes récentes. Réservé aux clients connectés.
 *
 * Changer de mot de passe exige le mot de passe actuel.
 */
final class ProfilController
{
    /** Longueur maximale du nom (colonne VARCHAR(80)). */
    private const NOM_MAX = 80;

    /** Nombre de commandes récentes montrées dans l'aperçu. */
    private const COMMANDES_RECENTES = 3;

    private UtilisateurModel $utilisateurs;
    private CommandeModel $commandes;

    public function __construct(UtilisateurModel $utilisateurs, CommandeModel $commandes)
    {
        $this->utilisateurs = $utilisateurs;
        $this->commandes    = $commandes;
    }

    /**
     * GET /api/profil : { profil: { nom, email, creeLe }, nombreCommandes,
     * commandesRecentes: [ … ] } (commandes au format de /api/commandes).
     */
    public function voir(): void
    {
        $id     = $this->utilisateurConnecte();
        $profil = $this->utilisateurs->trouverParId($id);

        if ($profil === null) {
            // Le compte a disparu alors que la session existe encore.
            $this->fermerSession();
            Response::erreur('Connectez-vous pour accéder à votre espace personnel.', 401);
        }

        $recentes = $this->commandes->listerPourClient($id, null, null, null, self::COMMANDES_RECENTES, 0);

        Response::json([
            'profil'            => self::formaterProfil($profil),
            'nombreCommandes'   => $recentes['total'],
            'commandesRecentes' => array_map([CommandeController::class, 'resumer'], $recentes['commandes']),
        ]);
    }

    /**
     * POST /api/profil : { nom, email }
     * Un nom vide l'efface. 409 si l'adresse est celle d'un autre compte.
     */
    public function modifier(Request $requete): void
    {
        $id    = $this->utilisateurConnecte();
        $corps = $requete->corps();
        $nom   = is_string($corps['nom'] ?? null) ? trim($corps['nom']) : '';
        $email = AuthController::normaliserEmail($corps['email'] ?? '');

        $champs = array_filter([
            'nom'   => mb_strlen($nom) > self::NOM_MAX ? 'Le nom ne doit pas dépasser ' . self::NOM_MAX . ' caractères.' : null,
            'email' => AuthController::erreurEmail($email),
        ]);

        if ($champs !== []) {
            self::refuser($champs);
        }

        if (!$this->utilisateurs->modifierProfil($id, $nom === '' ? null : $nom, $email)) {
            Response::json([
                'erreur' => 'Un compte existe déjà avec cette adresse e-mail.',
                'champs' => ['email' => 'Un compte existe déjà avec cette adresse e-mail.'],
            ], 409);
        }

        $_SESSION['email'] = $email;

        Response::json(['profil' => self::formaterProfil($this->utilisateurs->trouverParId($id))]);
    }

    /**
     * POST /api/profil/mot-de-passe : { actuel, nouveau, confirmation }
     * Le mot de passe actuel est vérifié côté serveur avant tout changement.
     */
    public function changerMotDePasse(Request $requete): void
    {
        $id           = $this->utilisateurConnecte();
        $corps        = $requete->corps();
        $actuel       = is_string($corps['actuel'] ?? null) ? $corps['actuel'] : '';
        $nouveau      = is_string($corps['nouveau'] ?? null) ? $corps['nouveau'] : '';
        $confirmation = is_string($corps['confirmation'] ?? null) ? $corps['confirmation'] : '';

        $champs = array_filter([
            'actuel'  => $actuel === '' ? 'Saisissez votre mot de passe actuel.' : null,
            'nouveau' => AuthController::erreurMotDePasse($nouveau),
        ]);

        if (!isset($champs['nouveau']) && $nouveau !== $confirmation) {
            $champs['confirmation'] = 'Les deux mots de passe ne sont pas identiques.';
        }

        if ($champs !== []) {
            self::refuser($champs);
        }

        $empreinte = $this->utilisateurs->trouverEmpreinte($id);

        if ($empreinte === null || !password_verify($actuel, $empreinte)) {
            self::refuser(['actuel' => 'Le mot de passe actuel est incorrect.']);
        }

        if ($nouveau === $actuel) {
            self::refuser(['nouveau' => 'Le nouveau mot de passe doit être différent de l\'actuel.']);
        }

        $this->utilisateurs->changerMotDePasse($id, password_hash($nouveau, PASSWORD_BCRYPT));

        // Un mot de passe vient d'être prouvé puis changé : nouvel identifiant de
        // session, l'ancien est détruit.
        session_regenerate_id(true);

        Response::json(['ok' => true]);
    }

    /**
     * L'identifiant du client connecté, ou une réponse 401 (vérifié ici, côté
     * serveur).
     */
    private function utilisateurConnecte(): int
    {
        if (!isset($_SESSION['utilisateur_id'])) {
            Response::erreur('Connectez-vous pour accéder à votre espace personnel.', 401);
        }

        return (int) $_SESSION['utilisateur_id'];
    }

    private function fermerSession(): void
    {
        $_SESSION = [];
        session_destroy();
    }

    private static function formaterProfil(array $profil): array
    {
        return [
            'nom'    => $profil['nom'] ?? '',
            'email'  => $profil['email'],
            'creeLe' => $profil['cree_le'],
        ];
    }

    /**
     * Réponse 422 : un message par champ fautif. Ne rend pas la main.
     *
     * @param array<string, string> $champs
     */
    private static function refuser(array $champs): void
    {
        Response::json(['erreur' => 'Le formulaire contient des erreurs.', 'champs' => $champs], 422);
    }
}
