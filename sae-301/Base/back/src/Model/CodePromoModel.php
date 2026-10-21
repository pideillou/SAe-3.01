<?php

declare(strict_types=1);

namespace App\Model;

use PDO;
use PDOException;

/**
 * Accès aux codes promotionnels (table code_promo, PRO-a).
 */
final class CodePromoModel
{
    /** Forme d'un code : lettres, chiffres, tiret et tiret bas, 2 à 30 caractères. */
    private const FORMAT = '/^[A-Z0-9_-]{2,30}$/';

    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Le code saisi par le client, mis en forme (espaces retirés, majuscules),
     * ou null s'il ne ressemble pas à un code : inutile alors d'interroger la base.
     */
    public static function normaliser(mixed $saisie): ?string
    {
        if (!is_string($saisie)) {
            return null;
        }

        $code = mb_strtoupper(trim($saisie));

        return preg_match(self::FORMAT, $code) === 1 ? $code : null;
    }

    /**
     * Le code actif portant ce nom (code, pourcentage), ou null s'il n'existe
     * pas ou s'il a été désactivé. Les deux cas se confondent exprès : le client
     * ne doit pas pouvoir deviner les codes qui existent.
     */
    public function trouverActif(string $code): ?array
    {
        $requete = $this->pdo->prepare('SELECT code, pourcentage FROM code_promo WHERE code = :code AND actif = 1');
        $requete->execute([':code' => $code]);

        $ligne = $requete->fetch();

        return $ligne === false ? null : ['code' => $ligne['code'], 'pourcentage' => (int) $ligne['pourcentage']];
    }

    /** Code SQLSTATE d'une violation de contrainte (ici, l'index UNIQUE du code). */
    private const CONTRAINTE_VIOLEE = '23000';

    /**
     * Tous les codes, avec leurs statistiques d'utilisation (PRO-b), les actifs
     * et les plus utilisés d'abord. Les commandes annulées ne comptent pas dans
     * les utilisations ni dans les montants : elles sont comptées à part.
     *
     * Le lien entre un code et ses commandes est le texte du code, enregistré
     * dans la commande : un code supprimé laisse ses commandes intactes.
     *
     * @return array<int, array{id: int, code: string, pourcentage: int, actif: bool,
     *         creeLe: string, utilisations: int, annulees: int,
     *         reductionTotale: string, chiffreAffaires: string}>
     */
    public function listerPourAdmin(): array
    {
        $lignes = $this->pdo->query(
            "SELECT code_promo.id, code_promo.code, code_promo.pourcentage, code_promo.actif, code_promo.cree_le,
                    COALESCE(SUM(commande.id IS NOT NULL AND commande.statut <> 'annulée'), 0) AS utilisations,
                    COALESCE(SUM(commande.statut = 'annulée'), 0) AS annulees,
                    COALESCE(SUM(CASE WHEN commande.statut <> 'annulée' THEN commande.reduction_montant END), 0) AS reduction_totale,
                    COALESCE(SUM(CASE WHEN commande.statut <> 'annulée' THEN commande.total END), 0) AS chiffre_affaires
               FROM code_promo
          LEFT JOIN commande ON commande.code_promo = code_promo.code
           GROUP BY code_promo.id, code_promo.code, code_promo.pourcentage, code_promo.actif, code_promo.cree_le
           ORDER BY code_promo.actif DESC, utilisations DESC, code_promo.code"
        )->fetchAll();

        return array_map(static fn (array $l): array => [
            'id'              => (int) $l['id'],
            'code'            => $l['code'],
            'pourcentage'     => (int) $l['pourcentage'],
            'actif'           => (int) $l['actif'] === 1,
            'creeLe'          => $l['cree_le'],
            'utilisations'    => (int) $l['utilisations'],
            'annulees'        => (int) $l['annulees'],
            'reductionTotale' => number_format((float) $l['reduction_totale'], 2, '.', ''),
            'chiffreAffaires' => number_format((float) $l['chiffre_affaires'], 2, '.', ''),
        ], $lignes);
    }

    /**
     * Le code portant cet identifiant (id, code, pourcentage, actif), ou null.
     */
    public function trouverParId(int $id): ?array
    {
        $requete = $this->pdo->prepare('SELECT id, code, pourcentage, actif FROM code_promo WHERE id = :id');
        $requete->execute([':id' => $id]);

        $ligne = $requete->fetch();

        return $ligne === false ? null : [
            'id'          => (int) $ligne['id'],
            'code'        => $ligne['code'],
            'pourcentage' => (int) $ligne['pourcentage'],
            'actif'       => (int) $ligne['actif'] === 1,
        ];
    }

    /**
     * Crée un code et renvoie son identifiant, ou null si ce code existe déjà
     * (l'index UNIQUE tranche).
     */
    public function creer(string $code, int $pourcentage, bool $actif): ?int
    {
        try {
            $this->pdo->prepare('INSERT INTO code_promo (code, pourcentage, actif) VALUES (:code, :pourcentage, :actif)')
                ->execute([':code' => $code, ':pourcentage' => $pourcentage, ':actif' => $actif ? 1 : 0]);
        } catch (PDOException $e) {
            if ($e->getCode() === self::CONTRAINTE_VIOLEE) {
                return null;
            }
            throw $e;
        }

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Change le pourcentage et l'état d'un code. Le nom du code ne change pas :
     * les commandes déjà passées y sont rattachées par ce nom.
     */
    public function modifier(int $id, int $pourcentage, bool $actif): void
    {
        $this->pdo->prepare('UPDATE code_promo SET pourcentage = :pourcentage, actif = :actif WHERE id = :id')
            ->execute([':pourcentage' => $pourcentage, ':actif' => $actif ? 1 : 0, ':id' => $id]);
    }

    /**
     * Supprime un code. Ses commandes gardent leur réduction (le code y est
     * recopié en toutes lettres).
     */
    public function supprimer(int $id): void
    {
        $this->pdo->prepare('DELETE FROM code_promo WHERE id = :id')->execute([':id' => $id]);
    }
}
