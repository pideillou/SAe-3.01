<?php

declare(strict_types=1);

use App\Controller\AdminAuthController;
use App\Controller\AdminCategorieController;
use App\Controller\AdminImageController;
use App\Controller\AdminProduitController;
use App\Controller\AdminCommandeController;
use App\Controller\AuthController;
use App\Controller\CatalogueController;
use App\Controller\CategorieController;
use App\Controller\CommandeController;
use App\Controller\PanierController;
use App\Controller\ProfilController;
use App\Controller\StatsController;

/**
 * Table des routes de l'API.
 *
 * Clé    : méthode HTTP et chemin, séparés par un ou plusieurs espaces.
 * Valeur : [classe du contrôleur, méthode à appeler].
 *
 * Toute instance de contrôleur utilisée ici doit également être enregistrée
 * dans back/index.php.
 */

return [
    'GET  /api/produits'    => [CatalogueController::class, 'index'],
    'GET  /api/categories'  => [CategorieController::class, 'index'],
    'GET  /api/produit'     => [CatalogueController::class, 'detail'],
    'POST /api/panier/verifier' => [PanierController::class, 'verifier'],
    'POST /api/commande'     => [CommandeController::class, 'creer'],
    'GET  /api/commande'     => [CommandeController::class, 'detail'],
    'GET  /api/commandes'    => [CommandeController::class, 'historique'],
    'POST /api/commande/recommander' => [CommandeController::class, 'recommander'],
    'POST /api/commande/code-promo' => [CommandeController::class, 'verifierCode'],
    'POST /api/inscription' => [AuthController::class,      'inscription'],
    'POST /api/login'       => [AuthController::class,      'login'],
    'GET  /api/moi'         => [AuthController::class,      'moi'],
    'POST /api/logout'      => [AuthController::class,      'logout'],
    'GET  /api/profil'      => [ProfilController::class,    'voir'],
    'POST /api/profil'      => [ProfilController::class,    'modifier'],
    'POST /api/profil/mot-de-passe' => [ProfilController::class, 'changerMotDePasse'],
    'POST /api/admin/login'  => [AdminAuthController::class, 'login'],
    'POST /api/admin/logout' => [AdminAuthController::class, 'logout'],
    'GET  /api/admin/moi'    => [AdminAuthController::class, 'moi'],
    'GET  /api/admin/categories' => [AdminCategorieController::class, 'index'],
    'POST /api/admin/categories' => [AdminCategorieController::class, 'creer'],
    'POST /api/admin/categories/modifier' => [AdminCategorieController::class, 'modifier'],
    'POST /api/admin/categories/supprimer' => [AdminCategorieController::class, 'supprimer'],
    'GET  /api/admin/produits' => [AdminProduitController::class, 'index'],
    'GET  /api/admin/produit' => [AdminProduitController::class, 'detail'],
    'POST /api/admin/produits' => [AdminProduitController::class, 'creer'],
    'POST /api/admin/produits/modifier' => [AdminProduitController::class, 'modifier'],
    'POST /api/admin/produits/supprimer' => [AdminProduitController::class, 'supprimer'],
    'POST /api/admin/seuil' => [AdminProduitController::class, 'definirSeuil'],
    'POST /api/admin/images' => [AdminImageController::class, 'ajouter'],
    'POST /api/admin/images/principale' => [AdminImageController::class, 'definirPrincipale'],
    'POST /api/admin/images/alt' => [AdminImageController::class, 'modifierAlt'],
    'POST /api/admin/images/supprimer' => [AdminImageController::class, 'supprimer'],
    'GET  /api/admin/commandes' => [AdminCommandeController::class, 'index'],
    'GET  /api/admin/commande' => [AdminCommandeController::class, 'detail'],
    'POST /api/admin/commandes/statut' => [AdminCommandeController::class, 'changerStatut'],
    'GET  /api/admin/stats' => [StatsController::class,     'index'],
    'GET  /api/admin/statistiques' => [StatsController::class, 'statistiques'],
    'GET  /api/admin/statistiques/export' => [StatsController::class, 'exporter'],
];
