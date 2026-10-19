<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Response;
use App\Model\CommandeModel;

/**
 * Liste des commandes pour le back-office, réservée aux administrateurs.
 */
final class AdminCommandeController
{
    /** Nombre de commandes renvoyées (les plus récentes). */
    private const LIMITE = 100;

    private CommandeModel $commandes;

    public function __construct(CommandeModel $commandes)
    {
        $this->commandes = $commandes;
    }

    /**
     * GET /api/admin/commandes
     */
    public function index(): void
    {
        // Seule une session ouverte par AdminAuthController compte : être client
        // connecté ne suffit pas.
        if (!isset($_SESSION['admin_id'])) {
            Response::erreur('Authentification administrateur requise', 401);
        }

        $commandes = [];

        foreach ($this->commandes->listerRecentes(self::LIMITE) as $ligne) {
            $commandes[] = [
                'numero'   => $ligne['numero'],
                'statut'   => $ligne['statut'],
                'total'    => $ligne['total'],
                'creeLe'   => $ligne['cree_le'],
                'email'    => $ligne['email'],
                'articles' => (int) $ligne['articles'],
            ];
        }

        Response::json(['commandes' => $commandes, 'limite' => self::LIMITE]);
    }
}
