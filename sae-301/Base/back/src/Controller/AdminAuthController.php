<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\AdministrateurModel;
use App\Model\TentativeConnexionModel;

/**
 * Connexion et déconnexion des administrateurs.
 *
 * Séparée de celle des clients (AuthController) : autre table, autre clé de
 * session (admin_id). Être client connecté ne donne aucun droit
 * d'administration, et il n'existe aucune inscription d'administrateur.
 */
final class AdminAuthController
{
    private AdministrateurModel $administrateurs;
    private TentativeConnexionModel $tentatives;

    public function __construct(AdministrateurModel $administrateurs, TentativeConnexionModel $tentatives)
    {
        $this->administrateurs = $administrateurs;
        $this->tentatives      = $tentatives;
    }

    /**
     * POST /api/admin/login : { email, mdp }
     */
    public function login(Request $requete): void
    {
        $corps = $requete->corps();
        $email = is_string($corps['email'] ?? null) ? mb_strtolower(trim($corps['email'])) : '';
        $mdp   = is_string($corps['mdp'] ?? null) ? $corps['mdp'] : '';

        $champs = array_filter([
            'email' => $email === '' ? 'Saisissez votre adresse e-mail.' : null,
            'mdp'   => $mdp === '' ? 'Saisissez votre mot de passe.' : null,
        ]);

        if ($champs !== []) {
            Response::json(['erreur' => 'Le formulaire contient des erreurs.', 'champs' => $champs], 422);
        }

        // Anti force brute : trop d'échecs pour cette adresse depuis cette IP, et la
        // connexion est refusée un moment, même avec le bon mot de passe.
        $cle = TentativeConnexionModel::cle('admin', $email, $_SERVER['REMOTE_ADDR'] ?? '');

        if ($this->tentatives->bloquee($cle)) {
            Response::erreur('Trop de tentatives de connexion. Réessayez dans 15 minutes.', 429);
        }

        $compte = $this->administrateurs->trouverParEmail($email);

        // Même précaution que pour les clients : le mot de passe est vérifié
        // même sans compte, et le message ne dit pas lequel des deux est faux.
        $empreinte = $compte['mot_de_passe'] ?? password_hash('empreinte-factice', PASSWORD_BCRYPT);
        $valide    = password_verify($mdp, $empreinte);

        if ($compte === null || !$valide) {
            $this->tentatives->enregistrerEchec($cle);
            Response::erreur('Adresse e-mail ou mot de passe incorrect.', 401);
        }

        $this->tentatives->oublier($cle);

        // Identifiant de session neuf à la connexion (voir securite.md).
        session_regenerate_id(true);

        $_SESSION['admin_id']    = (int) $compte['id'];
        $_SESSION['admin_email'] = $compte['email'];

        Response::json(['connecte' => true, 'email' => $compte['email']]);
    }

    /**
     * GET /api/admin/moi : l'état de la session administrateur (toujours 200).
     */
    public function moi(): void
    {
        if (!isset($_SESSION['admin_id'])) {
            Response::json(['connecte' => false]);
        }

        Response::json(['connecte' => true, 'email' => $_SESSION['admin_email']]);
    }

    /**
     * POST /api/admin/logout : détruit la session (la session client aussi,
     * puisqu'il n'y en a qu'une par navigateur).
     */
    public function logout(): void
    {
        $_SESSION = [];

        setcookie(session_name(), '', [
            'expires' => time() - 3600,
            'path'    => session_get_cookie_params()['path'],
        ]);

        session_destroy();

        Response::json(['connecte' => false]);
    }
}
