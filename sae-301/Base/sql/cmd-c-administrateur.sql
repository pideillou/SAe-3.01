-- CMD-c : table des comptes administrateurs et compte de test, à importer SANS
-- réimporter import.sql (qui effacerait les stocks et les commandes). Sans effet
-- sur une table déjà créée ; le compte de test n'est ajouté que s'il manque.

CREATE TABLE IF NOT EXISTS administrateur (
    id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    email        VARCHAR(190)      NOT NULL,
    mot_de_passe VARCHAR(255)      NOT NULL,
    cree_le      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_administrateur_email (email)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- Compte administrateur de TEST : à supprimer ou à remplacer avant la mise en
-- production. Seule l'empreinte bcrypt du mot de passe est enregistrée.
INSERT IGNORE INTO administrateur (email, mot_de_passe) VALUES
    ('pideillou@gmail.com', 'test');
