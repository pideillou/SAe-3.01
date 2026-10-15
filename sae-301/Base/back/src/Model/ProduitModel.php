<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux données du catalogue de produits.
 *
 * Cette couche ne contient aucune règle métier et ne décide de rien :
 * elle exécute les requêtes qu'on lui demande et renvoie des tableaux.
 */
final class ProduitModel
{
    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Tous les produits du catalogue, avec leur catégorie et leur image
     * principale, rangés par catégorie puis dans l'ordre d'ajout.
     *
     * Une seule requête : les jointures sur des clés indexées gardent le
     * catalogue rapide, quel que soit le nombre de produits.
     */
    public function lister(): array
    {
        $sql = "SELECT produit.id,
                       produit.nom,
                       produit.slug,
                       produit.prix,
                       categorie.nom          AS categorie_nom,
                       categorie.slug         AS categorie_slug,
                       image_produit.chemin_moyen,
                       image_produit.chemin_grand,
                       image_produit.texte_alt
                  FROM produit
            INNER JOIN categorie ON categorie.id = produit.categorie_id
             LEFT JOIN image_produit
                    ON image_produit.produit_id = produit.id
                   AND image_produit.est_principale = 1
                   AND image_produit.variante_id IS NULL
              ORDER BY categorie.ordre, categorie.nom, produit.id";

        return $this->pdo->query($sql)->fetchAll();
    }

    /**
     * Indicateurs simples pour la zone d'administration.
     */
    public function statistiques(): array
    {
        $global = $this->pdo->query(
            'SELECT (SELECT COUNT(*) FROM produit)               AS produits,
                    (SELECT COUNT(*) FROM variante)              AS variantes,
                    (SELECT COALESCE(SUM(stock), 0) FROM variante) AS unites'
        )->fetch();

        $parCategorie = $this->pdo->query(
            'SELECT categorie.nom AS categorie,
                    COUNT(produit.id) AS nombre
               FROM categorie
          LEFT JOIN produit ON produit.categorie_id = categorie.id
           GROUP BY categorie.id, categorie.nom, categorie.ordre
           ORDER BY categorie.ordre, categorie.nom'
        )->fetchAll();

        // MySQL renvoie les nombres sous forme de chaînes. On les convertit
        // ligne par ligne, pour que le JSON contienne bien des nombres.
        $categories = [];

        foreach ($parCategorie as $ligne) {
            $categories[] = [
                'categorie' => $ligne['categorie'],
                'nombre'    => (int) $ligne['nombre'],
            ];
        }

        return [
            'produits'     => (int) $global['produits'],
            'variantes'    => (int) $global['variantes'],
            'unites'       => (int) $global['unites'],
            'parCategorie' => $categories,
        ];
    }
}
