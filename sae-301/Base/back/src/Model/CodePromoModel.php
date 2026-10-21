<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

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
}
