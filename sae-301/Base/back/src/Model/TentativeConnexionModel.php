<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Limitation des tentatives de connexion (anti force brute).
 *
 * Chaque échec est enregistré sous une clé : l'empreinte de ce qui est visé
 * (adresse e-mail, ou compte) et de l'adresse IP de l'appelant. Au-delà de
 * ECHECS_MAX échecs dans la fenêtre, la connexion est refusée un moment, même
 * avec le bon mot de passe. Un attaquant qui change d'adresse e-mail ou d'IP
 * change de clé : la limite protège chaque compte contre une série d'essais
 * venant d'une même source, sans permettre de bloquer le compte d'un autre
 * depuis une autre adresse IP.
 */
final class TentativeConnexionModel
{
    /** Échecs tolérés dans la fenêtre. */
    public const ECHECS_MAX = 8;

    /** Durée de la fenêtre, en secondes (15 minutes). */
    public const FENETRE = 900;

    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * La clé d'une série de tentatives : elle ne contient ni l'adresse e-mail ni
     * l'adresse IP en clair.
     */
    public static function cle(string $type, string $cible, string $ip): string
    {
        return hash('sha256', $type . '|' . mb_strtolower($cible) . '|' . $ip);
    }

    /**
     * Vrai si la clé a atteint la limite d'échecs dans la fenêtre.
     */
    public function bloquee(string $cle): bool
    {
        $requete = $this->pdo->prepare(
            'SELECT COUNT(*) FROM tentative_connexion
              WHERE cle = :cle AND cree_le > DATE_SUB(NOW(), INTERVAL ' . self::FENETRE . ' SECOND)'
        );
        $requete->execute([':cle' => $cle]);

        return (int) $requete->fetchColumn() >= self::ECHECS_MAX;
    }

    /**
     * Note un échec, et efface au passage les lignes de plus d'un jour.
     */
    public function enregistrerEchec(string $cle): void
    {
        $this->pdo->prepare('INSERT INTO tentative_connexion (cle) VALUES (:cle)')->execute([':cle' => $cle]);
        $this->pdo->exec('DELETE FROM tentative_connexion WHERE cree_le < DATE_SUB(NOW(), INTERVAL 1 DAY)');
    }

    /**
     * Efface les échecs d'une clé après une connexion réussie.
     */
    public function oublier(string $cle): void
    {
        $this->pdo->prepare('DELETE FROM tentative_connexion WHERE cle = :cle')->execute([':cle' => $cle]);
    }
}
