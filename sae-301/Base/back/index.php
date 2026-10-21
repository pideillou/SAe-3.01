<?php

declare(strict_types=1);

/**
 * Point d'entrée unique de l'API.
 *
 * Toutes les requêtes commençant par /api/ aboutissent ici, redirigées par le
 * fichier .htaccess situé à la racine du projet.
 *
 * Ce fichier ne contient aucune logique métier : il assemble les pièces et
 * confie la requête au routeur.
 */

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Controller\AdminAuthController;
use App\Controller\AdminCategorieController;
use App\Controller\AdminImageController;
use App\Controller\AdminProduitController;
use App\Controller\AdminCodePromoController;
use App\Controller\AdminCommandeController;
use App\Controller\AuthController;
use App\Controller\CatalogueController;
use App\Controller\CategorieController;
use App\Controller\CommandeController;
use App\Controller\PanierController;
use App\Controller\ProfilController;
use App\Controller\StatsController;
use App\Model\AdministrateurModel;
use App\Model\CategorieModel;
use App\Model\CodePromoModel;
use App\Model\CommandeModel;
use App\Model\ImageProduitModel;
use App\Model\ProduitAdminModel;
use App\Service\FichiersImages;
use App\Service\RedimensionneurImage;
use App\Model\ParametreModel;
use App\Model\ProduitModel;
use App\Model\TentativeConnexionModel;
use App\Model\PromotionModel;
use App\Model\UtilisateurModel;

// --- Chargement automatique des classes ------------------------------------
// App\Core\Router  ->  back/src/Core/Router.php
//
// Plutôt que d'écrire un require par classe, on confie à PHP la fonction
// ci-dessous. PHP la gardera de côté et l'appellera LUI-MÊME, chaque fois qu'il
// rencontrera un nom de classe qu'il ne connaît pas encore — en lui passant ce
// nom en paramètre. À charge pour elle de trouver le fichier correspondant et
// de l'inclure. Rien ici n'est exécuté maintenant : on prépare seulement ce qui
// servira plus tard.
spl_autoload_register(static function (string $classe): void {
    $prefixe = 'App\\';

    if (!str_starts_with($classe, $prefixe)) {
        return;
    }

    $relatif = substr($classe, strlen($prefixe));
    $fichier = __DIR__ . '/src/' . str_replace('\\', '/', $relatif) . '.php';

    if (is_file($fichier)) {
        require $fichier;
    }
});

$config = require __DIR__ . '/config/config.php';

// --- Affichage des erreurs --------------------------------------------------
// En développement, une erreur PHP brute casserait le JSON attendu par le front.
// On les capture pour toujours répondre un document exploitable.
error_reporting(E_ALL);
ini_set('display_errors', '0');

try {
    $pdo = Database::connexion($config['bdd']);

    // --- Assemblage ---------------------------------------------------------
    // Les dépendances sont créées explicitement : le modèle reçoit la connexion,
    // le contrôleur reçoit le modèle. Aucune magie, tout est lisible ici.
    $promotion  = new PromotionModel($pdo);
    $tentatives = new TentativeConnexionModel($pdo);
    $produits   = new ProduitModel($pdo, $promotion);
    $categories = new CategorieModel($pdo);
    $parametres = new ParametreModel($pdo);
    $utilisateurs    = new UtilisateurModel($pdo);
    $administrateurs = new AdministrateurModel($pdo);
    $commandes       = new CommandeModel($pdo, $promotion);
    $codesPromo      = new CodePromoModel($pdo);
    $produitsAdmin   = new ProduitAdminModel($pdo);
    $imagesProduits  = new ImageProduitModel($pdo);

    // Images téléversées par l'administration : dossier « uploads » à la racine
    // du projet, hors de front/dist (que chaque dépôt du site remplace).
    $fichiersImages = new FichiersImages(__DIR__ . '/../uploads');

    $controleurs = [
        CatalogueController::class => new CatalogueController($produits, $categories, $parametres, $promotion),
        CategorieController::class => new CategorieController($categories),
        AuthController::class      => new AuthController($utilisateurs, $tentatives),
        AdminProduitController::class => new AdminProduitController(
            $produitsAdmin,
            $categories,
            $imagesProduits,
            $parametres,
            $fichiersImages,
        ),
        AdminImageController::class => new AdminImageController(
            $imagesProduits,
            $produitsAdmin,
            $fichiersImages,
            new RedimensionneurImage(),
        ),
        AdminCategorieController::class => new AdminCategorieController($categories),
        AdminCodePromoController::class => new AdminCodePromoController($codesPromo),
        AdminCommandeController::class => new AdminCommandeController($commandes),
        AdminAuthController::class => new AdminAuthController($administrateurs, $tentatives),
        CommandeController::class  => new CommandeController($commandes, $produits, $codesPromo),
        PanierController::class    => new PanierController($produits, $parametres),
        ProfilController::class    => new ProfilController($utilisateurs, $commandes, $tentatives),
        StatsController::class     => new StatsController($produits, $commandes, $parametres),
    ];

    $routes = require __DIR__ . '/src/routes.php';

    // --- Session : réglage unique, avant tout contrôleur --------------------
    // PHP n'envoie le cookie de session qu'au moment où il crée la session : ses
    // paramètres doivent donc être fixés ici, avant session_start(), et nulle
    // part ailleurs.
    ini_set('session.use_strict_mode', '1');

    // Indépendance vis-à-vis des autres sites du même hébergement (mmi.unilim.fr
    // héberge tous les espaces ~login sur le même domaine) :
    //  - un nom de cookie propre au projet, tiré de son chemin, au lieu du
    //    PHPSESSID que tous les sites PHP partagent : deux projets ne se
    //    prennent pas le cookie de l'autre, même si l'un fixe le sien sur « / » ;
    //  - un dossier de sessions propre au projet (back/sessions/), quand il est
    //    utilisable, au lieu du dossier commun du serveur où les fichiers de
    //    session de tous les sites sont mélangés. Sinon, le dossier du serveur.
    session_name('razer_' . substr(md5($config['chemin']), 0, 10));

    $dossierSessions = __DIR__ . '/sessions';

    if (is_dir($dossierSessions) && is_writable($dossierSessions)) {
        session_save_path($dossierSessions);
        // Sans cron pour nettoyer ce dossier, PHP efface lui-même les sessions
        // périmées (1 chance sur 100 à chaque ouverture de session).
        ini_set('session.gc_probability', '1');
        ini_set('session.gc_divisor', '100');
    }

    session_set_cookie_params([
        'path'     => $config['chemin'],
        'httponly' => true,
        'secure'   => true,
        'samesite' => 'Lax',
    ]);

    session_start();

    (new Router($routes, $controleurs))->traiter(Request::depuisGlobals());
} catch (Throwable $e) {
    Response::json(
        [
            'erreur' => $config['debug']
                ? $e->getMessage()
                : 'Une erreur interne est survenue.',
            'fichier' => $config['debug'] ? $e->getFile() . ':' . $e->getLine() : null,
        ],
        500,
    );
}
