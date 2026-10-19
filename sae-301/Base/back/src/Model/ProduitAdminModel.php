<?php

declare(strict_types=1);

namespace App\Model;

use PDO;
use PDOException;
use Throwable;

/**
 * Écriture et lecture complète des produits pour le back-office (GOF-a) :
 * produit, options et valeurs, variantes (prix, stock) et journal des
 * ajustements de stock. La lecture publique du catalogue reste dans ProduitModel.
 */
final class ProduitAdminModel
{
    /** Code d'erreur MySQL « entrée en double » (index UNIQUE). */
    private const ERREUR_DOUBLON = 1062;

    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Les produits avec leur catégorie, leur fourchette de prix et leurs stocks.
     */
    public function lister(): array
    {
        return $this->pdo->query(
            'SELECT produit.id,
                    produit.nom,
                    produit.slug,
                    categorie.nom AS categorie_nom,
                    (SELECT COUNT(*) FROM variante WHERE variante.produit_id = produit.id) AS variantes,
                    (SELECT COALESCE(SUM(stock), 0) FROM variante WHERE variante.produit_id = produit.id) AS stock_total,
                    (SELECT COALESCE(MAX(stock), 0) FROM variante WHERE variante.produit_id = produit.id) AS stock_max,
                    (SELECT MIN(prix) FROM variante WHERE variante.produit_id = produit.id) AS prix_min,
                    (SELECT MAX(prix) FROM variante WHERE variante.produit_id = produit.id) AS prix_max
               FROM produit
         INNER JOIN categorie ON categorie.id = produit.categorie_id
           ORDER BY categorie.ordre, categorie.nom, produit.id'
        )->fetchAll();
    }

    /**
     * Un produit complet (champs, options, variantes, images), ou null s'il
     * n'existe pas. Les variantes portent leurs valeurs d'options sous forme de
     * textes, dans l'ordre des options.
     */
    public function trouverComplet(int $id): ?array
    {
        $requete = $this->pdo->prepare(
            'SELECT id, categorie_id, nom, slug, accroche, description, caracteristiques
               FROM produit WHERE id = :id'
        );
        $requete->execute([':id' => $id]);
        $produit = $requete->fetch();

        if ($produit === false) {
            return null;
        }

        // Options et valeurs, dans l'ordre d'affichage.
        $lignes = $this->pdo->prepare(
            'SELECT option_produit.id AS option_id, option_produit.nom AS option_nom,
                    valeur_option.id AS valeur_id, valeur_option.valeur
               FROM option_produit
          LEFT JOIN valeur_option ON valeur_option.option_id = option_produit.id
              WHERE option_produit.produit_id = :id
           ORDER BY option_produit.ordre, option_produit.id, valeur_option.ordre, valeur_option.id'
        );
        $lignes->execute([':id' => $id]);

        $options = [];

        foreach ($lignes->fetchAll() as $ligne) {
            $cle = (int) $ligne['option_id'];

            if (!isset($options[$cle])) {
                $options[$cle] = ['nom' => $ligne['option_nom'], 'valeurs' => []];
            }

            if ($ligne['valeur_id'] !== null) {
                $options[$cle]['valeurs'][] = $ligne['valeur'];
            }
        }

        $indices = array_flip(array_keys($options));   // id d'option -> position

        // Valeur choisie par chaque variante pour chaque option.
        $choix = $this->pdo->prepare(
            'SELECT variante_valeur.variante_id, valeur_option.option_id, valeur_option.valeur
               FROM variante_valeur
         INNER JOIN valeur_option ON valeur_option.id = variante_valeur.valeur_id
         INNER JOIN variante ON variante.id = variante_valeur.variante_id
              WHERE variante.produit_id = :id'
        );
        $choix->execute([':id' => $id]);

        $valeursDeVariante = [];

        foreach ($choix->fetchAll() as $ligne) {
            $position = $indices[(int) $ligne['option_id']] ?? null;

            if ($position !== null) {
                $valeursDeVariante[(int) $ligne['variante_id']][$position] = $ligne['valeur'];
            }
        }

        $variantes = [];
        $liste     = $this->pdo->prepare(
            'SELECT id, reference, nom, prix, stock, est_defaut FROM variante WHERE produit_id = :id ORDER BY id'
        );
        $liste->execute([':id' => $id]);

        foreach ($liste->fetchAll() as $ligne) {
            $valeurs = [];

            foreach (array_keys($options) as $position => $_) {
                $valeurs[] = $valeursDeVariante[(int) $ligne['id']][$position] ?? '';
            }

            $variantes[] = [
                'id'        => (int) $ligne['id'],
                'reference' => $ligne['reference'],
                'nom'       => $ligne['nom'],
                'prix'      => $ligne['prix'],
                'stock'     => (int) $ligne['stock'],
                'defaut'    => (int) $ligne['est_defaut'] === 1,
                'valeurs'   => $valeurs,
            ];
        }

        $produit['options']   = array_values($options);
        $produit['variantes'] = $variantes;

        return $produit;
    }

