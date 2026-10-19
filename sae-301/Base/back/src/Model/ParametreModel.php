<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux paramètres de l'application (table parametre), par exemple le
 * seuil « Bientôt épuisé ». Ils sont modifiables sans toucher au code.
 */
final class ParametreModel
{
    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * La valeur d'un paramètre, ou $defaut s'il n'existe pas.
     */
    public function valeur(string $cle, string $defaut): string
    {
        $requete = $this->pdo->prepare('SELECT valeur FROM parametre WHERE cle = :cle');
        $requete->execute([':cle' => $cle]);

        $valeur = $requete->fetchColumn();

        return $valeur === false ? $defaut : (string) $valeur;
    }

    /**
     * Enregistre la valeur d'un paramètre existant (par exemple le seuil
     * « Bientôt épuisé »). Un paramètre qui n'existe pas n'est pas créé.
     */
    public function definir(string $cle, string $valeur): bool
    {
        $requete = $this->pdo->prepare('UPDATE parametre SET valeur = :valeur WHERE cle = :cle');
        $requete->execute([':valeur' => $valeur, ':cle' => $cle]);

        // rowCount vaut 0 si la valeur est inchangée : on vérifie l'existence de la clé.
        return $requete->rowCount() === 1 || $this->valeur($cle, "\0absent") !== "\0absent";
    }
}
