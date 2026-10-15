<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux catégories de produits.
 *
 * Cette couche ne contient aucune règle métier et ne décide de rien :
 * elle exécute les requêtes qu'on lui demande et renvoie des tableaux.
 */
final class CategorieModel
{
    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Toutes les catégories, dans l'ordre d'affichage, avec le nombre de
     * produits de chacune. Une catégorie vide est renvoyée avec 0.
     */
    public function lister(): array
    {
        $sql = 'SELECT categorie.id,
                       categorie.nom,
                       categorie.slug,
                       COUNT(produit.id) AS nombre
                  FROM categorie
             LEFT JOIN produit ON produit.categorie_id = categorie.id
              GROUP BY categorie.id, categorie.nom, categorie.slug, categorie.ordre
              ORDER BY categorie.ordre, categorie.nom';

        return $this->pdo->query($sql)->fetchAll();
    }

    /**
     * Une catégorie d'après son slug, ou null si elle n'existe pas.
     */
    public function trouverParSlug(string $slug): ?array
    {
        $requete = $this->pdo->prepare(
            'SELECT id, nom, slug FROM categorie WHERE slug = :slug'
        );
        $requete->execute([':slug' => $slug]);

        return $requete->fetch() ?: null;
    }
}
