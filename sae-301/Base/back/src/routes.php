<?php

declare(strict_types=1);

use App\Controller\AdminAuthController;
use App\Controller\AuthController;
use App\Controller\CatalogueController;
use App\Controller\CategorieController;
use App\Controller\CommandeController;
use App\Controller\PanierController;
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
    'POST /api/inscription' => [AuthController::class,      'inscription'],
    'POST /api/login'       => [AuthController::class,      'login'],
    'GET  /api/moi'         => [AuthController::class,      'moi'],
    'POST /api/logout'      => [AuthController::class,      'logout'],
    'POST /api/admin/login'  => [AdminAuthController::class, 'login'],
    'POST /api/admin/logout' => [AdminAuthController::class, 'logout'],
    'GET  /api/admin/moi'    => [AdminAuthController::class, 'moi'],
    'GET  /api/admin/stats' => [StatsController::class,     'index'],
];
