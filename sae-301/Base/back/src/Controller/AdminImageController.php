<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\ImageProduitModel;
use App\Model\ProduitAdminModel;
use App\Service\FichiersImages;
use App\Service\ImageInvalideException;
use App\Service\RedimensionneurImage;

/**
 * Images des produits pour les administrateurs (GOF-a) : téléversement avec
 * redimensionnement, image principale, texte alternatif et suppression.
 *
 * Les fichiers sont enregistrés dans le dossier « uploads » (voir FichiersImages),
 * ré-encodés en WebP : le fichier envoyé n'est jamais conservé tel quel.
 */
final class AdminImageController
{
    /** Taille maximale d'une image envoyée, en octets (2 Mo, comme la limite par défaut de PHP). */
    private const TAILLE_MAX = 2 * 1024 * 1024;

    private const ALT_MIN = 3;
    private const ALT_MAX = 255;

    private ImageProduitModel $images;
    private ProduitAdminModel $produits;
    private FichiersImages $fichiers;
    private RedimensionneurImage $redimensionneur;

    public function __construct(
        ImageProduitModel $images,
        ProduitAdminModel $produits,
        FichiersImages $fichiers,
        RedimensionneurImage $redimensionneur,
    ) {
        $this->images          = $images;
        $this->produits        = $produits;
        $this->fichiers        = $fichiers;
        $this->redimensionneur = $redimensionneur;
    }

    /**
     * POST /api/admin/images (multipart) : image, produitId, varianteId (facultatif), alt.
     * Sans variante, l'image rejoint la galerie du produit ; avec une variante,
     * elle devient l'image de cette variante (et remplace la précédente).
     */
    public function ajouter(Request $requete): void
    {
        $this->exigerAdministrateur();

        // Au-delà de post_max_size, PHP jette tout le formulaire sans prévenir : on
        // le reconnaît à une requête vide malgré un corps annoncé, et on l'explique.
        if ($_POST === [] && $_FILES === [] && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
            $message = 'L\'image est trop lourde (2 Mo au maximum).';
            Response::json(['erreur' => $message, 'champs' => ['image' => $message]], 422);
        }

        $produitId  = ctype_digit((string) ($_POST['produitId'] ?? '')) ? (int) $_POST['produitId'] : 0;
        $varianteId = ctype_digit((string) ($_POST['varianteId'] ?? '')) ? (int) $_POST['varianteId'] : null;
        $alt        = trim((string) ($_POST['alt'] ?? ''));

        $produit = $produitId > 0 ? $this->produits->trouverComplet($produitId) : null;

        if ($produit === null) {
            Response::erreur('Produit introuvable.', 404);
        }

        $erreurs = [];

        if ($varianteId !== null && !in_array($varianteId, array_column($produit['variantes'], 'id'), true)) {
            $erreurs['varianteId'] = 'Cette variante n\'appartient pas au produit.';
        }

        if (mb_strlen($alt) < self::ALT_MIN || mb_strlen($alt) > self::ALT_MAX) {
            $erreurs['alt'] = sprintf(
                'Décrivez l\'image en %d à %d caractères (texte alternatif, lu par les lecteurs d\'écran).',
                self::ALT_MIN,
                self::ALT_MAX,
            );
        }

        $fichier = $_FILES['image'] ?? null;
        $erreurFichier = $this->erreurDeTeleversement($fichier);

        if ($erreurFichier !== null) {
            $erreurs['image'] = $erreurFichier;
        }

        if ($erreurs !== []) {
            Response::json(['erreur' => 'Le formulaire contient des erreurs.', 'champs' => $erreurs], 422);
        }

        // Dossier du produit : uploads/produits/<slug>/. Le nom de base est aléatoire
        // (jamais le nom envoyé par le navigateur) : pas de collision, pas de chemin piégé.
        $nomDeBase = bin2hex(random_bytes(6));
        $dossier   = 'produits/' . $produit['slug'];

        try {
            $versions = $this->redimensionneur->traiter(
                $fichier['tmp_name'],
                $this->fichiers->racine() . '/' . $dossier,
                $nomDeBase,
            );
        } catch (ImageInvalideException $e) {
            Response::json(['erreur' => $e->getMessage(), 'champs' => ['image' => $e->getMessage()]], 422);
        }

        $prefixe = FichiersImages::PREFIXE . $dossier . '/';
        $resultat = $this->images->ajouter(
            $produitId,
            $varianteId,
            $prefixe . $versions['moyen'],
            $prefixe . $versions['grand'],
            $alt,
        );

        $this->fichiers->supprimer($resultat['remplacees']);

        Response::json(['image' => AdminProduitController::formaterImage($this->images->trouver($resultat['id']))], 201);
    }

