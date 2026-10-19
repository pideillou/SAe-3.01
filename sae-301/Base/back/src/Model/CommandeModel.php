<?php

declare(strict_types=1);

namespace App\Model;

use PDO;
use PDOException;
use Throwable;

/**
 * Accès aux commandes (tables commande, ligne_commande) et au journal des
 * mouvements de stock (mouvement_stock).
 */
final class CommandeModel
{
    /** Lettres et chiffres du numéro de commande, sans ceux qui se confondent (0/O, 1/I). */
    private const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    /** Longueur de la partie aléatoire du numéro. */
    private const LONGUEUR_ALEATOIRE = 6;

    /** Nombre d'essais si un numéro tiré existe déjà. */
    private const ESSAIS_NUMERO = 5;

    /** Code d'erreur MySQL « entrée en double » (index UNIQUE). */
    private const ERREUR_DOUBLON = 1062;

    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Enregistre une commande, en une seule transaction : verrou des variantes,
     * contrôle du stock, commande, lignes (avec le prix du moment), décrément du
     * stock et journal. Tout réussit ou rien n'est enregistré.
     *
     * Les prix et les noms viennent de la base, jamais du panier du navigateur.
     *
     * @param array<int, int> $demandes  quantité commandée, indexée par id de variante
     * @return array la commande créée, au format de trouverParNumero()
     * @throws CommandeImpossibleException si le stock ne permet pas la commande
     */
    public function creer(int $utilisateurId, array $demandes): array
    {
        // Toujours verrouiller dans le même ordre : deux commandes simultanées
        // sur les mêmes variantes ne peuvent pas s'attendre l'une l'autre.
        ksort($demandes);

        $this->pdo->beginTransaction();

        try {
            $variantes = $this->verrouillerVariantes(array_keys($demandes));
            $problemes = [];

            foreach ($demandes as $id => $quantite) {
                $variante = $variantes[$id] ?? null;
                $stock    = $variante === null ? 0 : (int) $variante['stock'];

                if ($variante === null) {
                    $problemes[] = ['varianteId' => $id, 'statut' => 'inconnue', 'nom' => null, 'stock' => 0];
                } elseif ($stock <= 0) {
                    $problemes[] = ['varianteId' => $id, 'statut' => 'epuisee', 'nom' => $variante['nom'], 'stock' => 0];
                } elseif ($quantite > $stock) {
                    $problemes[] = ['varianteId' => $id, 'statut' => 'ajustee', 'nom' => $variante['nom'], 'stock' => $stock];
                }
            }

            if ($problemes !== []) {
                // Le catch ci-dessous annule la transaction avant de relancer.
                throw new CommandeImpossibleException($problemes);
            }

            $total = 0;

            foreach ($demandes as $id => $quantite) {
                $total += self::centimes($variantes[$id]['prix']) * $quantite;
            }

            [$commandeId, $numero] = $this->insererCommande($utilisateurId, $total);

            foreach ($demandes as $id => $quantite) {
                $variante = $variantes[$id];

                // Mise à jour conditionnelle : même si un autre traitement avait
                // échappé au verrou, le stock ne peut pas passer sous zéro.
                $maj = $this->pdo->prepare(
                    'UPDATE variante SET stock = stock - :quantite
                      WHERE id = :id AND stock >= :minimum'
                );
                $maj->execute([':quantite' => $quantite, ':id' => $id, ':minimum' => $quantite]);

                if ($maj->rowCount() !== 1) {
                    throw new CommandeImpossibleException([
                        ['varianteId' => $id, 'statut' => 'ajustee', 'nom' => $variante['nom'], 'stock' => 0],
                    ]);
                }

                $this->pdo->prepare(
                    'INSERT INTO ligne_commande
                            (commande_id, variante_id, produit_nom, produit_slug, variante_nom, image, prix_unitaire, quantite)
                     VALUES (:commande, :variante, :produit_nom, :produit_slug, :variante_nom, :image, :prix, :quantite)'
                )->execute([
                    ':commande'     => $commandeId,
                    ':variante'     => $id,
                    ':produit_nom'  => $variante['produit_nom'],
                    ':produit_slug' => $variante['produit_slug'],
                    ':variante_nom' => $variante['nom'],
                    ':image'        => $variante['image'],
                    ':prix'         => $variante['prix'],
                    ':quantite'     => $quantite,
                ]);

                $this->pdo->prepare(
                    "INSERT INTO mouvement_stock (variante_id, quantite, motif, commande_id)
                     VALUES (:variante, :quantite, 'commande', :commande)"
                )->execute([':variante' => $id, ':quantite' => -$quantite, ':commande' => $commandeId]);
            }

            $this->pdo->commit();
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }

        return $this->trouverParNumero($numero, $utilisateurId);
    }

    /**
     * La commande portant ce numéro, si elle appartient à cet utilisateur, avec
     * ses lignes ; sinon null (une commande d'autrui est une commande inconnue).
     */
    public function trouverParNumero(string $numero, int $utilisateurId): ?array
    {
        $requete = $this->pdo->prepare(
            'SELECT commande.id, commande.numero, commande.statut, commande.total, commande.cree_le,
                    utilisateur.email
               FROM commande
         INNER JOIN utilisateur ON utilisateur.id = commande.utilisateur_id
              WHERE commande.numero = :numero AND commande.utilisateur_id = :utilisateur'
        );
        $requete->execute([':numero' => $numero, ':utilisateur' => $utilisateurId]);

        $commande = $requete->fetch();

        if ($commande === false) {
            return null;
        }

        $lignes = $this->pdo->prepare(
            'SELECT produit_nom, produit_slug, variante_nom, image, prix_unitaire, quantite
               FROM ligne_commande
              WHERE commande_id = :commande
           ORDER BY id'
        );
        $lignes->execute([':commande' => $commande['id']]);

        $commande['lignes'] = $lignes->fetchAll();

        return $commande;
    }

