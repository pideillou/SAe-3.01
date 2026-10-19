<?php

declare(strict_types=1);

namespace App\Model;

use PDO;
use PDOException;

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

    /** Codes d'erreur MySQL utilisés pour reconnaître une contrainte violée. */
    private const ERREUR_DOUBLON         = 1062; // index UNIQUE (nom ou slug déjà pris)
    private const ERREUR_CLE_ETRANGERE   = 1451; // la catégorie a encore des produits

    /**
     * Toutes les catégories avec leur description et leur ordre, pour le
     * back-office, dans l'ordre d'affichage.
     */
    public function listerPourAdmin(): array
    {
        return $this->pdo->query(
            'SELECT categorie.id,
                    categorie.nom,
                    categorie.slug,
                    categorie.description,
                    categorie.ordre,
                    COUNT(produit.id) AS nombre
               FROM categorie
          LEFT JOIN produit ON produit.categorie_id = categorie.id
           GROUP BY categorie.id, categorie.nom, categorie.slug, categorie.description, categorie.ordre
           ORDER BY categorie.ordre, categorie.nom'
        )->fetchAll();
    }

    /**
     * Une catégorie d'après son identifiant, ou null si elle n'existe pas.
     */
    public function trouverParId(int $id): ?array
    {
        $requete = $this->pdo->prepare(
            'SELECT id, nom, slug, description, ordre FROM categorie WHERE id = :id'
        );
        $requete->execute([':id' => $id]);

        return $requete->fetch() ?: null;
    }

    /**
     * Le nombre de produits rattachés à une catégorie.
     */
    public function compterProduits(int $id): int
    {
        $requete = $this->pdo->prepare('SELECT COUNT(*) FROM produit WHERE categorie_id = :id');
        $requete->execute([':id' => $id]);

        return (int) $requete->fetchColumn();
    }

    /**
     * Le plus grand ordre d'affichage utilisé (0 s'il n'y a aucune catégorie).
     */
    public function ordreMaximal(): int
    {
        return (int) $this->pdo->query('SELECT COALESCE(MAX(ordre), 0) FROM categorie')->fetchColumn();
    }

    /**
     * Crée une catégorie. Renvoie son identifiant, ou « nom » / « slug » si
     * l'index UNIQUE de la base refuse un doublon sur ce champ.
     *
     * @return int|string
     */
    public function creer(string $nom, string $slug, ?string $description, int $ordre): int|string
    {
        try {
            $this->pdo->prepare(
                'INSERT INTO categorie (nom, slug, description, ordre)
                 VALUES (:nom, :slug, :description, :ordre)'
            )->execute([':nom' => $nom, ':slug' => $slug, ':description' => $description, ':ordre' => $ordre]);
        } catch (PDOException $e) {
            return self::champEnDoublon($e);
        }

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Modifie le nom, la description et l'ordre d'une catégorie. Son adresse
     * (slug) ne change pas : les liens vers /categorie/slug restent valables.
     * Renvoie true, ou « nom » si ce nom est déjà pris.
     *
     * @return bool|string
     */
    public function modifier(int $id, string $nom, ?string $description, int $ordre): bool|string
    {
        try {
            $this->pdo->prepare(
                'UPDATE categorie SET nom = :nom, description = :description, ordre = :ordre WHERE id = :id'
            )->execute([':nom' => $nom, ':description' => $description, ':ordre' => $ordre, ':id' => $id]);
        } catch (PDOException $e) {
            return self::champEnDoublon($e);
        }

        return true;
    }

    /**
     * Supprime une catégorie. Renvoie « ok », « inconnue » (déjà supprimée) ou
     * « produits » si des produits y sont encore rattachés : c'est la clé
     * étrangère de la base qui tranche, ce qui reste vrai même si un produit est
     * ajouté entre la vérification et la suppression.
     */
    public function supprimer(int $id): string
    {
        try {
            $requete = $this->pdo->prepare('DELETE FROM categorie WHERE id = :id');
            $requete->execute([':id' => $id]);
        } catch (PDOException $e) {
            if (($e->errorInfo[1] ?? 0) === self::ERREUR_CLE_ETRANGERE) {
                return 'produits';
            }
            throw $e;
        }

        return $requete->rowCount() === 1 ? 'ok' : 'inconnue';
    }

    /**
     * Quel champ a causé une erreur de doublon : « slug » ou « nom ». Toute
     * autre erreur est relancée.
     */
    private static function champEnDoublon(PDOException $e): string
    {
        if (($e->errorInfo[1] ?? 0) !== self::ERREUR_DOUBLON) {
            throw $e;
        }

        return str_contains((string) ($e->errorInfo[2] ?? ''), 'uq_categorie_slug') ? 'slug' : 'nom';
    }
}
