<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Response;
use App\Model\CategorieModel;

/**
 * Liste des catégories (DEC-a) : de quoi construire le menu de navigation,
 * avec le nombre de produits de chacune.
 */
final class CategorieController
{
    /** Le modèle qui interroge la base, fourni à la construction. */
    private CategorieModel $categories;

    public function __construct(CategorieModel $categories)
    {
        $this->categories = $categories;
    }

    public function index(): void
    {
        $categories = [];
        $total      = 0;

        foreach ($this->categories->lister() as $ligne) {
            $nombre = (int) $ligne['nombre'];
            $total += $nombre;

            $categories[] = [
                'nom'    => $ligne['nom'],
                'slug'   => $ligne['slug'],
                'nombre' => $nombre,
            ];
        }

        Response::json([
            'categories' => $categories,
            // Nombre de produits de tout le catalogue, pour « Tous les produits ».
            'total'      => $total,
        ]);
    }
}