    /**
     * Crée (id null) ou modifie un produit, avec ses options et ses variantes,
     * en une seule transaction : tout est enregistré, ou rien.
     *
     * Les options sont recréées à chaque enregistrement ; les variantes déjà
     * connues (par leur id) sont mises à jour, ce qui garde les paniers et les
     * images qui s'y réfèrent. Celles qui ne sont plus envoyées sont supprimées.
     * Toute modification de stock est écrite au journal (motif « ajustement »).
     *
     * @param array $produit  données déjà validées par le contrôleur :
     *        categorie_id, nom, slug (création seulement), accroche, description,
     *        caracteristiques, options [{nom, valeurs[]}], variantes
     *        [{id?, reference, nom, prix, stock, defaut, valeurs[]}]
     * @return int|array{doublon: string}  l'identifiant du produit, ou le champ
     *         en doublon (« nom », « slug » ou « reference:XXX »)
     */
    public function enregistrer(?int $id, array $produit): int|array
    {
        $this->pdo->beginTransaction();

        try {
            if ($id === null) {
                $this->pdo->prepare(
                    'INSERT INTO produit (categorie_id, nom, slug, accroche, description, caracteristiques, prix)
                     VALUES (:categorie, :nom, :slug, :accroche, :description, :caracteristiques, 0)'
                )->execute([
                    ':categorie'        => $produit['categorie_id'],
                    ':nom'              => $produit['nom'],
                    ':slug'             => $produit['slug'],
                    ':accroche'         => $produit['accroche'],
                    ':description'      => $produit['description'],
                    ':caracteristiques' => $produit['caracteristiques'],
                ]);
                $id = (int) $this->pdo->lastInsertId();
            } else {
                $this->pdo->prepare(
                    'UPDATE produit
                        SET categorie_id = :categorie, nom = :nom, accroche = :accroche,
                            description = :description, caracteristiques = :caracteristiques
                      WHERE id = :id'
                )->execute([
                    ':categorie'        => $produit['categorie_id'],
                    ':nom'              => $produit['nom'],
                    ':accroche'         => $produit['accroche'],
                    ':description'      => $produit['description'],
                    ':caracteristiques' => $produit['caracteristiques'],
                    ':id'               => $id,
                ]);
            }

            $valeurIds = $this->recreerOptions($id, $produit['options']);
            $this->enregistrerVariantes($id, $produit['variantes'], $valeurIds);

            $this->pdo->prepare(
                'UPDATE produit SET prix = (SELECT MIN(prix) FROM variante WHERE produit_id = :variantes) WHERE id = :id'
            )->execute([':variantes' => $id, ':id' => $id]);

            $this->pdo->commit();
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            if ($e instanceof PDOException && ($e->errorInfo[1] ?? 0) === self::ERREUR_DOUBLON) {
                return ['doublon' => self::champEnDoublon((string) ($e->errorInfo[2] ?? ''))];
            }

            throw $e;
        }

        return $id;
    }

    /**
     * Supprime un produit (ses options, variantes et images en base partent avec
     * lui). Les commandes passées gardent leur copie du produit.
     *
     * @return string[]|null  les chemins des fichiers d'images qui étaient
     *         rattachés au produit (à effacer par l'appelant), ou null si le
     *         produit n'existe pas
     */
    public function supprimer(int $id): ?array
    {
        $chemins = $this->pdo->prepare(
            'SELECT chemin_moyen, chemin_grand FROM image_produit WHERE produit_id = :id'
        );
        $chemins->execute([':id' => $id]);

        $fichiers = [];

        foreach ($chemins->fetchAll() as $ligne) {
            $fichiers[] = $ligne['chemin_moyen'];
            $fichiers[] = $ligne['chemin_grand'];
        }

        $requete = $this->pdo->prepare('DELETE FROM produit WHERE id = :id');
        $requete->execute([':id' => $id]);

        return $requete->rowCount() === 1 ? array_values(array_unique($fichiers)) : null;
    }

