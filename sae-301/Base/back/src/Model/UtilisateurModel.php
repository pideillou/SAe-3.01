<?php

declare(strict_types=1);

namespace App\Model;

use PDO;
use PDOException;

/**
 * Accès aux comptes clients (table utilisateur).
 */
final class UtilisateurModel
{
    /** Code SQLSTATE d'une violation de contrainte (ici, l'index UNIQUE de l'e-mail). */
    private const CONTRAINTE_VIOLEE = '23000';

    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Le compte portant cet e-mail (id, email, mot_de_passe), ou null.
     */
    public function trouverParEmail(string $email): ?array
    {
        $requete = $this->pdo->prepare(
            'SELECT id, email, mot_de_passe FROM utilisateur WHERE email = :email'
        );
        $requete->execute([':email' => $email]);

        $compte = $requete->fetch();

        return $compte === false ? null : $compte;
    }

    /**
     * Crée un compte à partir de l'empreinte du mot de passe (jamais du mot de
     * passe lui-même) et renvoie son identifiant, ou null si l'e-mail est déjà
     * pris. C'est l'index UNIQUE de la base qui tranche : deux inscriptions
     * simultanées avec la même adresse ne créent qu'un seul compte.
     */
    public function creer(string $email, string $empreinte): ?int
    {
        try {
            $requete = $this->pdo->prepare(
                'INSERT INTO utilisateur (email, mot_de_passe) VALUES (:email, :empreinte)'
            );
            $requete->execute([':email' => $email, ':empreinte' => $empreinte]);
        } catch (PDOException $e) {
            if ($e->getCode() === self::CONTRAINTE_VIOLEE) {
                return null;
            }
            throw $e;
        }

        return (int) $this->pdo->lastInsertId();
    }
}
