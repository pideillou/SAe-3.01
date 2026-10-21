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

    /** Les statuts d'une commande, dans l'ordre de son déroulement. */
    public const STATUTS = ['en cours', 'disponible', 'retirée', 'annulée'];

    /** Longueur de la partie aléatoire du numéro. */
    private const LONGUEUR_ALEATOIRE = 6;

    /** Nombre d'essais si un numéro tiré existe déjà. */
    private const ESSAIS_NUMERO = 5;

    /** Code d'erreur MySQL « entrée en double » (index UNIQUE). */
    private const ERREUR_DOUBLON = 1062;

    /**
     * Passages de statut permis : une commande avance de « en cours » à
     * « disponible » puis « retirée », et peut être annulée tant qu'elle n'est pas
     * retirée. « retirée » et « annulée » sont définitifs.
     */
    private const TRANSITIONS = [
        'en cours'   => ['disponible', 'annulée'],
        'disponible' => ['retirée', 'annulée'],
        'retirée'    => [],
        'annulée'    => [],
    ];

    /**
     * Critères de tri du back-office : le nom demandé par le front et la colonne
     * SQL qu'il désigne. Seules ces colonnes, écrites ici, entrent dans la requête.
     */
    private const TRIS = [
        'date'    => 'commande.cree_le',
        'statut'  => 'commande.statut',
        'montant' => 'commande.total',
        'numero'  => 'commande.numero',
    ];

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
                            (commande_id, variante_id, produit_nom, produit_slug, variante_nom, options, image, prix_unitaire, quantite)
                     VALUES (:commande, :variante, :produit_nom, :produit_slug, :variante_nom, :options, :image, :prix, :quantite)'
                )->execute([
                    ':commande'     => $commandeId,
                    ':variante'     => $id,
                    ':produit_nom'  => $variante['produit_nom'],
                    ':produit_slug' => $variante['produit_slug'],
                    ':variante_nom' => $variante['nom'],
                    ':options'      => $variante['options'],
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
            'SELECT produit_nom, produit_slug, variante_nom, options, image, prix_unitaire, quantite
               FROM ligne_commande
              WHERE commande_id = :commande
           ORDER BY id'
        );
        $lignes->execute([':commande' => $commande['id']]);

        $commande['lignes'] = $lignes->fetchAll();

        return $commande;
    }

    /**
     * L'historique des commandes d'un client, de la plus récente à la plus
     * ancienne, avec les lignes de chaque commande (nom, options, quantité).
     * Une page à la fois ; le filtre par statut et par période est facultatif.
     *
     * @param string|null $statut  ne garde que ce statut ; null pour tous
     * @param string|null $du      première date incluse (AAAA-MM-JJ), ou null
     * @param string|null $au      dernière date incluse (AAAA-MM-JJ), ou null
     * @return array{commandes: array<int, array>, total: int}  total : nombre de
     *         commandes correspondant au filtre, toutes pages confondues
     */
    public function listerPourClient(int $utilisateurId, ?string $statut, ?string $du, ?string $au, int $limite, int $decalage): array
    {
        $conditions = ['commande.utilisateur_id = :utilisateur'];
        $valeurs    = [':utilisateur' => $utilisateurId];

        if ($statut !== null && isset(self::TRANSITIONS[$statut])) {
            $conditions[]       = 'commande.statut = :statut';
            $valeurs[':statut'] = $statut;
        }

        if ($du !== null) {
            $conditions[]    = 'commande.cree_le >= :du';
            $valeurs[':du']  = $du . ' 00:00:00';
        }

        if ($au !== null) {
            // Le jour entier : strictement avant minuit du lendemain.
            $conditions[]    = 'commande.cree_le < DATE_ADD(:au, INTERVAL 1 DAY)';
            $valeurs[':au']  = $au;
        }

        $where = implode(' AND ', $conditions);

        $compte = $this->pdo->prepare("SELECT COUNT(*) FROM commande WHERE {$where}");
        $compte->execute($valeurs);
        $total = (int) $compte->fetchColumn();

        $requete = $this->pdo->prepare(
            "SELECT commande.id, commande.numero, commande.statut, commande.total, commande.cree_le
               FROM commande
              WHERE {$where}
           ORDER BY commande.cree_le DESC, commande.id DESC
              LIMIT :limite OFFSET :decalage"
        );

        foreach ($valeurs as $cle => $valeur) {
            $requete->bindValue($cle, $valeur);
        }

        $requete->bindValue(':limite', $limite, PDO::PARAM_INT);
        $requete->bindValue(':decalage', $decalage, PDO::PARAM_INT);
        $requete->execute();

        $commandes = $requete->fetchAll();

        foreach ($commandes as &$commande) {
            $commande['lignes'] = [];
        }
        unset($commande);

        if ($commandes !== []) {
            $ids          = array_column($commandes, 'id');
            $emplacements = implode(',', array_fill(0, count($ids), '?'));

            $lignes = $this->pdo->prepare(
                "SELECT commande_id, produit_nom, variante_nom, options, quantite
                   FROM ligne_commande
                  WHERE commande_id IN ({$emplacements})
               ORDER BY id"
            );
            $lignes->execute($ids);

            $parCommande = [];
            foreach ($lignes->fetchAll() as $ligne) {
                $parCommande[(int) $ligne['commande_id']][] = $ligne;
            }

            foreach ($commandes as &$commande) {
                $commande['lignes'] = $parCommande[(int) $commande['id']] ?? [];
            }
            unset($commande);
        }

        return ['commandes' => $commandes, 'total' => $total];
    }

    /**
     * Les lignes d'une commande du client, telles qu'elles ont été enregistrées,
     * pour la commander à nouveau (SUI-a) : variante (null si elle a été
     * supprimée depuis), nom, options, prix et quantité de l'époque. Une
     * commande qui n'est pas celle du client est une commande inconnue (null).
     *
     * @return array<int, array>|null  une entrée par variante : les lignes d'une
     *         même variante sont additionnées
     */
    public function lignesPourRecommander(string $numero, int $utilisateurId): ?array
    {
        $requete = $this->pdo->prepare('SELECT id FROM commande WHERE numero = :numero AND utilisateur_id = :utilisateur');
        $requete->execute([':numero' => $numero, ':utilisateur' => $utilisateurId]);

        $commandeId = $requete->fetchColumn();

        if ($commandeId === false) {
            return null;
        }

        $lignes = $this->pdo->prepare(
            'SELECT variante_id, produit_nom, variante_nom, prix_unitaire, quantite
               FROM ligne_commande
              WHERE commande_id = :commande
           ORDER BY id'
        );
        $lignes->execute([':commande' => $commandeId]);

        $resultat = [];

        foreach ($lignes->fetchAll() as $ligne) {
            // Une variante supprimée (id NULL) n'a pas de clé commune : une entrée chacune.
            $cle = $ligne['variante_id'] === null ? 'x' . count($resultat) : (int) $ligne['variante_id'];

            if (isset($resultat[$cle])) {
                $resultat[$cle]['quantite'] += (int) $ligne['quantite'];
                continue;
            }

            $resultat[$cle] = [
                'variante_id'   => $ligne['variante_id'] === null ? null : (int) $ligne['variante_id'],
                'produit_nom'   => $ligne['produit_nom'],
                'variante_nom'  => $ligne['variante_nom'],
                'prix_unitaire' => $ligne['prix_unitaire'],
                'quantite'      => (int) $ligne['quantite'],
            ];
        }

        return array_values($resultat);
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
     * L'heure de la base de données. Les dates des commandes viennent d'elle :
     * c'est la même horloge qu'il faut pour dater les statistiques (celle de PHP
     * peut être réglée sur un autre fuseau).
     */
    public function maintenant(): string
    {
        return (string) $this->pdo->query('SELECT NOW()')->fetchColumn();
    }

    /**
     * Nombre de commandes par statut, y compris les statuts sans commande (0).
     *
     * @return array<string, int>  indexé par statut, dans l'ordre du déroulement
     */
    public function compterParStatut(): array
    {
        $comptes = array_fill_keys(self::STATUTS, 0);

        foreach ($this->pdo->query('SELECT statut, COUNT(*) AS nombre FROM commande GROUP BY statut')->fetchAll() as $ligne) {
            $comptes[$ligne['statut']] = (int) $ligne['nombre'];
        }

        return $comptes;
    }

    /**
     * Les revenus des 7 derniers jours (aujourd'hui compris), un jour par ligne,
     * du plus ancien au plus récent. Un jour sans commande vaut 0. Les commandes
     * annulées ne comptent pas : elles n'ont rapporté rien.
     *
     * @return array<int, array{date: string, commandes: int, revenu: string}>
     *         revenu : montant en euros, chaîne à deux décimales
     */
    public function revenusDesSeptDerniersJours(): array
    {
        $aujourdhui = $this->pdo->query('SELECT CURDATE()')->fetchColumn();

        $lignes = $this->pdo->query(
            "SELECT DATE(cree_le) AS jour, COUNT(*) AS commandes, SUM(total) AS revenu
               FROM commande
              WHERE statut <> 'annulée' AND cree_le >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
           GROUP BY DATE(cree_le)"
        )->fetchAll();

        $parJour = [];
        foreach ($lignes as $ligne) {
            $parJour[$ligne['jour']] = $ligne;
        }

        $jours = [];
        for ($i = 6; $i >= 0; $i--) {
            $date    = (new \DateTimeImmutable($aujourdhui))->modify("-$i day")->format('Y-m-d');
            $jours[] = [
                'date'      => $date,
                'commandes' => (int) ($parJour[$date]['commandes'] ?? 0),
                'revenu'    => number_format((float) ($parJour[$date]['revenu'] ?? 0), 2, '.', ''),
            ];
        }

        return $jours;
    }

    /**
     * Les produits les plus vendus : unités vendues et chiffre d'affaires, hors
     * commandes annulées. Les lignes gardent le nom du produit au moment de la
     * commande : un produit supprimé depuis reste dans le classement.
     *
     * @return array<int, array{produit: string, unites: int, chiffreAffaires: string}>
     */
    public function produitsLesPlusVendus(int $limite): array
    {
        $requete = $this->pdo->prepare(
            "SELECT ligne_commande.produit_nom AS produit,
                    SUM(ligne_commande.quantite) AS unites,
                    SUM(ligne_commande.quantite * ligne_commande.prix_unitaire) AS chiffre
               FROM ligne_commande
         INNER JOIN commande ON commande.id = ligne_commande.commande_id
              WHERE commande.statut <> 'annulée'
           GROUP BY ligne_commande.produit_nom
           ORDER BY unites DESC, chiffre DESC, produit
              LIMIT :limite"
        );
        $requete->bindValue(':limite', $limite, PDO::PARAM_INT);
        $requete->execute();

        return array_map(static fn (array $l): array => [
            'produit'         => $l['produit'],
            'unites'          => (int) $l['unites'],
            'chiffreAffaires' => number_format((float) $l['chiffre'], 2, '.', ''),
        ], $requete->fetchAll());
    }

    /**
     * Les commandes de tous les clients pour le back-office, triées et
     * éventuellement filtrées par statut. Limité aux plus récentes selon le tri :
     * la liste reste légère.
     *
     * @param string      $tri     « date », « statut », « montant » ou « numero » (sinon « date »)
     * @param string      $sens    « asc » ou « desc » (sinon « desc »)
     * @param string|null $statut  ne garde que ce statut ; null pour tous
     * @return array<int, array{numero: string, statut: string, total: string,
     *                          cree_le: string, email: string, articles: string}>
     */
    public function listerPourAdmin(string $tri, string $sens, ?string $statut, int $limite): array
    {
        $colonne = self::TRIS[$tri] ?? self::TRIS['date'];
        $sens    = strtolower($sens) === 'asc' ? 'ASC' : 'DESC';
        $filtre  = $statut !== null && isset(self::TRANSITIONS[$statut]) ? 'WHERE commande.statut = :statut' : '';

        $requete = $this->pdo->prepare(
            "SELECT commande.numero, commande.statut, commande.total, commande.cree_le,
                    utilisateur.email,
                    (SELECT COALESCE(SUM(ligne_commande.quantite), 0)
                       FROM ligne_commande
                      WHERE ligne_commande.commande_id = commande.id) AS articles
               FROM commande
         INNER JOIN utilisateur ON utilisateur.id = commande.utilisateur_id
                {$filtre}
           ORDER BY {$colonne} {$sens}, commande.id DESC
              LIMIT :limite"
        );

        if ($filtre !== '') {
            $requete->bindValue(':statut', $statut);
        }

        $requete->bindValue(':limite', $limite, PDO::PARAM_INT);
        $requete->execute();

        return $requete->fetchAll();
    }

    /**
     * Le détail complet d'une commande pour le back-office : le client, les
     * lignes et le journal des modifications faites par les administrateurs.
     * Contrairement à trouverParNumero(), aucune limite au propriétaire : seul un
     * administrateur appelle cette méthode.
     */
    public function trouverPourAdmin(string $numero): ?array
    {
        $requete = $this->pdo->prepare(
            'SELECT commande.id, commande.numero, commande.statut, commande.total, commande.cree_le,
                    utilisateur.email
               FROM commande
         INNER JOIN utilisateur ON utilisateur.id = commande.utilisateur_id
              WHERE commande.numero = :numero'
        );
        $requete->execute([':numero' => $numero]);

        $commande = $requete->fetch();

        if ($commande === false) {
            return null;
        }

        $lignes = $this->pdo->prepare(
            'SELECT produit_nom, produit_slug, variante_nom, options, image, prix_unitaire, quantite
               FROM ligne_commande WHERE commande_id = :commande ORDER BY id'
        );
        $lignes->execute([':commande' => $commande['id']]);
        $commande['lignes'] = $lignes->fetchAll();

        $journal = $this->pdo->prepare(
            'SELECT administrateur_email, ancien_statut, nouveau_statut, cree_le
               FROM journal_commande WHERE commande_id = :commande ORDER BY id DESC'
        );
        $journal->execute([':commande' => $commande['id']]);
        $commande['journal'] = $journal->fetchAll();

        return $commande;
    }

    /**
     * Les statuts que peut prendre une commande depuis son statut actuel.
     *
     * @return string[]
     */
    public static function statutsSuivants(string $statut): array
    {
        return self::TRANSITIONS[$statut] ?? [];
    }

    /**
     * Change le statut d'une commande, en une seule transaction : la commande est
     * verrouillée, le passage est contrôlé, le stock est remis en rayon si la
     * commande est annulée (et seulement dans ce cas), et la modification est
     * écrite au journal avec l'administrateur qui l'a faite.
     *
     * Le contrôle se fait sur la commande verrouillée : deux annulations
     * simultanées ne remettent donc jamais le stock deux fois.
     *
     * @throws StatutInterditException  commande inconnue, ou passage non permis
     */
    public function changerStatut(string $numero, string $nouveau, int $administrateurId, string $administrateurEmail): void
    {
        $this->pdo->beginTransaction();

        try {
            $requete = $this->pdo->prepare('SELECT id, statut FROM commande WHERE numero = :numero FOR UPDATE');
            $requete->execute([':numero' => $numero]);
            $commande = $requete->fetch();

            if ($commande === false) {
                throw new StatutInterditException('Commande introuvable.');
            }

            $ancien = $commande['statut'];

            if (!in_array($nouveau, self::TRANSITIONS[$ancien] ?? [], true)) {
                throw new StatutInterditException(
                    $ancien === 'retirée' || $ancien === 'annulée'
                        ? sprintf('La commande %s est déjà « %s » : son statut ne peut plus changer.', $numero, $ancien)
                        : sprintf('La commande %s ne peut pas passer de « %s » à « %s ».', $numero, $ancien, $nouveau)
                );
            }

            if ($nouveau === 'annulée') {
                $this->remettreEnStock((int) $commande['id']);
            }

            $this->pdo->prepare('UPDATE commande SET statut = :statut WHERE id = :id')
                ->execute([':statut' => $nouveau, ':id' => $commande['id']]);

            $this->pdo->prepare(
                'INSERT INTO journal_commande (commande_id, administrateur_id, administrateur_email, ancien_statut, nouveau_statut)
                 VALUES (:commande, :administrateur, :email, :ancien, :nouveau)'
            )->execute([
                ':commande'       => $commande['id'],
                ':administrateur' => $administrateurId,
                ':email'          => $administrateurEmail,
                ':ancien'         => $ancien,
                ':nouveau'        => $nouveau,
            ]);

            $this->pdo->commit();
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Recrédite le stock des variantes d'une commande annulée et l'écrit au
     * journal des mouvements. Une ligne dont la variante a été supprimée depuis
     * n'a plus de stock à recréditer : elle est ignorée.
     *
     * Les variantes sont traitées dans l'ordre de leur identifiant, comme à la
     * validation d'une commande : deux traitements simultanés ne se bloquent pas.
     */
    private function remettreEnStock(int $commandeId): void
    {
        $lignes = $this->pdo->prepare(
            'SELECT variante_id, SUM(quantite) AS quantite
               FROM ligne_commande
              WHERE commande_id = :commande AND variante_id IS NOT NULL
           GROUP BY variante_id
           ORDER BY variante_id'
        );
        $lignes->execute([':commande' => $commandeId]);

        $maj      = $this->pdo->prepare('UPDATE variante SET stock = stock + :quantite WHERE id = :id');
        $mouvement = $this->pdo->prepare(
            "INSERT INTO mouvement_stock (variante_id, quantite, motif, commande_id)
             VALUES (:variante, :quantite, 'annulation', :commande)"
        );

        foreach ($lignes->fetchAll() as $ligne) {
            $maj->execute([':quantite' => $ligne['quantite'], ':id' => $ligne['variante_id']]);
            $mouvement->execute([
                ':variante' => $ligne['variante_id'],
                ':quantite' => $ligne['quantite'],
                ':commande' => $commandeId,
            ]);
        }
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
                    " . ProduitModel::SQL_OPTIONS_VARIANTE . " AS options,
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
