<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Response;
use App\Model\ProduitModel;

/**
 * Catalogue de produits (DEC-b) : tous les produits, avec leur nom, leur prix,
 * leur catégorie et leur image principale.
 */
final class CatalogueController
{
    /** Le modèle qui interroge la base, fourni à la construction. */
    private ProduitModel $produits;

    public function __construct(ProduitModel $produits)
    {
        $this->produits = $produits;
    }

    public function index(): void
    {
        $produits = [];

        foreach ($this->produits->lister() as $ligne) {
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
            'produits' => $produits,
            'total'    => count($produits),
        ]);
    }
}
