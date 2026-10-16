<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux comptes administrateurs (table administrateur), distincte de celle
 * des clients. Les administrateurs sont créés en base, jamais par le site.
 */
final class AdministrateurModel
{
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
            'SELECT id, email, mot_de_passe FROM administrateur WHERE email = :email'
        );
        $requete->execute([':email' => $email]);

        $compte = $requete->fetch();

        return $compte === false ? null : $compte;
    }
}
