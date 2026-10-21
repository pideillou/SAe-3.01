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
    /**
     * Sous-requête qui décrit les options d'une variante (« Switch : Vert,
     * Disposition : FR »), à placer dans un SELECT où la table variante porte
     * son nom. Seules les options à plusieurs valeurs y figurent : ce sont
     * celles que le client choisit sur la fiche produit.
     */
    public const SQL_OPTIONS_VARIANTE =
        "(SELECT GROUP_CONCAT(CONCAT(option_produit.nom, ' : ', valeur_option.valeur)
                              ORDER BY option_produit.ordre, option_produit.id SEPARATOR ', ')
            FROM variante_valeur
      INNER JOIN valeur_option ON valeur_option.id = variante_valeur.valeur_id
      INNER JOIN option_produit ON option_produit.id = valeur_option.option_id
           WHERE variante_valeur.variante_id = variante.id
             AND (SELECT COUNT(*) FROM valeur_option AS autres
                   WHERE autres.option_id = option_produit.id) > 1)";

    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Les produits du catalogue, avec leur catégorie et leur image principale,
     * rangés par catégorie puis dans l'ordre d'ajout.
     *
     * Une seule requête : les jointures sur des clés indexées gardent le
     * catalogue rapide, quel que soit le nombre de produits.
     *
     * @param int|null $categorieId  Ne renvoie que les produits de cette
     *                               catégorie ; null pour tout le catalogue.
     */
    public function lister(?int $categorieId = null): array
    {
        // Fragment écrit ici, jamais construit à partir d'une entrée : seule la
        // valeur de la catégorie passe par un paramètre lié.
        $filtre = $categorieId === null ? '' : 'WHERE produit.categorie_id = :categorie';

        $sql = "SELECT produit.id,
                       produit.nom,
                       produit.slug,
                       produit.prix,
                       -- Stock de la variante la mieux fournie : l'état du produit
                       -- au catalogue (le détail par variante est sur la fiche).
                       (SELECT COALESCE(MAX(variante.stock), 0)
                          FROM variante
                         WHERE variante.produit_id = produit.id) AS stock_max,
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
                 {$filtre}
              ORDER BY categorie.ordre, categorie.nom, produit.id";

        $requete = $this->pdo->prepare($sql);

        if ($categorieId !== null) {
            $requete->bindValue(':categorie', $categorieId, PDO::PARAM_INT);
        }

        $requete->execute();

        return $requete->fetchAll();
    }

    /**
     * Un produit d'après son slug, avec sa catégorie et le prix de sa variante
     * la plus chère (le prix de base, lui, est celui de la moins chère), ou
     * null si le produit n'existe pas.
     */
    public function trouverParSlug(string $slug): ?array
    {
        $requete = $this->pdo->prepare(
            'SELECT produit.id,
                    produit.nom,
                    produit.slug,
                    produit.accroche,
                    produit.description,
                    produit.caracteristiques,
                    produit.prix,
                    (SELECT MAX(variante.prix)
                       FROM variante
                      WHERE variante.produit_id = produit.id) AS prix_max,
                    categorie.nom  AS categorie_nom,
                    categorie.slug AS categorie_slug
               FROM produit
         INNER JOIN categorie ON categorie.id = produit.categorie_id
              WHERE produit.slug = :slug'
        );
        $requete->execute([':slug' => $slug]);

        return $requete->fetch() ?: null;
    }

    /**
     * Les images du produit : la principale d'abord, puis la galerie dans son
     * ordre. Les images propres à une variante (couleur…) sont exclues.
     */
    public function listerImages(int $produitId): array
    {
        $requete = $this->pdo->prepare(
            'SELECT chemin_moyen, chemin_grand, texte_alt
               FROM image_produit
              WHERE produit_id = :produit
                AND variante_id IS NULL
           ORDER BY est_principale DESC, ordre, id'
        );
        $requete->bindValue(':produit', $produitId, PDO::PARAM_INT);
        $requete->execute();

        return $requete->fetchAll();
    }

    /**
     * Les options d'un produit (Couleur, Disposition du clavier…) avec leurs
     * valeurs, dans l'ordre d'affichage. Une ligne par valeur.
     */
    public function listerOptions(int $produitId): array
    {
        $requete = $this->pdo->prepare(
            'SELECT option_produit.id    AS option_id,
                    option_produit.nom   AS option_nom,
                    valeur_option.id     AS valeur_id,
                    valeur_option.valeur AS valeur
               FROM option_produit
         INNER JOIN valeur_option ON valeur_option.option_id = option_produit.id
              WHERE option_produit.produit_id = :produit
           ORDER BY option_produit.ordre, option_produit.id, valeur_option.ordre, valeur_option.id'
        );
        $requete->bindValue(':produit', $produitId, PDO::PARAM_INT);
        $requete->execute();

        return $requete->fetchAll();
    }

    /**
     * Les variantes d'un produit : prix, stock, image propre et identifiants
     * des valeurs d'options qui les composent (séparés par des virgules).
     */
    public function listerVariantes(int $produitId): array
    {
        $requete = $this->pdo->prepare(
            'SELECT variante.id,
                    variante.reference,
                    variante.nom,
                    variante.prix,
                    variante.stock,
                    variante.est_defaut,
                    GROUP_CONCAT(variante_valeur.valeur_id ORDER BY variante_valeur.valeur_id) AS valeurs,
                    image_produit.chemin_moyen,
                    image_produit.chemin_grand,
                    image_produit.texte_alt
               FROM variante
          LEFT JOIN variante_valeur ON variante_valeur.variante_id = variante.id
          LEFT JOIN image_produit   ON image_produit.variante_id = variante.id
              WHERE variante.produit_id = :produit
           GROUP BY variante.id, variante.reference, variante.nom, variante.prix, variante.stock,
                    variante.est_defaut, image_produit.chemin_moyen, image_produit.chemin_grand,
                    image_produit.texte_alt
           ORDER BY variante.id'
        );
        $requete->bindValue(':produit', $produitId, PDO::PARAM_INT);
        $requete->execute();

        return $requete->fetchAll();
    }

    /**
     * Confronte des quantités demandées au stock réel de la base (STK-c).
     *
     * Renvoie une entrée par variante demandée, dans l'ordre reçu :
     *   - connue : id, nom, prix, stock, produit_slug, produit_nom, image,
     *     quantite_demandee et quantite_acceptee (la demande, ramenée au stock) ;
     *   - inconnue (supprimée depuis l'ajout au panier) : id, quantite_demandee,
     *     et connue = false.
     *
     * Ne modifie rien : c'est une lecture. La validation d'une commande refait
     * le contrôle dans sa propre transaction (voir la skill stock-et-commandes).
     *
     * @param array<int, int> $demandes  quantité demandée, indexée par id de variante
     */
    public function verifierDisponibilite(array $demandes): array
    {
        if ($demandes === []) {
            return [];
        }

        $ids          = array_keys($demandes);
        $emplacements = implode(',', array_fill(0, count($ids), '?'));

        $requete = $this->pdo->prepare(
            "SELECT variante.id,
                    variante.nom,
                    variante.prix,
                    variante.stock,
                    " . self::SQL_OPTIONS_VARIANTE . " AS options,
                    produit.slug AS produit_slug,
                    produit.nom  AS produit_nom,
                    COALESCE(image_variante.chemin_moyen, image_produit.chemin_moyen) AS chemin_moyen,
                    COALESCE(image_variante.texte_alt, image_produit.texte_alt)       AS texte_alt
               FROM variante
         INNER JOIN produit ON produit.id = variante.produit_id
          LEFT JOIN image_produit AS image_variante
                 ON image_variante.variante_id = variante.id
          LEFT JOIN image_produit
                 ON image_produit.produit_id = produit.id
                AND image_produit.variante_id IS NULL
                AND image_produit.est_principale = 1
              WHERE variante.id IN ($emplacements)"
        );
        $requete->execute($ids);

        $trouvees = [];

        foreach ($requete->fetchAll() as $ligne) {
            $trouvees[(int) $ligne['id']] = $ligne;
        }

        $resultat = [];

        foreach ($demandes as $id => $quantite) {
            $ligne = $trouvees[$id] ?? null;

            if ($ligne === null) {
                $resultat[] = ['id' => $id, 'connue' => false, 'quantite_demandee' => $quantite];
                continue;
            }

            $stock = (int) $ligne['stock'];

            $resultat[] = [
                'id'                => $id,
                'connue'            => true,
                'nom'               => $ligne['nom'],
                'options'           => $ligne['options'],
                'prix'              => $ligne['prix'],
                'stock'             => $stock,
                'produit_slug'      => $ligne['produit_slug'],
                'produit_nom'       => $ligne['produit_nom'],
                'image'             => $ligne['chemin_moyen'],
                'image_alt'         => $ligne['texte_alt'],
                'quantite_demandee' => $quantite,
                'quantite_acceptee' => min($quantite, $stock),
            ];
        }

        return $resultat;
    }

    /**
     * Le stock de chaque produit (somme du stock de ses variantes), pour
     * l'histogramme du tableau de bord (PIL-a). Les produits les mieux fournis
     * d'abord.
     *
     * @return array<int, array{produit: string, categorie: string, unites: int, variantes: int}>
     */
    public function stocksParProduit(): array
    {
        $lignes = $this->pdo->query(
            'SELECT produit.nom AS produit,
                    categorie.nom AS categorie,
                    COALESCE(SUM(variante.stock), 0) AS unites,
                    COUNT(variante.id) AS variantes
               FROM produit
         INNER JOIN categorie ON categorie.id = produit.categorie_id
          LEFT JOIN variante ON variante.produit_id = produit.id
           GROUP BY produit.id, produit.nom, categorie.nom
           ORDER BY unites DESC, produit.nom'
        )->fetchAll();

        return array_map(static fn (array $l): array => [
            'produit'   => $l['produit'],
            'categorie' => $l['categorie'],
            'unites'    => (int) $l['unites'],
            'variantes' => (int) $l['variantes'],
        ], $lignes);
    }

    /**
     * Les variantes dont le stock est à la limite du seuil « Bientôt épuisé »
     * (ou épuisé), les plus basses d'abord : ce sont les alertes du tableau de
     * bord (PIL-a).
     *
     * @return array<int, array{produit: string, variante: string, stock: int}>
     */
    public function stocksFaibles(int $seuil): array
    {
        $requete = $this->pdo->prepare(
            'SELECT produit.nom AS produit, variante.nom AS variante, variante.stock
               FROM variante
         INNER JOIN produit ON produit.id = variante.produit_id
              WHERE variante.stock <= :seuil
           ORDER BY variante.stock, produit.nom, variante.nom'
        );
        $requete->bindValue(':seuil', $seuil, PDO::PARAM_INT);
        $requete->execute();

        return array_map(static fn (array $l): array => [
            'produit'  => $l['produit'],
            'variante' => $l['variante'],
            'stock'    => (int) $l['stock'],
        ], $requete->fetchAll());
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