    /**
     * Supprime les options du produit et les recrée. Renvoie, pour chaque option
     * (par position) et chaque texte de valeur en minuscules, l'identifiant de la
     * valeur créée.
     *
     * @return array<int, array<string, int>>
     */
    private function recreerOptions(int $produitId, array $options): array
    {
        $this->pdo->prepare('DELETE FROM option_produit WHERE produit_id = :id')->execute([':id' => $produitId]);

        $insererOption = $this->pdo->prepare(
            'INSERT INTO option_produit (produit_id, nom, ordre) VALUES (:produit, :nom, :ordre)'
        );
        $insererValeur = $this->pdo->prepare(
            'INSERT INTO valeur_option (option_id, valeur, ordre) VALUES (:option, :valeur, :ordre)'
        );

        $ids = [];

        foreach ($options as $position => $option) {
            $insererOption->execute([':produit' => $produitId, ':nom' => $option['nom'], ':ordre' => $position + 1]);
            $optionId = (int) $this->pdo->lastInsertId();

            foreach ($option['valeurs'] as $rang => $valeur) {
                $insererValeur->execute([':option' => $optionId, ':valeur' => $valeur, ':ordre' => $rang + 1]);
                $ids[$position][mb_strtolower($valeur)] = (int) $this->pdo->lastInsertId();
            }
        }

        return $ids;
    }

    /**
     * Met à jour les variantes connues, crée les nouvelles, supprime les absentes,
     * puis relie chaque variante à ses valeurs d'options.
     *
     * @param array<int, array<string, int>> $valeurIds  voir recreerOptions()
     */
    private function enregistrerVariantes(int $produitId, array $variantes, array $valeurIds): void
    {
        // Les variantes existantes sont verrouillées : leur stock ne bouge pas
        // pendant qu'on calcule l'écart à journaliser.
        $existantes = $this->pdo->prepare('SELECT id, stock FROM variante WHERE produit_id = :id FOR UPDATE');
        $existantes->execute([':id' => $produitId]);
        $stocks = $existantes->fetchAll(PDO::FETCH_KEY_PAIR);   // id => stock

        $gardees = [];

        foreach ($variantes as $variante) {
            $parametres = [
                ':reference' => $variante['reference'],
                ':nom'       => $variante['nom'],
                ':prix'      => $variante['prix'],
                ':stock'     => $variante['stock'],
                ':defaut'    => $variante['defaut'] ? 1 : 0,
            ];

            if (isset($variante['id']) && array_key_exists($variante['id'], $stocks)) {
                $varianteId = $variante['id'];

                $this->pdo->prepare(
                    'UPDATE variante
                        SET reference = :reference, nom = :nom, prix = :prix, stock = :stock, est_defaut = :defaut
                      WHERE id = :id'
                )->execute($parametres + [':id' => $varianteId]);

                $this->journaliser($varianteId, $variante['stock'] - (int) $stocks[$varianteId]);
            } else {
                $this->pdo->prepare(
                    'INSERT INTO variante (produit_id, reference, nom, prix, stock, est_defaut)
                     VALUES (:produit, :reference, :nom, :prix, :stock, :defaut)'
                )->execute($parametres + [':produit' => $produitId]);

                $varianteId = (int) $this->pdo->lastInsertId();
                $this->journaliser($varianteId, $variante['stock']);
            }

            $gardees[] = $varianteId;

            // Les liens de la variante avec ses valeurs sont refaits (ils ont pu
            // disparaître avec les anciennes valeurs d'options).
            $this->pdo->prepare('DELETE FROM variante_valeur WHERE variante_id = :id')->execute([':id' => $varianteId]);

            foreach ($variante['valeurs'] as $position => $texte) {
                $this->pdo->prepare(
                    'INSERT INTO variante_valeur (variante_id, valeur_id) VALUES (:variante, :valeur)'
                )->execute([':variante' => $varianteId, ':valeur' => $valeurIds[$position][mb_strtolower($texte)]]);
            }
        }

        foreach (array_keys($stocks) as $ancienne) {
            if (!in_array($ancienne, $gardees, true)) {
                $this->pdo->prepare('DELETE FROM variante WHERE id = :id')->execute([':id' => $ancienne]);
            }
        }
    }

    /**
     * Écrit un ajustement de stock au journal ; ne fait rien si l'écart est nul.
     */
    private function journaliser(int $varianteId, int $ecart): void
    {
        if ($ecart === 0) {
            return;
        }

        $this->pdo->prepare(
            "INSERT INTO mouvement_stock (variante_id, quantite, motif, commande_id)
             VALUES (:variante, :quantite, 'ajustement', NULL)"
        )->execute([':variante' => $varianteId, ':quantite' => $ecart]);
    }

    /**
     * Quel champ a causé l'erreur de doublon, d'après le message de MySQL.
     */
    private static function champEnDoublon(string $message): string
    {
        if (str_contains($message, 'uq_produit_slug')) {
            return 'slug';
        }

        if (str_contains($message, 'uq_variante_reference')) {
            // Le message contient « Duplicate entry 'REF' for key … » : on en tire la référence.
            return preg_match("/Duplicate entry '(.*)' for key/u", $message, $m) === 1 ? 'reference:' . $m[1] : 'reference:';
        }

        if (str_contains($message, 'uq_produit_nom')) {
            return 'nom';
        }

        return 'autre';
    }
}
