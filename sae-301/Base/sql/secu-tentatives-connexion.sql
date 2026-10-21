-- Sécurité : limitation des tentatives de connexion (anti force brute). À
-- importer SANS réimporter import.sql (qui effacerait les commandes). Sans
-- danger si la table existe déjà.
--
-- Chaque échec de connexion (client, administrateur) ou de changement de mot de
-- passe y laisse une ligne. Au-delà de 8 échecs en 15 minutes pour la même
-- clé (empreinte de l'adresse e-mail et de l'adresse IP), la connexion est
-- refusée un moment. Les lignes de plus d'un jour sont effacées au fil de l'eau.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS tentative_connexion (
    id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    cle     CHAR(64)     NOT NULL,
    cree_le DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_tentative_cle (cle, cree_le)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
