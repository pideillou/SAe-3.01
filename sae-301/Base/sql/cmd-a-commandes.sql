-- CMD-a : tables des commandes, des lignes de commande et du journal des
-- mouvements de stock, à importer SANS réimporter import.sql (qui effacerait
-- les stocks et les comptes). Sans effet sur des tables déjà créées. Il faut
-- que les tables utilisateur et variante existent déjà.

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Commandes (CMD-a). Une commande garde une COPIE de ce qui a été acheté
-- (noms, prix, image) : elle reste lisible et exacte même si le produit est
-- modifié ou supprimé ensuite. variante_id passe alors à NULL, rien d'autre.
-- numero : numéro unique montré au client (ex. RZ-20261016-K7M2QX).
-- Statuts : en cours (à la création), disponible, retirée, annulée.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commande (
    id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    numero         VARCHAR(24)   NOT NULL,
    utilisateur_id INT UNSIGNED  NOT NULL,
    statut         ENUM('en cours', 'disponible', 'retirée', 'annulée') NOT NULL DEFAULT 'en cours',
    total          DECIMAL(10,2) NOT NULL,
    cree_le        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_commande_numero (numero),
    KEY idx_commande_utilisateur (utilisateur_id),

    CONSTRAINT chk_commande_total CHECK (total >= 0),
    CONSTRAINT fk_commande_utilisateur
        FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ligne_commande (
    id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    commande_id   INT UNSIGNED      NOT NULL,
    variante_id   SMALLINT UNSIGNED NULL,
    produit_nom   VARCHAR(120)      NOT NULL,
    produit_slug  VARCHAR(140)      NOT NULL,
    variante_nom  VARCHAR(160)      NOT NULL,
    image         VARCHAR(255)      NULL,
    prix_unitaire DECIMAL(8,2)      NOT NULL,
    quantite      SMALLINT UNSIGNED NOT NULL,

    PRIMARY KEY (id),
    KEY idx_ligne_commande (commande_id),
    KEY idx_ligne_variante (variante_id),

    CONSTRAINT chk_ligne_quantite CHECK (quantite > 0),
    CONSTRAINT fk_ligne_commande
        FOREIGN KEY (commande_id) REFERENCES commande (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_ligne_variante
        FOREIGN KEY (variante_id) REFERENCES variante (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Journal des mouvements de stock. quantite est signée : négative à la
-- commande, positive à l'annulation. Chaque ligne dit quoi, combien, pourquoi
-- (motif), pour quelle commande et quand.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mouvement_stock (
    id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    variante_id SMALLINT UNSIGNED NULL,
    quantite    INT               NOT NULL,
    motif       ENUM('commande', 'annulation') NOT NULL,
    commande_id INT UNSIGNED      NULL,
    cree_le     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_mouvement_variante (variante_id),
    KEY idx_mouvement_commande (commande_id),

    CONSTRAINT fk_mouvement_variante
        FOREIGN KEY (variante_id) REFERENCES variante (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_mouvement_commande
        FOREIGN KEY (commande_id) REFERENCES commande (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
