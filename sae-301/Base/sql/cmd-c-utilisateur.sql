-- CMD-c : table des comptes clients, à importer SANS réimporter import.sql.
-- import.sql efface et recrée toutes les tables : il remettrait les stocks à
-- zéro et supprimerait les commandes. Ce script ne fait qu'ajouter la table
-- (il est sans effet si elle existe déjà). La même définition figure dans
-- import.sql, pour que la base reste reconstructible.

CREATE TABLE IF NOT EXISTS utilisateur (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    email        VARCHAR(190) NOT NULL,
    mot_de_passe VARCHAR(255) NOT NULL,
    cree_le      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_utilisateur_email (email)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
