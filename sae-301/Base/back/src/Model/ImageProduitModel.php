<?php

declare(strict_types=1);

namespace App\Model;

use PDO;
use Throwable;

/**
 * Images des produits (table image_produit) : la galerie d'un produit et l'image
 * propre à une variante (couleur…). Une seule image est « principale » par produit.
 */
final class ImageProduitModel
{
    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Toutes les images d'un produit : la galerie (variante_id null), puis celles
     * des variantes.
     */
    public function listerPourProduit(int $produitId): array
    {
        $requete = $this->pdo->prepare(
            'SELECT id, produit_id, variante_id, chemin_moyen, chemin_grand, texte_alt, est_principale, ordre
               FROM image_produit
              WHERE produit_id = :produit
           ORDER BY variante_id IS NOT NULL, est_principale DESC, ordre, id'
        );
        $requete->execute([':produit' => $produitId]);

        return $requete->fetchAll();
    }

    public function trouver(int $id): ?array
    {
        $requete = $this->pdo->prepare(
            'SELECT id, produit_id, variante_id, chemin_moyen, chemin_grand, texte_alt, est_principale, ordre
               FROM image_produit WHERE id = :id'
        );
        $requete->execute([':id' => $id]);

        return $requete->fetch() ?: null;
    }

    /**
     * Ajoute une image. Sans variante, elle rejoint la galerie du produit (et
     * devient la principale s'il n'y en avait pas). Avec une variante, elle
     * remplace l'image précédente de cette variante.
     *
     * @return array{id: int, remplacees: string[]}  l'identifiant de l'image
     *         créée et les chemins des fichiers de l'image remplacée, à effacer
     */
    public function ajouter(int $produitId, ?int $varianteId, string $moyen, string $grand, string $alt): array
    {
        $remplacees = [];

        $this->pdo->beginTransaction();

        try {
            if ($varianteId !== null) {
                $anciennes = $this->pdo->prepare(
                    'SELECT chemin_moyen, chemin_grand FROM image_produit WHERE variante_id = :variante'
                );
                $anciennes->execute([':variante' => $varianteId]);

                foreach ($anciennes->fetchAll() as $ligne) {
                    $remplacees[] = $ligne['chemin_moyen'];
                    $remplacees[] = $ligne['chemin_grand'];
                }

                $this->pdo->prepare('DELETE FROM image_produit WHERE variante_id = :variante')
                    ->execute([':variante' => $varianteId]);

                $principale = 0;
                $ordre      = 0;
            } else {
                $etat = $this->pdo->prepare(
                    'SELECT COUNT(*) AS nombre, COALESCE(MAX(ordre), 0) AS ordre_max
                       FROM image_produit WHERE produit_id = :produit AND variante_id IS NULL'
                );
                $etat->execute([':produit' => $produitId]);
                $ligne = $etat->fetch();

                $principale = (int) $ligne['nombre'] === 0 ? 1 : 0;
                $ordre      = min(255, (int) $ligne['ordre_max'] + 1);
            }

            $this->pdo->prepare(
                'INSERT INTO image_produit (produit_id, variante_id, chemin_moyen, chemin_grand, texte_alt, est_principale, ordre)
                 VALUES (:produit, :variante, :moyen, :grand, :alt, :principale, :ordre)'
            )->execute([
                ':produit'    => $produitId,
                ':variante'   => $varianteId,
                ':moyen'      => $moyen,
                ':grand'      => $grand,
                ':alt'        => $alt,
                ':principale' => $principale,
                ':ordre'      => $ordre,
            ]);

            $id = (int) $this->pdo->lastInsertId();
            $this->pdo->commit();
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }

        return ['id' => $id, 'remplacees' => array_values(array_unique($remplacees))];
    }

    /**
     * Rend une image de la galerie « principale » ; l'ancienne principale ne
     * l'est plus. Sans effet sur une image de variante.
     */
    public function definirPrincipale(int $id): void
    {
        $image = $this->trouver($id);

        if ($image === null || $image['variante_id'] !== null) {
            return;
        }

        $this->pdo->beginTransaction();

        try {
            $this->pdo->prepare(
                'UPDATE image_produit SET est_principale = 0 WHERE produit_id = :produit AND variante_id IS NULL'
            )->execute([':produit' => $image['produit_id']]);

            $this->pdo->prepare('UPDATE image_produit SET est_principale = 1 WHERE id = :id')
                ->execute([':id' => $id]);

            $this->pdo->commit();
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }

    public function modifierAlt(int $id, string $alt): void
    {
        $this->pdo->prepare('UPDATE image_produit SET texte_alt = :alt WHERE id = :id')
            ->execute([':alt' => $alt, ':id' => $id]);
    }

    /**
     * Supprime une image en base. Si c'était la principale, la première image
     * restante de la galerie le devient.
     *
     * @return array|null  la ligne supprimée (pour effacer ses fichiers), ou null si elle n'existe pas
     */
    public function supprimer(int $id): ?array
    {
        $image = $this->trouver($id);

        if ($image === null) {
            return null;
        }

        $this->pdo->beginTransaction();

        try {
            $this->pdo->prepare('DELETE FROM image_produit WHERE id = :id')->execute([':id' => $id]);

            if ((int) $image['est_principale'] === 1) {
                $this->pdo->prepare(
                    'UPDATE image_produit SET est_principale = 1
                      WHERE id = (SELECT id FROM (
                                    SELECT id FROM image_produit
                                     WHERE produit_id = :produit AND variante_id IS NULL
                                  ORDER BY ordre, id LIMIT 1) AS premiere)'
                )->execute([':produit' => $image['produit_id']]);
            }

            $this->pdo->commit();
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }

        return $image;
    }
}
