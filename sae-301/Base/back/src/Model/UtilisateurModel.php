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
     * Le profil d'un compte (id, email, nom, cree_le), ou null. Sans l'empreinte
     * du mot de passe : elle ne sort jamais de ce modèle que pour être vérifiée.
     */
    public function trouverParId(int $id): ?array
    {
        $requete = $this->pdo->prepare('SELECT id, email, nom, cree_le FROM utilisateur WHERE id = :id');
        $requete->execute([':id' => $id]);

        $compte = $requete->fetch();

        return $compte === false ? null : $compte;
    }

    /**
     * Met à jour le nom et l'e-mail d'un compte. Renvoie false si l'adresse est
     * déjà celle d'un autre compte (l'index UNIQUE tranche).
     */
    public function modifierProfil(int $id, ?string $nom, string $email): bool
    {
        try {
            $this->pdo->prepare('UPDATE utilisateur SET nom = :nom, email = :email WHERE id = :id')
                ->execute([':nom' => $nom, ':email' => $email, ':id' => $id]);
        } catch (PDOException $e) {
            if ($e->getCode() === self::CONTRAINTE_VIOLEE) {
                return false;
            }
            throw $e;
        }

        return true;
    }

    /**
     * L'empreinte du mot de passe d'un compte, pour la vérifier (changement de
     * mot de passe), ou null si le compte n'existe pas.
     */
    public function trouverEmpreinte(int $id): ?string
    {
        $requete = $this->pdo->prepare('SELECT mot_de_passe FROM utilisateur WHERE id = :id');
        $requete->execute([':id' => $id]);

        $empreinte = $requete->fetchColumn();

        return $empreinte === false ? null : $empreinte;
    }

    public function changerMotDePasse(int $id, string $empreinte): void
    {
        $this->pdo->prepare('UPDATE utilisateur SET mot_de_passe = :empreinte WHERE id = :id')
            ->execute([':empreinte' => $empreinte, ':id' => $id]);
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
