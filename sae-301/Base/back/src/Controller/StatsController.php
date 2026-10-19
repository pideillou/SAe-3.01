<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Response;
use App\Model\CommandeModel;
use App\Model\ProduitModel;

/**
 * Indicateurs du tableau de bord (produits, stocks, commandes), réservés aux
 * administrateurs.
 */
final class StatsController
{
    /** Le modèle qui interroge la base, fourni à la construction. */
    private ProduitModel $produits;

    private CommandeModel $commandes;

    public function __construct(ProduitModel $produits, CommandeModel $commandes)
    {
        $this->produits  = $produits;
        $this->commandes = $commandes;
    }

    public function index(): void
    {
        // La session est déjà ouverte par index.php.
        // Seule une session ouverte par AdminAuthController compte : être client
        // connecté ne suffit pas.
        if (!isset($_SESSION['admin_id'])) {
            Response::erreur('Authentification administrateur requise', 401);
        }

        Response::json($this->produits->statistiques() + ['commandes' => $this->commandes->statistiques()]);
    }
}
