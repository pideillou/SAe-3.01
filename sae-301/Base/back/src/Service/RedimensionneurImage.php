<?php

declare(strict_types=1);

namespace App\Service;

/**
 * Vérifie une image téléversée et en produit deux versions WebP redimensionnées
 * (« moyen » pour la galerie, « grand » pour la grande image de la fiche).
 *
 * L'image est toujours ré-encodée par GD : ce qui est enregistré est une image
 * WebP neuve, jamais le fichier envoyé tel quel. Un fichier déguisé (script
 * renommé en .jpg) est donc refusé ou neutralisé.
 */
final class RedimensionneurImage
{
    /** Largeurs des deux versions, en pixels (celles des images du catalogue). */
    public const LARGEUR_MOYEN = 767;
    public const LARGEUR_GRAND = 1199;

    /** Types acceptés, d'après le contenu du fichier et non son extension. */
    private const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    /** Garde-fou mémoire : GD décompresse l'image entière (4 octets par pixel). */
    private const PIXELS_MAX = 16_000_000;

    private const QUALITE_WEBP = 82;

    /**
     * @param string $source       fichier à traiter (le fichier temporaire du téléversement)
     * @param string $dossier      dossier de destination (créé s'il manque)
     * @param string $nomDeBase    début du nom des fichiers produits
     * @return array{moyen: string, grand: string}  noms des deux fichiers créés, dans $dossier
     * @throws ImageInvalideException
     */
    public function traiter(string $source, string $dossier, string $nomDeBase): array
    {
        $info = new \finfo(FILEINFO_MIME_TYPE);

        if (!in_array($info->file($source), self::TYPES, true)) {
            throw new ImageInvalideException('Le fichier doit être une image JPEG, PNG ou WebP.');
        }

        $taille = @getimagesize($source);

        if ($taille === false) {
            throw new ImageInvalideException('Ce fichier n\'est pas une image lisible.');
        }

        [$largeur, $hauteur] = $taille;

        if ($largeur < 1 || $hauteur < 1 || $largeur * $hauteur > self::PIXELS_MAX) {
            throw new ImageInvalideException('L\'image est trop grande (16 millions de pixels au maximum, soit environ 4000 × 4000).');
        }

        $image = match ($taille[2]) {
            IMAGETYPE_JPEG => @imagecreatefromjpeg($source),
            IMAGETYPE_PNG  => @imagecreatefrompng($source),
            IMAGETYPE_WEBP => @imagecreatefromwebp($source),
            default        => false,
        };

        if ($image === false) {
            throw new ImageInvalideException('Ce fichier n\'est pas une image lisible.');
        }

        if ($taille[2] === IMAGETYPE_JPEG) {
            $image = $this->corrigerOrientation($image, $source);
        }

        if (!is_dir($dossier) && !@mkdir($dossier, 0755, true) && !is_dir($dossier)) {
            throw new \RuntimeException('Le dossier des images ne peut pas être créé.');
        }

        $fichiers = [];

        foreach (['moyen' => self::LARGEUR_MOYEN, 'grand' => self::LARGEUR_GRAND] as $version => $cible) {
            $nom = sprintf('%s-%d.webp', $nomDeBase, $cible);
            $this->enregistrer($image, $cible, $dossier . '/' . $nom);
            $fichiers[$version] = $nom;
        }

        return $fichiers;
    }

    /**
     * Enregistre l'image en WebP à la largeur demandée (jamais agrandie).
     */
    private function enregistrer(\GdImage $image, int $largeurCible, string $chemin): void
    {
        $largeur = imagesx($image);
        $hauteur = imagesy($image);
        $nouvelleLargeur = min($largeur, $largeurCible);
        $nouvelleHauteur = max(1, (int) round($hauteur * $nouvelleLargeur / $largeur));

        $copie = imagecreatetruecolor($nouvelleLargeur, $nouvelleHauteur);
        imagealphablending($copie, false);
        imagesavealpha($copie, true);
        imagefill($copie, 0, 0, imagecolorallocatealpha($copie, 0, 0, 0, 127));
        imagecopyresampled($copie, $image, 0, 0, 0, 0, $nouvelleLargeur, $nouvelleHauteur, $largeur, $hauteur);

        if (!imagewebp($copie, $chemin, self::QUALITE_WEBP)) {
            throw new \RuntimeException('L\'image ne peut pas être enregistrée.');
        }

        @chmod($chemin, 0644);
    }

    /**
     * Les photos de téléphone portent leur orientation dans les données EXIF :
     * sans cette correction, elles s'afficheraient couchées.
     */
    private function corrigerOrientation(\GdImage $image, string $source): \GdImage
    {
        if (!function_exists('exif_read_data')) {
            return $image;
        }

        $exif = @exif_read_data($source);
        $angle = match ($exif['Orientation'] ?? 1) {
            3       => 180,
            6       => -90,
            8       => 90,
            default => 0,
        };

        if ($angle === 0) {
            return $image;
        }

        return imagerotate($image, $angle, 0) ?: $image;
    }
}
