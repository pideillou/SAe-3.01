-- PRO-a : codes promotionnels et réduction enregistrée avec chaque commande.
-- À importer SANS réimporter import.sql (qui effacerait les commandes). Sans
-- danger si les éléments existent déjà (MariaDB).
--
-- Aucun code n'est fourni : ajoutez les vôtres, par exemple
--   INSERT INTO code_promo (code, pourcentage) VALUES ('BIENVENUE10', 10);
-- Pour en désactiver un :
--   UPDATE code_promo SET actif = 0 WHERE code = 'BIENVENUE10';

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS code_promo (
    id          SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code        VARCHAR(30)       NOT NULL,
    pourcentage TINYINT UNSIGNED  NOT NULL,
    actif       TINYINT(1)        NOT NULL DEFAULT 1,
    cree_le     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_code_promo (code),

    CONSTRAINT chk_code_promo_pourcentage CHECK (pourcentage BETWEEN 1 AND 100)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

ALTER TABLE commande
    ADD COLUMN IF NOT EXISTS code_promo            VARCHAR(30)      NULL AFTER total,
    ADD COLUMN IF NOT EXISTS reduction_pourcentage TINYINT UNSIGNED NULL AFTER code_promo,
    ADD COLUMN IF NOT EXISTS reduction_montant     DECIMAL(10,2)    NOT NULL DEFAULT 0 AFTER reduction_pourcentage;
