-- PIL-b : journal des modifications de commandes faites par les administrateurs,
-- à importer SANS réimporter import.sql (qui effacerait les commandes). Sans
-- effet si la table existe déjà. Les tables commande et administrateur doivent
-- exister.

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Journal des modifications de commandes faites par les administrateurs
-- (PIL-b) : qui a fait passer quelle commande de quel statut à quel autre, et
-- quand. L'adresse de l'administrateur est copiée : le journal reste lisible
-- même si son compte est supprimé (administrateur_id passe alors à NULL).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_commande (
    id                   INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    commande_id          INT UNSIGNED      NOT NULL,
    administrateur_id    SMALLINT UNSIGNED NULL,
    administrateur_email VARCHAR(190)      NOT NULL,
    ancien_statut        ENUM('en cours', 'disponible', 'retirée', 'annulée') NOT NULL,
    nouveau_statut       ENUM('en cours', 'disponible', 'retirée', 'annulée') NOT NULL,
    cree_le              DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_journal_commande (commande_id),

    CONSTRAINT fk_journal_commande
        FOREIGN KEY (commande_id) REFERENCES commande (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_journal_administrateur
        FOREIGN KEY (administrateur_id) REFERENCES administrateur (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