    /**
     * POST /api/admin/images/principale : { id }
     */
    public function definirPrincipale(Request $requete): void
    {
        $this->exigerAdministrateur();

        $image = $this->imageDemandee($requete);

        if ($image['variante_id'] !== null) {
            Response::erreur('Seule une image de la galerie peut être l\'image principale.', 422);
        }

        $this->images->definirPrincipale((int) $image['id']);

        Response::json(['image' => AdminProduitController::formaterImage($this->images->trouver((int) $image['id']))]);
    }

    /**
     * POST /api/admin/images/alt : { id, alt }
     */
    public function modifierAlt(Request $requete): void
    {
        $this->exigerAdministrateur();

        $image = $this->imageDemandee($requete);
        $alt   = is_string($requete->corps()['alt'] ?? null) ? trim($requete->corps()['alt']) : '';

        if (mb_strlen($alt) < self::ALT_MIN || mb_strlen($alt) > self::ALT_MAX) {
            Response::json([
                'erreur' => 'Le formulaire contient des erreurs.',
                'champs' => ['alt' => sprintf('Le texte alternatif doit faire de %d à %d caractères.', self::ALT_MIN, self::ALT_MAX)],
            ], 422);
        }

        $this->images->modifierAlt((int) $image['id'], $alt);

        Response::json(['image' => AdminProduitController::formaterImage($this->images->trouver((int) $image['id']))]);
    }

    /**
     * POST /api/admin/images/supprimer : { id }
     * Efface aussi les fichiers téléversés ; les images d'origine du catalogue
     * ne sont retirées que de la base.
     */
    public function supprimer(Request $requete): void
    {
        $this->exigerAdministrateur();

        $image = $this->imageDemandee($requete);

        $this->images->supprimer((int) $image['id']);
        $this->fichiers->supprimer([$image['chemin_moyen'], $image['chemin_grand']]);

        Response::json(['supprimee' => true]);
    }

    private function imageDemandee(Request $requete): array
    {
        $id    = $requete->corps()['id'] ?? null;
        $image = is_int($id) && $id > 0 ? $this->images->trouver($id) : null;

        if ($image === null) {
            Response::erreur('Image introuvable.', 404);
        }

        return $image;
    }

    private function exigerAdministrateur(): void
    {
        if (!isset($_SESSION['admin_id'])) {
            Response::erreur('Authentification administrateur requise', 401);
        }
    }

    /**
     * Le message d'erreur à montrer si le téléversement a échoué, ou null s'il
     * est correct (fichier présent, reçu en entier, du bon poids).
     */
    private function erreurDeTeleversement(mixed $fichier): ?string
    {
        if (!is_array($fichier) || ($fichier['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            return 'Choisissez une image à envoyer.';
        }

        if ($fichier['error'] === UPLOAD_ERR_INI_SIZE || $fichier['error'] === UPLOAD_ERR_FORM_SIZE
            || ($fichier['size'] ?? 0) > self::TAILLE_MAX) {
            return 'L\'image est trop lourde (2 Mo au maximum).';
        }

        if ($fichier['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($fichier['tmp_name'])) {
            return 'L\'envoi de l\'image a échoué, réessayez.';
        }

        return null;
    }
}
