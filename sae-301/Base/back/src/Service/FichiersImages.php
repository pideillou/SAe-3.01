<?php

declare(strict_types=1);

namespace App\Service;

/**
 * Les fichiers d'images téléversés par l'administration, rangés dans le dossier
 * « uploads » à la racine du projet (hors de front/dist, que chaque dépôt du
 * site remplace).
 *
 * Les images du catalogue d'origine, dans front/public/images, ne sont jamais
 * touchées : seuls les chemins qui commencent par « uploads/ » sont gérés ici.
 */
final class FichiersImages
{
    public const PREFIXE = 'uploads/';

    /** Dossier « uploads » sur le disque, sans barre finale. */
    private string $racine;

    public function __construct(string $racine)
    {
        $this->racine = rtrim($racine, '/');
    }

    public function racine(): string
    {
        return $this->racine;
    }

    /**
     * Efface des fichiers donnés par leur chemin relatif au projet
     * (« uploads/produits/cobra/x-767.webp »). Les chemins hors de « uploads/ »
     * et ceux qui tentent d'en sortir (« .. ») sont ignorés. Le dossier d'un
     * produit est retiré quand il n'a plus aucun fichier.
     *
     * @param string[] $chemins
     */
    public function supprimer(array $chemins): void
    {
        $dossiers = [];

        foreach ($chemins as $chemin) {
            if (!str_starts_with($chemin, self::PREFIXE) || str_contains($chemin, '..')) {
                continue;
            }

            $fichier = $this->racine . '/' . substr($chemin, strlen(self::PREFIXE));

            if (is_file($fichier)) {
                @unlink($fichier);
                $dossiers[dirname($fichier)] = true;
            }
        }

        // rmdir refuse un dossier qui n'est pas vide : aucun risque de perdre une image.
        foreach (array_keys($dossiers) as $dossier) {
            if ($dossier !== $this->racine && $dossier !== $this->racine . '/produits') {
                @rmdir($dossier);
            }
        }
    }
}
