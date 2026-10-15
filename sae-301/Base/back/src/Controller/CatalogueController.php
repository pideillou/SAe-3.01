<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CategorieModel;
use App\Model\ProduitModel;

/**
 * Catalogue de produits (DEC-b) : les produits, avec leur nom, leur prix, leur
 * catégorie et leur image principale. Le paramètre ?categorie=slug ne garde
 * que les produits d'une catégorie (DEC-a).
 */
final class CatalogueController
{
    /** Forme d'un slug : minuscules, chiffres et tirets, sans tiret aux bords. */
    private const FORMAT_SLUG = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

    /** Les modèles qui interrogent la base, fournis à la construction. */
    private ProduitModel $produits;
    private CategorieModel $categories;

    public function __construct(ProduitModel $produits, CategorieModel $categories)
    {
        $this->produits   = $produits;
        $this->categories = $categories;
    }

    public function index(Request $requete): void
    {
        $slug      = $requete->parametre('categorie');
        $categorie = null;

        if ($slug !== null) {
            // La valeur vient de l'adresse : on contrôle sa forme, puis son
            // existence. Une catégorie inconnue est une adresse inconnue (404).
            if (strlen($slug) > 80 || preg_match(self::FORMAT_SLUG, $slug) !== 1) {
                Response::erreur('Catégorie introuvable', 404);
            }

            $categorie = $this->categories->trouverParSlug($slug);

            if ($categorie === null) {
                Response::erreur('Catégorie introuvable', 404);
            }
        }

        $produits = [];

        foreach ($this->produits->lister($categorie === null ? null : (int) $categorie['id']) as $ligne) {
            $produits[] = [
                'id'        => (int) $ligne['id'],
                'nom'       => $ligne['nom'],
                'slug'      => $ligne['slug'],
                // Le prix reste une chaîne (« 189.99 ») : un DECIMAL converti en
                // nombre à virgule flottante pourrait perdre des centimes.
                'prix'      => $ligne['prix'],
                'categorie' => [
                    'nom'  => $ligne['categorie_nom'],
                    'slug' => $ligne['categorie_slug'],
                ],
                // Chemins relatifs au dossier public du front.
                'image'     => $ligne['chemin_moyen'] === null ? null : [
                    'moyen' => $ligne['chemin_moyen'],
                    'grand' => $ligne['chemin_grand'],
                    'alt'   => $ligne['texte_alt'],
                ],
            ];
        }

        Response::json([
            'produits'  => $produits,
            'total'     => count($produits),
            // La catégorie demandée, ou null pour tout le catalogue.
            'categorie' => $categorie === null ? null : [
                'nom'  => $categorie['nom'],
                'slug' => $categorie['slug'],
            ],
        ]);
    }
}
