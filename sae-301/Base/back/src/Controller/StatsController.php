<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Response;
use App\Model\ProduitModel;

/**
 * Statistiques du catalogue, réservées aux administrateurs.
 */
final class StatsController
{
    /** Le modèle qui interroge la base, fourni à la construction. */
    private ProduitModel $produits;

    public function __construct(ProduitModel $produits)
    {
        $this->produits = $produits;
    }

    public function index(): void
    {
        // La session est déjà ouverte par index.php.
        // Seule une session ouverte par AdminAuthController compte : être client
        // connecté ne suffit pas.
        if (!isset($_SESSION['admin_id'])) {
            Response::erreur('Authentification administrateur requise', 401);
        }

        Response::json($this->produits->statistiques());
    }
}