    /**
     * Indicateurs du tableau de bord : nombre total de commandes, et celles dont
     * le statut est « en cours ».
     *
     * @return array{total: int, enCours: int}
     */
    public function statistiques(): array
    {
        $ligne = $this->pdo->query(
            "SELECT COUNT(*) AS total,
                    COALESCE(SUM(statut = 'en cours'), 0) AS en_cours
               FROM commande"
        )->fetch();

        // MySQL renvoie les nombres sous forme de chaînes.
        return ['total' => (int) $ligne['total'], 'enCours' => (int) $ligne['en_cours']];
    }

    /**
     * Les commandes de tous les clients, de la plus récente à la plus ancienne,
     * pour le back-office. Limité aux plus récentes : la pagination et les filtres
     * relèvent de la gestion des commandes.
     *
     * @return array<int, array{numero: string, statut: string, total: string,
     *                          cree_le: string, email: string, articles: string}>
     */
    public function listerRecentes(int $limite): array
    {
        $requete = $this->pdo->prepare(
            'SELECT commande.numero, commande.statut, commande.total, commande.cree_le,
                    utilisateur.email,
                    (SELECT COALESCE(SUM(ligne_commande.quantite), 0)
                       FROM ligne_commande
                      WHERE ligne_commande.commande_id = commande.id) AS articles
               FROM commande
         INNER JOIN utilisateur ON utilisateur.id = commande.utilisateur_id
           ORDER BY commande.cree_le DESC, commande.id DESC
              LIMIT :limite'
        );
        $requete->bindValue(':limite', $limite, PDO::PARAM_INT);
        $requete->execute();

        return $requete->fetchAll();
    }

    /**
     * Lit les variantes demandées en les verrouillant jusqu'à la fin de la
     * transaction (SELECT … FOR UPDATE) : personne d'autre ne peut modifier
     * leur stock pendant qu'on le contrôle puis qu'on le décrémente.
     *
     * @param int[] $ids  triés par ordre croissant
     * @return array<int, array>  indexé par id de variante
     */
    private function verrouillerVariantes(array $ids): array
    {
        $emplacements = implode(',', array_fill(0, count($ids), '?'));

        $requete = $this->pdo->prepare(
            "SELECT variante.id,
                    variante.nom,
                    variante.prix,
                    variante.stock,
                    produit.slug AS produit_slug,
                    produit.nom  AS produit_nom,
                    (SELECT COALESCE(
                                (SELECT image_variante.chemin_moyen FROM image_produit AS image_variante
                                  WHERE image_variante.variante_id = variante.id LIMIT 1),
                                (SELECT image_principale.chemin_moyen FROM image_produit AS image_principale
                                  WHERE image_principale.produit_id = produit.id
                                    AND image_principale.variante_id IS NULL
                                    AND image_principale.est_principale = 1 LIMIT 1))) AS image
               FROM variante
         INNER JOIN produit ON produit.id = variante.produit_id
              WHERE variante.id IN ($emplacements)
           ORDER BY variante.id
                FOR UPDATE"
        );
        $requete->execute($ids);

        $variantes = [];

        foreach ($requete->fetchAll() as $ligne) {
            $variantes[(int) $ligne['id']] = $ligne;
        }

        return $variantes;
    }

    /**
     * Insère la commande avec un numéro tiré au hasard et encore inutilisé.
     * C'est l'index UNIQUE de la base qui garantit l'unicité : en cas de
     * collision, on retire un autre numéro.
     *
     * @return array{0: int, 1: string}  identifiant et numéro de la commande
     */
    private function insererCommande(int $utilisateurId, int $totalCentimes): array
    {
        for ($essai = 1; $essai <= self::ESSAIS_NUMERO; $essai++) {
            $numero = self::genererNumero();

            try {
                $this->pdo->prepare(
                    'INSERT INTO commande (numero, utilisateur_id, total) VALUES (:numero, :utilisateur, :total)'
                )->execute([
                    ':numero'      => $numero,
                    ':utilisateur' => $utilisateurId,
                    ':total'       => number_format($totalCentimes / 100, 2, '.', ''),
                ]);

                return [(int) $this->pdo->lastInsertId(), $numero];
            } catch (PDOException $e) {
                if (($e->errorInfo[1] ?? 0) !== self::ERREUR_DOUBLON || $essai === self::ESSAIS_NUMERO) {
                    throw $e;
                }
            }
        }

        // Inatteignable : la boucle renvoie ou lève toujours.
        throw new \LogicException('Numéro de commande non généré.');
    }

    /**
     * RZ-AAAAMMJJ-XXXXXX : la date, puis six caractères tirés avec une source
     * aléatoire sûre (random_int).
     */
    private static function genererNumero(): string
    {
        $hasard = '';

        for ($i = 0; $i < self::LONGUEUR_ALEATOIRE; $i++) {
            $hasard .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
        }

        return 'RZ-' . date('Ymd') . '-' . $hasard;
    }

    /**
     * « 189.99 » -> 18999. Les calculs d'argent se font en centimes entiers.
     */
    private static function centimes(string $prix): int
    {
        return (int) round(((float) $prix) * 100);
    }
}
