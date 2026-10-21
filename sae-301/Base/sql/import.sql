-- ---------------------------------------------------------------------------
-- Click & collect Razer — schéma du catalogue et jeu de données
--
-- Ce script ne crée PAS de base de données : il ajoute ses tables à une base
-- existante. Depuis phpMyAdmin, sélectionnez d'abord votre base dans la colonne
-- de gauche, puis importez ce fichier depuis l'onglet « Importer ».
--
-- L'import est rejouable : chaque table est SUPPRIMÉE puis recréée.
-- ATTENTION : toutes les données de ces tables sont effacées à chaque import,
-- y compris les anciennes tables film et genre du starter.
--
-- Contenu : 3 catégories, 12 produits réels Razer, leurs images, leurs options
-- et leurs variantes (une variante = une combinaison d'options, avec son propre
-- prix et son propre stock).
--
-- Source des noms, prix TTC, descriptions, options et images : boutique
-- officielle Razer France (https://www.razer.com/fr-fr), relevé du 15/10/2026.
-- L'URL de chaque produit est indiquée en commentaire avant ses données.
-- Variantes retenues : dispositions de clavier FR et US, toutes les couleurs et
-- éditions, sans les bundles.
--
-- Les STOCKS sont des DONNÉES DE TEST : les stocks réels de Razer ne sont pas
-- publics. Ils mélangent volontairement des variantes en stock, bientôt
-- épuisées et épuisées pour tester l'affichage des stocks (STK-b).
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;

-- Suppression dans l'ordre inverse des clés étrangères.
-- ATTENTION : les commandes (commande, ligne_commande, mouvement_stock) sont
-- elles aussi supprimées à chaque import.
DROP TABLE IF EXISTS tentative_connexion;
DROP TABLE IF EXISTS code_promo;
DROP TABLE IF EXISTS journal_commande;
DROP TABLE IF EXISTS mouvement_stock;
DROP TABLE IF EXISTS ligne_commande;
DROP TABLE IF EXISTS commande;
DROP TABLE IF EXISTS variante_valeur;
DROP TABLE IF EXISTS image_produit;
DROP TABLE IF EXISTS variante;
DROP TABLE IF EXISTS valeur_option;
DROP TABLE IF EXISTS option_produit;
DROP TABLE IF EXISTS produit;
DROP TABLE IF EXISTS categorie;
DROP TABLE IF EXISTS administrateur;
DROP TABLE IF EXISTS utilisateur;
DROP TABLE IF EXISTS parametre;
-- Tables de l'exemple du starter, remplacées par le catalogue.
DROP TABLE IF EXISTS film;
DROP TABLE IF EXISTS genre;

-- ---------------------------------------------------------------------------
-- Paramètres modifiables depuis le back-office (seuil « Bientôt épuisé »).
-- ---------------------------------------------------------------------------
CREATE TABLE parametre (
    cle     VARCHAR(50)  NOT NULL,
    valeur  VARCHAR(255) NOT NULL,
    libelle VARCHAR(160) NOT NULL,

    PRIMARY KEY (cle)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Comptes clients (CMD-c). Le mot de passe n'est jamais stocké : seulement son
-- empreinte bcrypt (60 caractères, 255 laissés pour changer d'algorithme).
-- L'e-mail est enregistré en minuscules ; l'index UNIQUE empêche deux comptes
-- avec la même adresse, même si deux inscriptions arrivent en même temps.
-- ---------------------------------------------------------------------------
CREATE TABLE utilisateur (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    email        VARCHAR(190) NOT NULL,
    mot_de_passe VARCHAR(255) NOT NULL,
    nom          VARCHAR(80)  NULL,
    cree_le      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_utilisateur_email (email)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Comptes administrateurs (CMD-c). Table SÉPARÉE de utilisateur : un client ne
-- peut jamais devenir administrateur par la base, et les deux ouvertures de
-- session (clés de session différentes) ne se mélangent pas.
-- ---------------------------------------------------------------------------
CREATE TABLE administrateur (
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
INSERT INTO administrateur (email, mot_de_passe) VALUES
    ('admin@razer-click-collect.test', '$2y$12$.ojg/XBiG2QNJ8MnUk0.3OWs8VsWWL1u7nyDy.biwkoIUYvk5lNiK');

-- ---------------------------------------------------------------------------
-- Catégories. Le slug sert à l'adresse /categorie/slug.
-- ---------------------------------------------------------------------------
CREATE TABLE categorie (
    id          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nom         VARCHAR(60)      NOT NULL,
    slug        VARCHAR(80)      NOT NULL,
    description TEXT                 NULL,
    ordre       TINYINT UNSIGNED NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    UNIQUE KEY uq_categorie_nom  (nom),
    UNIQUE KEY uq_categorie_slug (slug)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Produits. Le slug sert à l'adresse /produit/slug.
-- prix : prix de base affiché au catalogue, celui de la variante la moins
-- chère. Le prix payé est celui de la variante choisie.
-- Une catégorie qui contient des produits ne peut pas être supprimée
-- (ON DELETE RESTRICT) : la règle définitive sera fixée avec GOF-c.
-- ---------------------------------------------------------------------------
CREATE TABLE produit (
    id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    categorie_id TINYINT UNSIGNED  NOT NULL,
    nom          VARCHAR(120)      NOT NULL,
    slug         VARCHAR(140)      NOT NULL,
    accroche     VARCHAR(255)          NULL,
    description  TEXT              NOT NULL,
    -- Points forts affichés sous la fiche, un par ligne (3 chez Razer).
    caracteristiques TEXT              NULL,
    prix         DECIMAL(8,2)      NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_produit_slug (slug),
    UNIQUE KEY uq_produit_nom  (nom),
    KEY idx_produit_categorie  (categorie_id),
    KEY idx_produit_prix       (prix),

    CONSTRAINT chk_produit_prix CHECK (prix >= 0),
    CONSTRAINT fk_produit_categorie
        FOREIGN KEY (categorie_id) REFERENCES categorie (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Options d'un produit (Couleur, Disposition du clavier…) et leurs valeurs.
-- ---------------------------------------------------------------------------
CREATE TABLE option_produit (
    id         SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    produit_id SMALLINT UNSIGNED NOT NULL,
    nom        VARCHAR(60)       NOT NULL,
    ordre      TINYINT UNSIGNED  NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    UNIQUE KEY uq_option_produit (produit_id, nom),

    CONSTRAINT fk_option_produit
        FOREIGN KEY (produit_id) REFERENCES produit (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE valeur_option (
    id        SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    option_id SMALLINT UNSIGNED NOT NULL,
    valeur    VARCHAR(80)       NOT NULL,
    ordre     TINYINT UNSIGNED  NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    UNIQUE KEY uq_valeur_option (option_id, valeur),

    CONSTRAINT fk_valeur_option
        FOREIGN KEY (option_id) REFERENCES option_produit (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Variantes : une combinaison d'options réellement vendue, avec son prix et
-- son stock. Le stock est UNSIGNED : MySQL refuse toute valeur négative.
-- reference : référence Razer (SKU). est_defaut : variante affichée par défaut.
-- ---------------------------------------------------------------------------
CREATE TABLE variante (
    id         SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    produit_id SMALLINT UNSIGNED NOT NULL,
    reference  VARCHAR(30)       NOT NULL,
    nom        VARCHAR(160)      NOT NULL,
    prix       DECIMAL(8,2)      NOT NULL,
    stock      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    est_defaut TINYINT(1)        NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    UNIQUE KEY uq_variante_reference (reference),
    KEY idx_variante_produit (produit_id),

    CONSTRAINT chk_variante_prix CHECK (prix >= 0),
    CONSTRAINT fk_variante_produit
        FOREIGN KEY (produit_id) REFERENCES produit (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- Valeurs d'options qui composent chaque variante.
CREATE TABLE variante_valeur (
    variante_id SMALLINT UNSIGNED NOT NULL,
    valeur_id   SMALLINT UNSIGNED NOT NULL,

    PRIMARY KEY (variante_id, valeur_id),
    KEY idx_variante_valeur_valeur (valeur_id),

    CONSTRAINT fk_vv_variante
        FOREIGN KEY (variante_id) REFERENCES variante (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_vv_valeur
        FOREIGN KEY (valeur_id) REFERENCES valeur_option (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Images. Les chemins sont relatifs au dossier public du front : ils sont
-- servis sous BASE (vite.config.js), par exemple
-- /~login/.../images/produits/blackwidow-v4/principale-767.webp.
-- variante_id NULL : image du produit (une principale, les autres en galerie).
-- variante_id renseigné : image propre à une variante (couleur, taille…).
-- chemin_moyen / chemin_grand : galerie en 767 px et 1199 px. Les images
-- principales sont des originaux carrés de 500 px : les deux colonnes
-- désignent alors le même fichier.
-- ---------------------------------------------------------------------------
CREATE TABLE image_produit (
    id             SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    produit_id     SMALLINT UNSIGNED NOT NULL,
    variante_id    SMALLINT UNSIGNED     NULL,
    chemin_moyen   VARCHAR(255)      NOT NULL,
    chemin_grand   VARCHAR(255)      NOT NULL,
    texte_alt      VARCHAR(255)      NOT NULL,
    est_principale TINYINT(1)        NOT NULL DEFAULT 0,
    ordre          TINYINT UNSIGNED  NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    KEY idx_image_produit  (produit_id, est_principale),
    KEY idx_image_variante (variante_id),

    CONSTRAINT fk_image_produit
        FOREIGN KEY (produit_id) REFERENCES produit (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_image_variante
        FOREIGN KEY (variante_id) REFERENCES variante (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Commandes (CMD-a). Une commande garde une COPIE de ce qui a été acheté
-- (noms, prix, image) : elle reste lisible et exacte même si le produit est
-- modifié ou supprimé ensuite. variante_id passe alors à NULL, rien d'autre.
-- numero : numéro unique montré au client (ex. RZ-20261016-K7M2QX).
-- Statuts : en cours (à la création), disponible, retirée, annulée.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Tentatives de connexion échouées : limitent la force brute (8 échecs en 15
-- minutes pour la même clé, empreinte de l'adresse e-mail et de l'adresse IP).
-- ---------------------------------------------------------------------------
CREATE TABLE tentative_connexion (
    id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    cle     CHAR(64)     NOT NULL,
    cree_le DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_tentative_cle (cle, cree_le)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Codes promotionnels (PRO-a) : un code saisi à la commande donne une réduction
-- en pourcentage sur le total. Le code est enregistré en MAJUSCULES. Un code
-- désactivé (actif = 0) n'est plus accepté. Aucun code n'est fourni : ils sont
-- ajoutés par le magasin, par exemple :
--   INSERT INTO code_promo (code, pourcentage) VALUES ('BIENVENUE10', 10);
-- La commande garde le code, le pourcentage et le montant de la réduction au
-- moment où elle a été passée (colonnes code_promo, reduction_pourcentage et
-- reduction_montant de la table commande) : total = articles - réduction.
-- ---------------------------------------------------------------------------
CREATE TABLE code_promo (
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

CREATE TABLE commande (
    id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    numero         VARCHAR(24)   NOT NULL,
    utilisateur_id INT UNSIGNED  NOT NULL,
    statut         ENUM('en cours', 'disponible', 'retirée', 'annulée') NOT NULL DEFAULT 'en cours',
    total          DECIMAL(10,2) NOT NULL,
    code_promo            VARCHAR(30)      NULL,
    reduction_pourcentage TINYINT UNSIGNED NULL,
    reduction_montant     DECIMAL(10,2)    NOT NULL DEFAULT 0,
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

CREATE TABLE ligne_commande (
    id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    commande_id   INT UNSIGNED      NOT NULL,
    variante_id   SMALLINT UNSIGNED NULL,
    produit_nom   VARCHAR(120)      NOT NULL,
    produit_slug  VARCHAR(140)      NOT NULL,
    variante_nom  VARCHAR(160)      NOT NULL,
    options       VARCHAR(500)      NULL,
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
-- commande, positive à l'annulation, positive ou négative pour un ajustement
-- fait par l'administrateur depuis la fiche produit. Chaque ligne dit quoi, combien, pourquoi
-- (motif), pour quelle commande et quand.
-- ---------------------------------------------------------------------------
CREATE TABLE mouvement_stock (
    id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    variante_id SMALLINT UNSIGNED NULL,
    quantite    INT               NOT NULL,
    motif       ENUM('commande', 'annulation', 'ajustement') NOT NULL,
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

-- ---------------------------------------------------------------------------
-- Journal des modifications de commandes faites par les administrateurs
-- (PIL-b) : qui a fait passer quelle commande de quel statut à quel autre, et
-- quand. L'adresse de l'administrateur est copiée : le journal reste lisible
-- même si son compte est supprimé (administrateur_id passe alors à NULL).
-- ---------------------------------------------------------------------------
CREATE TABLE journal_commande (
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

-- ---------------------------------------------------------------------------
-- Données
-- ---------------------------------------------------------------------------

INSERT INTO parametre (cle, valeur, libelle) VALUES
    ('seuil_bientot_epuise', '5', 'Seuil « Bientôt épuisé » : stock inférieur ou égal à cette valeur');

INSERT INTO categorie (id, nom, slug, description, ordre) VALUES
    (1, 'Claviers', 'claviers', NULL, 1),
    (2, 'Souris', 'souris', NULL, 2),
    (3, 'Casques', 'casques', NULL, 3);

-- ---------------------------------------------------------------------------
-- Razer BlackWidow V4 (claviers)
-- Source : https://www.razer.com/fr-fr/gaming-keyboards/razer-blackwidow-v4
-- Page d'achat : https://www.razer.com/fr-fr/gaming-keyboards/razer-blackwidow-v4/RZ03-04690500-R3F1
-- Prix relevés le 15/10/2026.
-- ---------------------------------------------------------------------------
INSERT INTO produit (id, categorie_id, nom, slug, accroche, description, caracteristiques, prix) VALUES
    (1, 1, 'Razer BlackWidow V4', 'razer-blackwidow-v4', 'Clavier gaming mécanique avec Razer Chroma™ RGB',
     'Exploitez votre setup de manière optimale avec le centre de commande parfait pour votre PC. Accédez aux commandes et raccourcis avancés grâce aux touches macro et multimédias : l''immersion est totale avec ce clavier mécanique sophistiqué, doté de la technologie Razer Chroma™ RGB.

ÉCLAIRAGE SOUS-JACENT SUR 2 CÔTÉS ET PAR TOUCHE
L’éclairage par touche et les lueurs sous-jacentes éclatantes mettent en valeur le clavier sous plusieurs angles. Synchronisez-les avec votre setup et jouissez d’une plus grande immersion dans les centaines de jeux intégrés.

6 TOUCHES MACRO DÉDIÉES
Que ce soit pour lancer votre compétence ultime ou pour optimiser la rotation de vos sorts, étendez votre arsenal de commandes grâce à un ensemble de touches macro faciles d’accès, qui peuvent être programmées en fonction de votre style de jeu.

SWITCHES MÉCANIQUES RAZER™
Choisissez entre deux switches qui offrent des sensations distinctes : le vert pour une activation précise avec un retour tactile et sonore ou le jaune pour une activation rapide, fluide et silencieuse.

REPOSE-POIGNETS MAGNÉTIQUE EN SIMILICUIR MOELLEUX
Avec un repose-poignet doux et rembourré qui se fixe solidement au clavier, profitez d’un confort durable qui vous aidera à tenir le coup pendant les marathons de jeu les plus intenses.

TOUCHES ABS À DOUBLE INJECTION
Grâce à un procédé de moulage à double injection, les touches sont pourvues de caractères qui ne s’effacent jamais et de parois plus épaisses, qui les rendent extrêmement résistantes aux grosses sessions de jeu.

MOLETTE MULTIFONCTION ET 4 TOUCHES MULTIMÉDIAS
Un confort de divertissement ultime : lecture, pause, piste suivante... jouez et faites tous vos réglages en un clin d''œil, de la luminosité au volume.

AUTRES CARACTÉRISTIQUES DE PREMIER RANG
Construit pour durer plus longtemps avec une finition raffinée.

CÂBLE TYPE C AMOVIBLE
Fourni avec un câble tressé de type A vers type C pour la connexion du clavier.',
     'Switches mécaniques verts Razer™
Éclairage sous-jacent sur les 2 côtés et éclairage par touche
6 touches macros dédiées',
     189.99);

INSERT INTO option_produit (id, produit_id, nom, ordre) VALUES
    (1, 1, 'Touche de clavier', 1),
    (2, 1, 'Disposition du clavier', 2);

INSERT INTO valeur_option (id, option_id, valeur, ordre) VALUES
    (1, 1, 'Switchs mécaniques verts Razer™ - Tactile et sonore', 1),
    (2, 1, 'Switchs mécaniques jaunes Razer™ - Fluide et silencieuse', 2),
    (3, 2, 'Clavier Américain', 1),
    (4, 2, 'Clavier Français', 2);

-- Stocks : DONNÉES DE TEST (non fournies par Razer).
INSERT INTO variante (id, produit_id, reference, nom, prix, stock, est_defaut) VALUES
    (1, 1, 'RZ03-04690100-R3M1', 'Razer BlackWidow V4 - Switch vert - US', 189.99, 7, 0),
    (2, 1, 'RZ03-04690500-R3F1', 'Razer BlackWidow V4 - Switch vert - FR', 189.99, 18, 1),
    (3, 1, 'RZ03-04691800-R3M1', 'Razer BlackWidow V4 - Switch jaune - US', 189.99, 2, 0);

INSERT INTO variante_valeur (variante_id, valeur_id) VALUES
    (1, 1),
    (1, 3),
    (2, 1),
    (2, 4),
    (3, 2),
    (3, 3);

INSERT INTO image_produit (id, produit_id, variante_id, chemin_moyen, chemin_grand, texte_alt, est_principale, ordre) VALUES
    (1, 1, NULL, 'images/produits/blackwidow-v4/principale-500.webp', 'images/produits/blackwidow-v4/principale-500.webp', 'Razer BlackWidow V4', 1, 0),
    (2, 1, NULL, 'images/produits/blackwidow-v4/galerie-1-767.webp', 'images/produits/blackwidow-v4/galerie-1-1199.webp', 'Razer BlackWidow V4, vue 2', 0, 1),
    (3, 1, NULL, 'images/produits/blackwidow-v4/galerie-2-767.webp', 'images/produits/blackwidow-v4/galerie-2-1199.webp', 'Razer BlackWidow V4, vue 3', 0, 2),
    (4, 1, NULL, 'images/produits/blackwidow-v4/galerie-3-767.webp', 'images/produits/blackwidow-v4/galerie-3-1199.webp', 'Razer BlackWidow V4, vue 4', 0, 3),
    (5, 1, NULL, 'images/produits/blackwidow-v4/galerie-4-767.webp', 'images/produits/blackwidow-v4/galerie-4-1199.webp', 'Razer BlackWidow V4, vue 5', 0, 4),
    (6, 1, NULL, 'images/produits/blackwidow-v4/galerie-5-767.webp', 'images/produits/blackwidow-v4/galerie-5-1199.webp', 'Razer BlackWidow V4, vue 6', 0, 5),
    (7, 1, NULL, 'images/produits/blackwidow-v4/galerie-6-767.webp', 'images/produits/blackwidow-v4/galerie-6-1199.webp', 'Razer BlackWidow V4, vue 7', 0, 6),
    (8, 1, 1, 'images/produits/blackwidow-v4/principale-500.webp', 'images/produits/blackwidow-v4/principale-500.webp', 'Razer BlackWidow V4 - Switch vert - US', 0, 0),
    (9, 1, 2, 'images/produits/blackwidow-v4/principale-500.webp', 'images/produits/blackwidow-v4/principale-500.webp', 'Razer BlackWidow V4 - Switch vert - FR', 0, 0),
    (10, 1, 3, 'images/produits/blackwidow-v4/principale-500.webp', 'images/produits/blackwidow-v4/principale-500.webp', 'Razer BlackWidow V4 - Switch jaune - US', 0, 0);

-- ---------------------------------------------------------------------------
-- Razer BlackWidow V4 X (claviers)
-- Source : https://www.razer.com/fr-fr/gaming-keyboards/razer-blackwidow-v4-x
-- Page d'achat : https://www.razer.com/fr-fr/gaming-keyboards/razer-blackwidow-v4-x/RZ03-04700500-R3F1
-- Prix relevés le 15/10/2026.
-- ---------------------------------------------------------------------------
INSERT INTO produit (id, categorie_id, nom, slug, accroche, description, caracteristiques, prix) VALUES
    (2, 1, 'Razer BlackWidow V4 X', 'razer-blackwidow-v4-x', 'Clavier gaming mécanique avec Razer Chroma™ RGB',
     'Améliorez le cœur de votre setup avec le Razer BlackWidow V4 X, un clavier gaming mécanique de pointe conçu pour offrir un contrôle total. Exécutez instantanément des commandes avancées et des raccourcis avec un ensemble de touches macro et multimédias, tout en faisant passer votre immersion au niveau supérieur avec Razer Chroma™ RGB.

6 Touches Macros Dédiées
Que ce soit pour lancer votre compétence ultime ou pour optimiser la rotation de vos sorts, étendez votre arsenal de commandes grâce à un ensemble de touches macro faciles d’accès, qui peuvent être programmées en fonction de votre style de jeu.

Molette Multifonction Et Touches Multimédias Secondaires
Un confort de divertissement ultime : lecture, pause, piste suivante... jouez et faites tous vos réglages en un clin d''œil, de la luminosité au volume.

Switchs Mécaniques Razer™ De 3E Gen
Choisissez entre deux switches qui offrent des sensations distinctes : le vert pour une activation précise avec un retour tactile et sonore ou le jaune pour une activation rapide, fluide et silencieuse.

Alimenté Par Razer Chroma™ RGB
Avec des switches conçus pour permettre un éclairage plus harmonieux et uniforme, personnalisez chaque touche avec plus de 16,8 millions de couleurs et d’effets, dont un éclairage dynamique pour des centaines de jeux disposant de l’intégration Chroma.

Touches ABS À Double Injection
Grâce à un procédé de moulage à double injection, les touches sont pourvues de caractères qui ne s’effacent jamais et de parois plus épaisses, qui les rendent extrêmement résistantes aux grosses sessions de jeu.

Mousse D''amortissement Du Son Et Stabilisateurs Lubrifiés
Avec une couche de mousse spéciale sous le circuit imprimé et des stabilisateurs lubrifiés pour minimiser le bruit, le Razer BlackWidow V4 X garantit une expérience de frappe aussi agréable à l’oreille qu’au toucher.

Razer™ Snap Tap
Avec Razer Synapse 4 , vous pouvez donner la priorité à la dernière entrée de deux touches sélectionnées sans avoir à relâcher la première. Bénéficiez d’une meilleure réactivité pour des changements de direction quasi-instantanés.',
     'Switchs mécaniques verts Razer™
6 touches macros dédiées
Molette multifonction et touches multimédias secondaires',
     149.99);

INSERT INTO option_produit (id, produit_id, nom, ordre) VALUES
    (3, 2, 'Couleur', 1),
    (4, 2, 'Touche de clavier', 2),
    (5, 2, 'Disposition du clavier', 3);

INSERT INTO valeur_option (id, option_id, valeur, ordre) VALUES
    (5, 3, 'Noir', 1),
    (6, 3, 'Minecraft Edition', 2),
    (7, 3, 'Pokémon Edition', 3),
    (8, 3, 'Zenless Zone Zero Edition', 4),
    (9, 4, 'Switchs mécaniques verts Razer™ - Tactile et sonore', 1),
    (10, 4, 'Switchs mécaniques jaunes Razer™ - Fluide et silencieuse', 2),
    (11, 5, 'Clavier Américain', 1),
    (12, 5, 'Clavier Français', 2);

-- Stocks : DONNÉES DE TEST (non fournies par Razer).
INSERT INTO variante (id, produit_id, reference, nom, prix, stock, est_defaut) VALUES
    (4, 2, 'RZ03-04700100-R3M1', 'Razer BlackWidow V4 X - Switch vert - US - Noir', 149.99, 7, 0),
    (5, 2, 'RZ03-04700500-R3F1', 'Razer BlackWidow V4 X - Switch vert - FR - Noir', 149.99, 10, 1),
    (6, 2, 'RZ03-04701800-R3M1', 'Razer BlackWidow V4 X - Switch jaune - US - Noir', 149.99, 8, 0),
    (7, 2, 'RZ03-04704100-R3M1', 'Razer BlackWidow V4 X - Switch vert - US - Minecraft Edition', 199.99, 9, 0),
    (8, 2, 'RZ03-04704200-R3M1', 'Razer BlackWidow V4 X - Switch vert - US - Pokémon Edition', 189.99, 10, 0),
    (9, 2, 'RZ03-04704300-R3M1', 'Razer BlackWidow V4 X - Switch vert - US - Zenless Zone Zero Edition', 189.99, 2, 0);

INSERT INTO variante_valeur (variante_id, valeur_id) VALUES
    (4, 5),
    (4, 9),
    (4, 11),
    (5, 5),
    (5, 9),
    (5, 12),
    (6, 5),
    (6, 10),
    (6, 11),
    (7, 9),
    (7, 11),
    (7, 6),
    (8, 7),
    (8, 9),
    (8, 11),
    (9, 8),
    (9, 9),
    (9, 11);

INSERT INTO image_produit (id, produit_id, variante_id, chemin_moyen, chemin_grand, texte_alt, est_principale, ordre) VALUES
    (11, 2, NULL, 'images/produits/blackwidow-v4-x/principale-500.webp', 'images/produits/blackwidow-v4-x/principale-500.webp', 'Razer BlackWidow V4 X', 1, 0),
    (12, 2, NULL, 'images/produits/blackwidow-v4-x/galerie-1-767.webp', 'images/produits/blackwidow-v4-x/galerie-1-1199.webp', 'Razer BlackWidow V4 X, vue 2', 0, 1),
    (13, 2, NULL, 'images/produits/blackwidow-v4-x/galerie-2-767.webp', 'images/produits/blackwidow-v4-x/galerie-2-1199.webp', 'Razer BlackWidow V4 X, vue 3', 0, 2),
    (14, 2, NULL, 'images/produits/blackwidow-v4-x/galerie-3-767.webp', 'images/produits/blackwidow-v4-x/galerie-3-1199.webp', 'Razer BlackWidow V4 X, vue 4', 0, 3),
    (15, 2, NULL, 'images/produits/blackwidow-v4-x/galerie-4-767.webp', 'images/produits/blackwidow-v4-x/galerie-4-1199.webp', 'Razer BlackWidow V4 X, vue 5', 0, 4),
    (16, 2, NULL, 'images/produits/blackwidow-v4-x/galerie-5-767.webp', 'images/produits/blackwidow-v4-x/galerie-5-1199.webp', 'Razer BlackWidow V4 X, vue 6', 0, 5),
    (17, 2, NULL, 'images/produits/blackwidow-v4-x/galerie-6-767.webp', 'images/produits/blackwidow-v4-x/galerie-6-1199.webp', 'Razer BlackWidow V4 X, vue 7', 0, 6),
    (18, 2, 4, 'images/produits/blackwidow-v4-x/principale-500.webp', 'images/produits/blackwidow-v4-x/principale-500.webp', 'Razer BlackWidow V4 X - Switch vert - US - Noir', 0, 0),
    (19, 2, 5, 'images/produits/blackwidow-v4-x/principale-500.webp', 'images/produits/blackwidow-v4-x/principale-500.webp', 'Razer BlackWidow V4 X - Switch vert - FR - Noir', 0, 0),
    (20, 2, 6, 'images/produits/blackwidow-v4-x/principale-500.webp', 'images/produits/blackwidow-v4-x/principale-500.webp', 'Razer BlackWidow V4 X - Switch jaune - US - Noir', 0, 0),
    (21, 2, 7, 'images/produits/blackwidow-v4-x/variante-rz03-04704100-r3m1-500.webp', 'images/produits/blackwidow-v4-x/variante-rz03-04704100-r3m1-500.webp', 'Razer BlackWidow V4 X - Switch vert - US - Minecraft Edition', 0, 0),
    (22, 2, 8, 'images/produits/blackwidow-v4-x/variante-rz03-04704200-r3m1-500.webp', 'images/produits/blackwidow-v4-x/variante-rz03-04704200-r3m1-500.webp', 'Razer BlackWidow V4 X - Switch vert - US - Pokémon Edition', 0, 0),
    (23, 2, 9, 'images/produits/blackwidow-v4-x/variante-rz03-04704300-r3m1-500.webp', 'images/produits/blackwidow-v4-x/variante-rz03-04704300-r3m1-500.webp', 'Razer BlackWidow V4 X - Switch vert - US - Zenless Zone Zero Edition', 0, 0);

-- ---------------------------------------------------------------------------
-- Razer Huntsman V3 Pro (claviers)
-- Source : https://www.razer.com/fr-fr/gaming-keyboards/razer-huntsman-v3-pro
-- Page d'achat : https://www.razer.com/fr-fr/gaming-keyboards/razer-huntsman-v3-pro/RZ03-04970500-R3F1
-- Prix relevés le 15/10/2026.
-- ---------------------------------------------------------------------------
INSERT INTO produit (id, categorie_id, nom, slug, accroche, description, caracteristiques, prix) VALUES
    (3, 1, 'Razer Huntsman V3 Pro', 'razer-huntsman-v3-pro', 'Clavier eSport analogique à switches optiques',
     'Élevez instantanément votre niveau de jeu avec le meilleur clavier eSport, le Razer Huntsman V3 Pro. Grâce aux modes Razer™ Snap Tap et Déclenchement rapide, exécutez des entrées plus réactives à des vitesses incroyables. Apportez davantage de personnalisation avec une activation réglable pour optimiser votre avantage concurrentiel.

SWITCHES OPTIQUES ANALOGIQUES RAZER™ DE 2E GÉNÉRATION
Précision et réactivité maximales grâce à un clavier taillé pour l’esport doté de nos switches les plus perfectionnés: mode déclenchement rapide pour des entrées répétées ultra-rapides, plage d’activation réglable de 0,1 à 4,0 mm et durée de vie de 100 millions de frappes.

MODE DÉCLENCHEMENT RAPIDE
Au lieu d''un point de réinitialisation fixe, les touches se réinitialisent instantanément en remontant de seulement 0,1 mm. Cela permet de répéter les frappes plus rapidement que sur les claviers standard et d’améliorer considérablement la réactivité dans les jeux.

Razer™ Snap Tap
Donnez la priorité à la dernière entrée de deux touches sans avoir à relâcher la première. Bénéficiez d’une meilleure réactivité pour des changements de direction quasi-instantanés. Snap Tap est désactivé par défaut et peut être activé/désactivé via Razer Synapse ou en appuyant sur fn + Maj gauche.

ACTIVATION RÉGLABLE
Personnalisez les switches pour qu’ils soient aussi sensibles que vous le souhaitez grâce à la plage complète d''activation (de 0,1 à 4,0 mm), et obtenez le réglage qui convient le mieux à votre style de jeu.

FORCE D’ACTIVATION DE 40 G
Profitez d’une plus grande réactivité avec une force d’activation plus légère qui vous permet de jouer et de réagir plus rapidement que jamais. Déplacements latéraux, visée, esquive : prenez l''avantage grâce à la fraction de seconde dont vous avez besoin pour sortir vainqueur de chaque échange.

RÉGLAGES RAPIDES INTÉGRÉS
Effectuez des réglages précis et à la volée de la hauteur d’activation ou de la sensibilité du déclenchement rapide à l’aide d’une série de LED intégrées. Enregistrez les paramètres sur le clavier et accédez à des fonctions de personnalisation plus poussées via Razer Synapse.

MODE DE RÉGLAGE RAPIDE DE L’ACTIVATION
Appuyez simplement sur FN + Tab pour ajuster le point d’activation du clavier. Ensuite, appuyez sur n’importe quelle touche pour tester sa hauteur d’activation et utilisez le bouton numérique ou les flèches de direction pour ajuster les réglages en conséquence. Appuyez sur Esc pour quitter le mode et enregistrer vos paramètres dans la mémoire intégrée.

MODE DE RÉGLAGE RAPIDE DU DÉCLENCHEMENT RAPIDE
Appuyez simplement sur FN + Caps Lk pour commencer à ajuster les paramètres de déclenchement rapide et appuyez sur Caps Lk pour activer ou désactiver le mode déclenchement rapide. Ensuite, appuyez sur n’importe quelle touche pour tester vos paramètres de déclenchement rapide actuels et utilisez le bouton numérique ou les flèches de direction pour ajuster les réglages en conséquence. Appuyez sur Esc pour quitter le mode et enregistrer vos paramètres dans la mémoire intégrée.',
     'Mode déclenchement rapide
Razer™ Frappe instantanée
Activation réglable',
     209.99);

INSERT INTO option_produit (id, produit_id, nom, ordre) VALUES
    (6, 3, 'Couleur', 1),
    (7, 3, 'Taille', 2),
    (8, 3, 'Disposition du clavier', 3);

INSERT INTO valeur_option (id, option_id, valeur, ordre) VALUES
    (13, 6, 'Noir', 1),
    (14, 6, 'Blanc', 2),
    (15, 6, 'Counter-Strike 2 Edition', 3),
    (16, 7, 'Grande taille', 1),
    (17, 7, 'Sans pavé numérique', 2),
    (18, 7, '60 %', 3),
    (19, 8, 'Clavier Américain', 1),
    (20, 8, 'Clavier Français', 2);

-- Stocks : DONNÉES DE TEST (non fournies par Razer).
INSERT INTO variante (id, produit_id, reference, nom, prix, stock, est_defaut) VALUES
    (10, 3, 'RZ03-04970100-R3M1', 'Razer Huntsman V3 Pro - US - Noir', 289.99, 7, 0),
    (11, 3, 'RZ03-04970500-R3F1', 'Razer Huntsman V3 Pro - FR - Noir', 289.99, 12, 1),
    (12, 3, 'RZ03-04980100-R3M1', 'Razer Huntsman V3 Pro Tenkeyless - US - Noir', 249.99, 8, 0),
    (13, 3, 'RZ03-04980500-R3F1', 'Razer Huntsman V3 Pro Tenkeyless - FR - Noir', 249.99, 9, 0),
    (14, 3, 'RZ03-04981700-R3M1', 'Razer Huntsman V3 Pro Tenkeyless - US - Blanche', 249.99, 10, 0),
    (15, 3, 'RZ03-04982100-R3M1', 'Razer Huntsman V3 Pro Tenkeyless - US - Counter-Strike 2 Edition', 289.99, 11, 0),
    (16, 3, 'RZ03-04990100-R3M1', 'Razer Huntsman V3 Pro Mini - US - Noir', 209.99, 12, 0),
    (17, 3, 'RZ03-04990500-R3F1', 'Razer Huntsman V3 Pro Mini - FR - Noir', 209.99, 7, 0),
    (18, 3, 'RZ03-04991700-R3M1', 'Razer Huntsman V3 Pro Mini - US - Blanche', 209.99, 2, 0);

INSERT INTO variante_valeur (variante_id, valeur_id) VALUES
    (10, 13),
    (10, 16),
    (10, 19),
    (11, 13),
    (11, 16),
    (11, 20),
    (12, 13),
    (12, 17),
    (12, 19),
    (13, 13),
    (13, 17),
    (13, 20),
    (14, 14),
    (14, 17),
    (14, 19),
    (15, 15),
    (15, 17),
    (15, 19),
    (16, 13),
    (16, 18),
    (16, 19),
    (17, 13),
    (17, 18),
    (17, 20),
    (18, 14),
    (18, 18),
    (18, 19);

INSERT INTO image_produit (id, produit_id, variante_id, chemin_moyen, chemin_grand, texte_alt, est_principale, ordre) VALUES
    (24, 3, NULL, 'images/produits/huntsman-v3-pro/principale-500.webp', 'images/produits/huntsman-v3-pro/principale-500.webp', 'Razer Huntsman V3 Pro', 1, 0),
    (25, 3, NULL, 'images/produits/huntsman-v3-pro/galerie-1-767.webp', 'images/produits/huntsman-v3-pro/galerie-1-1199.webp', 'Razer Huntsman V3 Pro, vue 2', 0, 1),
    (26, 3, NULL, 'images/produits/huntsman-v3-pro/galerie-2-767.webp', 'images/produits/huntsman-v3-pro/galerie-2-1199.webp', 'Razer Huntsman V3 Pro, vue 3', 0, 2),
    (27, 3, NULL, 'images/produits/huntsman-v3-pro/galerie-3-767.webp', 'images/produits/huntsman-v3-pro/galerie-3-1199.webp', 'Razer Huntsman V3 Pro, vue 4', 0, 3),
    (28, 3, NULL, 'images/produits/huntsman-v3-pro/galerie-4-767.webp', 'images/produits/huntsman-v3-pro/galerie-4-1199.webp', 'Razer Huntsman V3 Pro, vue 5', 0, 4),
    (29, 3, NULL, 'images/produits/huntsman-v3-pro/galerie-5-767.webp', 'images/produits/huntsman-v3-pro/galerie-5-1199.webp', 'Razer Huntsman V3 Pro, vue 6', 0, 5),
    (30, 3, NULL, 'images/produits/huntsman-v3-pro/galerie-6-767.webp', 'images/produits/huntsman-v3-pro/galerie-6-1199.webp', 'Razer Huntsman V3 Pro, vue 7', 0, 6),
    (31, 3, 10, 'images/produits/huntsman-v3-pro/principale-500.webp', 'images/produits/huntsman-v3-pro/principale-500.webp', 'Razer Huntsman V3 Pro - US - Noir', 0, 0),
    (32, 3, 11, 'images/produits/huntsman-v3-pro/principale-500.webp', 'images/produits/huntsman-v3-pro/principale-500.webp', 'Razer Huntsman V3 Pro - FR - Noir', 0, 0),
    (33, 3, 12, 'images/produits/huntsman-v3-pro/variante-rz03-04980100-r3m1-500.webp', 'images/produits/huntsman-v3-pro/variante-rz03-04980100-r3m1-500.webp', 'Razer Huntsman V3 Pro Tenkeyless - US - Noir', 0, 0),
    (34, 3, 13, 'images/produits/huntsman-v3-pro/variante-rz03-04980100-r3m1-500.webp', 'images/produits/huntsman-v3-pro/variante-rz03-04980100-r3m1-500.webp', 'Razer Huntsman V3 Pro Tenkeyless - FR - Noir', 0, 0),
    (35, 3, 14, 'images/produits/huntsman-v3-pro/variante-rz03-04981700-r3m1-500.webp', 'images/produits/huntsman-v3-pro/variante-rz03-04981700-r3m1-500.webp', 'Razer Huntsman V3 Pro Tenkeyless - US - Blanche', 0, 0),
    (36, 3, 15, 'images/produits/huntsman-v3-pro/variante-rz03-04982100-r3m1-500.webp', 'images/produits/huntsman-v3-pro/variante-rz03-04982100-r3m1-500.webp', 'Razer Huntsman V3 Pro Tenkeyless - US - Counter-Strike 2 Edition', 0, 0),
    (37, 3, 16, 'images/produits/huntsman-v3-pro/variante-rz03-04990100-r3m1-500.webp', 'images/produits/huntsman-v3-pro/variante-rz03-04990100-r3m1-500.webp', 'Razer Huntsman V3 Pro Mini - US - Noir', 0, 0),
    (38, 3, 17, 'images/produits/huntsman-v3-pro/variante-rz03-04990100-r3m1-500.webp', 'images/produits/huntsman-v3-pro/variante-rz03-04990100-r3m1-500.webp', 'Razer Huntsman V3 Pro Mini - FR - Noir', 0, 0),
    (39, 3, 18, 'images/produits/huntsman-v3-pro/variante-rz03-04991700-r3m1-500.webp', 'images/produits/huntsman-v3-pro/variante-rz03-04991700-r3m1-500.webp', 'Razer Huntsman V3 Pro Mini - US - Blanche', 0, 0);

-- ---------------------------------------------------------------------------
-- Razer Ornata V3 (claviers)
-- Source : https://www.razer.com/fr-fr/gaming-keyboards/razer-ornata-v3
-- Page d'achat : https://www.razer.com/fr-fr/gaming-keyboards/razer-ornata-v3/RZ03-04460500-R3F1
-- Prix relevés le 15/10/2026.
-- ---------------------------------------------------------------------------
INSERT INTO produit (id, categorie_id, nom, slug, accroche, description, caracteristiques, prix) VALUES
    (4, 1, 'Razer Ornata V3', 'razer-ornata-v3', 'Clavier RGB à méca-membrane au profil bas',
     'Découvrez le Razer Ornata V3, un clavier de gaming ergonomique au profil bas alimenté par Razer Chroma™ RGB. Doté d’un nouveau format ultra fin, de touches plus durables et de switchs méca-membrane uniques, améliorez votre rendement au travail et dans vos jeux avec ce clavier hybride qui combine le meilleur des deux mondes.

TOUCHES À PROFIL BAS
Avec des touches plus fines et des switchs plus courts, profitez d’un positionnement naturel des mains grâce au clavier de gaming ergonomique au profil bas qui permet une utilisation prolongée avec une pression minimale.

SWITCHS MÉCA-MEMBRANE RAZER
Fusionnant le retour sonore d’un switch mécanique à la sensation familière que procure un clavier conventionnel, chaque frappe est aussi satisfaisante que précise.

TOUCHES VERNIES UV
Plus durable que celui des touches ordinaires, le vernis UV garantit des légendes plus résistantes à la décoloration et une meilleure protection contre l’usure due à une utilisation fréquente.

TOUCHES MÉDIAS DÉDIÉES RÉTROÉCLAIRÉES
Configurez-les pour mettre en pause, jouer, passer et modifier absolument tout, de la luminosité au volume. Profitez d’un confort ultime tout en vous divertissant.

REPOSE-POIGNET MAGNÉTIQUE AU TOUCHER DOUX
Conçu pour s’encliqueter de manière transparente sur le clavier au profil bas, ce repose-poignet au toucher doux offre un confort et un soutien considérables à vos poignets, ce qui est particulièrement important lors d’une utilisation prolongée.

10 ZONES D’ÉCLAIRAGE RAZER CHROMA™ RGB
Grâce aux 16,8 millions de couleurs et à une suite d’effets RGB, personnalisez le clavier et profitez de ses effets d’éclairage dynamiques pour des centaines de jeux disposant de l’intégration Chroma.

Razer™ Snap Tap
Avec Razer Synapse 4 , vous pouvez donner la priorité à la dernière entrée de deux touches sélectionnées sans avoir à relâcher la première. Bénéficiez d’une meilleure réactivité pour des changements de direction quasi-instantanés.',
     'Touches au profil bas
Switchs méca-membrane Razer
Touches vernies UV',
     89.99);

INSERT INTO option_produit (id, produit_id, nom, ordre) VALUES
    (9, 4, 'Couleur', 1),
    (10, 4, 'Taille', 2),
    (11, 4, 'Disposition du clavier', 3);

INSERT INTO valeur_option (id, option_id, valeur, ordre) VALUES
    (21, 9, 'Noir', 1),
    (22, 9, 'Espeon & Umbreon Edition', 2),
    (23, 9, 'Pikachu & Eevee Edition', 3),
    (24, 9, 'BLACKPINK Edition', 4),
    (25, 10, 'Grande taille', 1),
    (26, 10, 'Sans pavé numérique', 2),
    (27, 11, 'Clavier Américain', 1),
    (28, 11, 'Clavier Français', 2);

-- Stocks : DONNÉES DE TEST (non fournies par Razer).
INSERT INTO variante (id, produit_id, reference, nom, prix, stock, est_defaut) VALUES
    (19, 4, 'RZ03-04460100-R3M1', 'Razer Ornata V3 - US - Noir', 99.99, 5, 0),
    (20, 4, 'RZ03-04460500-R3F1', 'Razer Ornata V3 - FR - Noir', 99.99, 3, 1),
    (21, 4, 'RZ03-04880100-R3M1', 'Razer Ornata V3 Tenkeyless - US - Noir', 89.99, 4, 0),
    (22, 4, 'RZ03-04880500-R3F1', 'Razer Ornata V3 Tenkeyless - FR - Noir', 89.99, 1, 0),
    (23, 4, 'RZ03-04882300-RUEA', 'Razer Ornata V3 Tenkeyless - US - Espeon & Umbreon Edition', 149.99, 3, 0),
    (24, 4, 'RZ03-04882400-RUEA', 'Razer Ornata V3 Tenkeyless - US - Pikachu & Eevee Edition', 149.99, 2, 0),
    (25, 4, 'RZ03-04882800-R3M1', 'Razer Ornata V3 Tenkeyless - US - BLACKPINK Edition', 129.99, 0, 0);

INSERT INTO variante_valeur (variante_id, valeur_id) VALUES
    (19, 21),
    (19, 25),
    (19, 27),
    (20, 21),
    (20, 25),
    (20, 28),
    (21, 21),
    (21, 26),
    (21, 27),
    (22, 21),
    (22, 26),
    (22, 28),
    (23, 22),
    (23, 26),
    (23, 27),
    (24, 23),
    (24, 26),
    (24, 27),
    (25, 24),
    (25, 26),
    (25, 27);

INSERT INTO image_produit (id, produit_id, variante_id, chemin_moyen, chemin_grand, texte_alt, est_principale, ordre) VALUES
    (40, 4, NULL, 'images/produits/ornata-v3/principale-500.webp', 'images/produits/ornata-v3/principale-500.webp', 'Razer Ornata V3', 1, 0),
    (41, 4, NULL, 'images/produits/ornata-v3/galerie-1-767.webp', 'images/produits/ornata-v3/galerie-1-1199.webp', 'Razer Ornata V3, vue 2', 0, 1),
    (42, 4, NULL, 'images/produits/ornata-v3/galerie-2-767.webp', 'images/produits/ornata-v3/galerie-2-1199.webp', 'Razer Ornata V3, vue 3', 0, 2),
    (43, 4, NULL, 'images/produits/ornata-v3/galerie-3-767.webp', 'images/produits/ornata-v3/galerie-3-1199.webp', 'Razer Ornata V3, vue 4', 0, 3),
    (44, 4, NULL, 'images/produits/ornata-v3/galerie-4-767.webp', 'images/produits/ornata-v3/galerie-4-1199.webp', 'Razer Ornata V3, vue 5', 0, 4),
    (45, 4, NULL, 'images/produits/ornata-v3/galerie-5-767.webp', 'images/produits/ornata-v3/galerie-5-1199.webp', 'Razer Ornata V3, vue 6', 0, 5),
    (46, 4, NULL, 'images/produits/ornata-v3/galerie-6-767.webp', 'images/produits/ornata-v3/galerie-6-1199.webp', 'Razer Ornata V3, vue 7', 0, 6),
    (47, 4, 19, 'images/produits/ornata-v3/principale-500.webp', 'images/produits/ornata-v3/principale-500.webp', 'Razer Ornata V3 - US - Noir', 0, 0),
    (48, 4, 20, 'images/produits/ornata-v3/principale-500.webp', 'images/produits/ornata-v3/principale-500.webp', 'Razer Ornata V3 - FR - Noir', 0, 0),
    (49, 4, 21, 'images/produits/ornata-v3/variante-rz03-04880100-r3m1-500.webp', 'images/produits/ornata-v3/variante-rz03-04880100-r3m1-500.webp', 'Razer Ornata V3 Tenkeyless - US - Noir', 0, 0),
    (50, 4, 22, 'images/produits/ornata-v3/variante-rz03-04880100-r3m1-500.webp', 'images/produits/ornata-v3/variante-rz03-04880100-r3m1-500.webp', 'Razer Ornata V3 Tenkeyless - FR - Noir', 0, 0),
    (51, 4, 23, 'images/produits/ornata-v3/variante-rz03-04882300-ruea-500.webp', 'images/produits/ornata-v3/variante-rz03-04882300-ruea-500.webp', 'Razer Ornata V3 Tenkeyless - US - Espeon & Umbreon Edition', 0, 0),
    (52, 4, 24, 'images/produits/ornata-v3/variante-rz03-04882400-ruea-500.webp', 'images/produits/ornata-v3/variante-rz03-04882400-ruea-500.webp', 'Razer Ornata V3 Tenkeyless - US - Pikachu & Eevee Edition', 0, 0),
    (53, 4, 25, 'images/produits/ornata-v3/variante-rz03-04882800-r3m1-500.webp', 'images/produits/ornata-v3/variante-rz03-04882800-r3m1-500.webp', 'Razer Ornata V3 Tenkeyless - US - BLACKPINK Edition', 0, 0);

-- ---------------------------------------------------------------------------
-- Razer DeathAdder V3 Pro (souris)
-- Source : https://www.razer.com/fr-fr/gaming-mice/razer-deathadder-v3-pro
-- Page d'achat : https://www.razer.com/fr-fr/gaming-mice/razer-deathadder-v3-pro/RZ01-04630100-R3G1
-- Prix relevés le 15/10/2026.
-- ---------------------------------------------------------------------------
INSERT INTO produit (id, categorie_id, nom, slug, accroche, description, caracteristiques, prix) VALUES
    (5, 2, 'Razer DeathAdder V3 Pro', 'razer-deathadder-v3-pro', 'Souris gaming sans fil ergonomique ultra-légère pour l''e-sport pro',
     'La victoire prend une nouvelle forme avec la Razer DeathAdder V3 Pro. Raffinée et repensée avec l’aide des meilleurs pros de l’esport, sa forme ergonomique emblématique est désormais 25 % plus légère que le modèle précédent. De plus, elle bénéficie d’un ensemble d’améliorations innovantes qui vous permettront de repousser les limites du jeu en compétition.

Ultralégère
Avec l’incroyable optimisation de son poids, la Razer DeathAdder V3 Pro est l’une des souris d’esport les plus ergonomiques et les plus légères jamais créées. Elle améliore réellement l’expérience de l’utilisateur.

Forme Ergonomique
Développée en partenariat avec les meilleurs pros de l’esport, la forme emblématique de la Razer DeathAdder a encore été améliorée pour rester fidèle à la maniabilité et au confort reconnus de ce modèle primé.

Évolutive Vers Un Polling Rate Sans Fil Réel De 8K Hz
Découvrez les performances sans fil les plus rapides jamais atteintes avec le dongle sans fil Razer HyperPolling. Profitez d’une nouvelle norme de réponse grâce à la mise à niveau ultime de nos souris les plus avancées qui vous garantit la vitesse dont vous avez besoin pour les jeux de compétition de haut niveau.

DÉBLOQUEZ DES RÉGLAGES ULTRAFINS
Activez la fonction de soulèvement asymétrique pour définir individuellement une distance de soulèvement et de pose adaptée à votre style de jeu, et ce avec 26 niveaux de réglage de la hauteur incroyablement précis par rapport aux 3 niveaux de la version précédente.

CALIBRAGE AUTOMATIQUE SUR DIFFÉRENTES SURFACES
Grâce à la technologie de suivi intelligent, le capteur optique Razer™ Focus Pro est capable de maintenir une distance de soulèvement constante, quelle que soit la surface sur laquelle il est utilisé, ce qui permet un meilleur contrôle et une plus grande précision.

UNE PLUS GRANDE RÉACTIVITÉ ET UN SUIVI PLUS COHÉRENT
Grâce à la fonction de synchronisation du mouvement, le capteur optique Razer™ Focus Pro synchronise ses signaux aux mêmes intervalles qu’utilise votre PC pour extraire des informations, ce qui vous permet d’obtenir l’emplacement exact de votre souris pour un suivi plus cohérent.',
     'Conception ultra-légère de 63 g
Forme ergonomique raffinée
Capteur optique 30 K Razer™ Focus Pro',
     159.99);

INSERT INTO option_produit (id, produit_id, nom, ordre) VALUES
    (12, 5, 'Couleur', 1),
    (13, 5, 'Texture', 2),
    (14, 5, 'Polling rate maximum', 3);

INSERT INTO valeur_option (id, option_id, valeur, ordre) VALUES
    (29, 12, 'Noir', 1),
    (30, 12, 'Blanc', 2),
    (31, 13, 'Base classique', 1),
    (32, 13, 'Toucher lisse', 2),
    (33, 14, '1000 Hz', 1),
    (34, 14, '8000 Hz', 2);

-- Stocks : DONNÉES DE TEST (non fournies par Razer).
INSERT INTO variante (id, produit_id, reference, nom, prix, stock, est_defaut) VALUES
    (26, 5, 'RZ01-04630100-R3G1', 'Razer DeathAdder V3 Pro - Noir - Classic Base - 1000 Hz', 159.99, 24, 1),
    (27, 5, 'RZ01-04630200-R3G1', 'Razer DeathAdder V3 Pro - Blanche - Classic Base - 1000 Hz', 159.99, 2, 0),
    (28, 5, 'RZ01-04630300-R3WL', 'Razer DeathAdder V3 Pro - Noir - Smooth-Touch - 8000 Hz', 189.99, 0, 0);

INSERT INTO variante_valeur (variante_id, valeur_id) VALUES
    (26, 29),
    (26, 31),
    (26, 33),
    (27, 30),
    (27, 31),
    (27, 33),
    (28, 29),
    (28, 34),
    (28, 32);

INSERT INTO image_produit (id, produit_id, variante_id, chemin_moyen, chemin_grand, texte_alt, est_principale, ordre) VALUES
    (54, 5, NULL, 'images/produits/deathadder-v3-pro/principale-500.webp', 'images/produits/deathadder-v3-pro/principale-500.webp', 'Razer DeathAdder V3 Pro', 1, 0),
    (55, 5, NULL, 'images/produits/deathadder-v3-pro/galerie-1-767.webp', 'images/produits/deathadder-v3-pro/galerie-1-1199.webp', 'Razer DeathAdder V3 Pro, vue 2', 0, 1),
    (56, 5, NULL, 'images/produits/deathadder-v3-pro/galerie-2-767.webp', 'images/produits/deathadder-v3-pro/galerie-2-1199.webp', 'Razer DeathAdder V3 Pro, vue 3', 0, 2),
    (57, 5, NULL, 'images/produits/deathadder-v3-pro/galerie-3-767.webp', 'images/produits/deathadder-v3-pro/galerie-3-1199.webp', 'Razer DeathAdder V3 Pro, vue 4', 0, 3),
    (58, 5, NULL, 'images/produits/deathadder-v3-pro/galerie-4-767.webp', 'images/produits/deathadder-v3-pro/galerie-4-1199.webp', 'Razer DeathAdder V3 Pro, vue 5', 0, 4),
    (59, 5, NULL, 'images/produits/deathadder-v3-pro/galerie-5-767.webp', 'images/produits/deathadder-v3-pro/galerie-5-1199.webp', 'Razer DeathAdder V3 Pro, vue 6', 0, 5),
    (60, 5, 26, 'images/produits/deathadder-v3-pro/principale-500.webp', 'images/produits/deathadder-v3-pro/principale-500.webp', 'Razer DeathAdder V3 Pro - Noir - Classic Base - 1000 Hz', 0, 0),
    (61, 5, 27, 'images/produits/deathadder-v3-pro/variante-rz01-04630200-r3g1-500.webp', 'images/produits/deathadder-v3-pro/variante-rz01-04630200-r3g1-500.webp', 'Razer DeathAdder V3 Pro - Blanche - Classic Base - 1000 Hz', 0, 0),
    (62, 5, 28, 'images/produits/deathadder-v3-pro/variante-rz01-04630300-r3wl-500.webp', 'images/produits/deathadder-v3-pro/variante-rz01-04630300-r3wl-500.webp', 'Razer DeathAdder V3 Pro - Noir - Smooth-Touch - 8000 Hz', 0, 0);

-- ---------------------------------------------------------------------------
-- Razer Basilisk V3 Pro 35K (souris)
-- Source : https://www.razer.com/fr-fr/gaming-mice/razer-basilisk-v3-pro-35k
-- Page d'achat : https://www.razer.com/fr-fr/gaming-mice/razer-basilisk-v3-pro-35k/RZ01-05240100-R3G1
-- Prix relevés le 15/10/2026.
-- ---------------------------------------------------------------------------
INSERT INTO produit (id, categorie_id, nom, slug, accroche, description, caracteristiques, prix) VALUES
    (6, 2, 'Razer Basilisk V3 Pro 35K', 'razer-basilisk-v3-pro-35k', 'Souris gaming sans fil RGB ergonomique entièrement personnalisable',
     'Le comble de l''immersion avec la Razer Basilisk V3 Pro 35K, une souris gaming sans fil RGB ergonomique, plus sophistiquée et plus personnalisable que jamais. Jouez vraiment comme vous l''entendez grâce à notre capteur le plus précis, ainsi que notre molette de défilement et nos options de configuration les plus poussées.

MOLETTE INCLINABLE RAZER™ HYPERSCROLL CONFIGURABLE
Choisissez entre le défilement cranté et le défilement libre et fluide, ou passez automatiquement de l''un à l''autre en fonction de votre vitesse de défilement avec le mode Molette intelligente, désormais configurable dans Synapse 4.

MODE CRANTÉ TACTILE
Pour un défilement cranté de haute précision, idéal pour parcourir vos armes ou vos sorts.

MODE DÉFILEMENT LIBRE
Pour un défilement fluide et rapide, idéal pour scroller rapidement le contenu ou émuler des commandes de jeu répétées.

MODE MOLETTE INTELLIGENTE
Activez le mode Molette intelligente pour passer automatiquement du défilement tactile au défilement libre en fonction de votre vitesse de défilement.

ACCÉLÉRATION VIRTUELLE
En activant cette fonctionnalité sur Razer Synapse 4, vous pourrez augmenter la vitesse de défilement de la souris lorsque vous effectuez un défilement rapide, ce qui vous permet de parcourir de longs documents et articles à un rythme encore plus rapide.

MODE MOLETTE INTELLIGENTE
Avec 5 niveaux allant de faible à élevé, définissez la force de défilement nécessaire pour passer automatiquement du mode cranté tactile au mode de défilement libre lorsque le mode Molette intelligente est activé.

ACCÉLÉRATION DU DÉFILEMENT RÉGLABLE
Multipliez la vitesse à laquelle vous souhaitez parcourir les contenus en choisissant parmi 5 niveaux.

ADAPTATEUR DE SENSIBILITÉ DPI
Transférez facilement et précisément les paramètres DPI de votre souris actuelle sur la Razer Basilisk V3 Pro 35K.',
     'Molette inclinable Razer™ HyperScroll configurable
Capteur optique 35 K Razer™ Focus Pro de 2e génération
Jusqu’à 140 heures avec Razer™ HyperSpeed Wireless',
     179.99);

INSERT INTO option_produit (id, produit_id, nom, ordre) VALUES
    (15, 6, 'Couleur', 1);

INSERT INTO valeur_option (id, option_id, valeur, ordre) VALUES
    (35, 15, 'Noir', 1),
    (36, 15, 'Blanc', 2),
    (37, 15, 'Phantom Green Edition', 3),
    (38, 15, 'Phantom White Edition', 4);

-- Stocks : DONNÉES DE TEST (non fournies par Razer).
INSERT INTO variante (id, produit_id, reference, nom, prix, stock, est_defaut) VALUES
    (29, 6, 'RZ01-05240100-R3G1', 'Razer Basilisk V3 Pro 35K - Noir', 179.99, 2, 1),
    (30, 6, 'RZ01-05240200-R3G1', 'Razer Basilisk V3 Pro 35K - Blanche', 179.99, 5, 0),
    (31, 6, 'RZ01-05240300-R3G1', 'Razer Basilisk V3 Pro 35K - Phantom Green Edition', 179.99, 4, 0),
    (32, 6, 'RZ01-05240400-R3G1', 'Razer Basilisk V3 Pro 35K - Phantom White Edition', 179.99, 2, 0);

INSERT INTO variante_valeur (variante_id, valeur_id) VALUES
    (29, 35),
    (30, 36),
    (31, 37),
    (32, 38);

INSERT INTO image_produit (id, produit_id, variante_id, chemin_moyen, chemin_grand, texte_alt, est_principale, ordre) VALUES
    (63, 6, NULL, 'images/produits/basilisk-v3-pro-35k/principale-500.webp', 'images/produits/basilisk-v3-pro-35k/principale-500.webp', 'Razer Basilisk V3 Pro 35K', 1, 0),
    (64, 6, NULL, 'images/produits/basilisk-v3-pro-35k/galerie-1-767.webp', 'images/produits/basilisk-v3-pro-35k/galerie-1-1199.webp', 'Razer Basilisk V3 Pro 35K, vue 2', 0, 1),
    (65, 6, NULL, 'images/produits/basilisk-v3-pro-35k/galerie-2-767.webp', 'images/produits/basilisk-v3-pro-35k/galerie-2-1199.webp', 'Razer Basilisk V3 Pro 35K, vue 3', 0, 2),
    (66, 6, NULL, 'images/produits/basilisk-v3-pro-35k/galerie-3-767.webp', 'images/produits/basilisk-v3-pro-35k/galerie-3-1199.webp', 'Razer Basilisk V3 Pro 35K, vue 4', 0, 3),
    (67, 6, NULL, 'images/produits/basilisk-v3-pro-35k/galerie-4-767.webp', 'images/produits/basilisk-v3-pro-35k/galerie-4-1199.webp', 'Razer Basilisk V3 Pro 35K, vue 5', 0, 4),
    (68, 6, NULL, 'images/produits/basilisk-v3-pro-35k/galerie-5-767.webp', 'images/produits/basilisk-v3-pro-35k/galerie-5-1199.webp', 'Razer Basilisk V3 Pro 35K, vue 6', 0, 5),
    (69, 6, NULL, 'images/produits/basilisk-v3-pro-35k/galerie-6-767.webp', 'images/produits/basilisk-v3-pro-35k/galerie-6-1199.webp', 'Razer Basilisk V3 Pro 35K, vue 7', 0, 6),
    (70, 6, 29, 'images/produits/basilisk-v3-pro-35k/principale-500.webp', 'images/produits/basilisk-v3-pro-35k/principale-500.webp', 'Razer Basilisk V3 Pro 35K - Noir', 0, 0),
    (71, 6, 30, 'images/produits/basilisk-v3-pro-35k/variante-rz01-05240200-r3g1-500.webp', 'images/produits/basilisk-v3-pro-35k/variante-rz01-05240200-r3g1-500.webp', 'Razer Basilisk V3 Pro 35K - Blanche', 0, 0),
    (72, 6, 31, 'images/produits/basilisk-v3-pro-35k/variante-rz01-05240300-r3g1-500.webp', 'images/produits/basilisk-v3-pro-35k/variante-rz01-05240300-r3g1-500.webp', 'Razer Basilisk V3 Pro 35K - Phantom Green Edition', 0, 0),
    (73, 6, 32, 'images/produits/basilisk-v3-pro-35k/variante-rz01-05240400-r3g1-500.webp', 'images/produits/basilisk-v3-pro-35k/variante-rz01-05240400-r3g1-500.webp', 'Razer Basilisk V3 Pro 35K - Phantom White Edition', 0, 0);

-- ---------------------------------------------------------------------------
-- Razer Viper V3 Pro (souris)
-- Source : https://www.razer.com/fr-fr/gaming-mice/razer-viper-v3-pro
-- Page d'achat : https://www.razer.com/fr-fr/gaming-mice/razer-viper-v3-pro/RZ01-05120100-R3G1
-- Prix relevés le 15/10/2026.
-- ---------------------------------------------------------------------------
INSERT INTO produit (id, categorie_id, nom, slug, accroche, description, caracteristiques, prix) VALUES
    (7, 2, 'Razer Viper V3 Pro', 'razer-viper-v3-pro', 'Souris gaming sans fil symétrique ultra-légère pour l''esport avec HyperPolling 8 000 Hz',
     'La GOAT des souris esport sans fil revient pour redéfinir la compétition. Avec une conception ultralégère et les meilleures technologies de sa catégorie, la Razer Viper V3 Pro est sans conteste le choix idéal pour des performances et une maniabilité optimales : c''est l’arme parfaite, conçue avec les pros et approuvée par les pros.

54 G *
Conçue en collaboration avec des pros de l''esport de renommée mondiale, la Viper V3 Pro est parfaitement équilibrée et ultralégère ; vos mouvements sont rapides, précis et intuitifs.

CONÇUE PAR LES PROS.
Une nouvelle forme, une plus grande sophistication.

Des boutons latéraux mis à jour pour une meilleure accessibilité
Des pieds de souris plus grands pour une glisse plus douce (préférés par plus de 60 % des pros)

CAPTEUR OPTIQUE 35K RAZER FOCUS PRO DE 2E GÉNÉRATION
Notre capteur optique le plus précis avec une précision de résolution de 99,8 %.

Sensibilité dynamique
Contrôlez plus précisément la sortie DPI et l''entrée de la souris pour qu''elles correspondent le mieux possible à votre style de jeu.

outil de rotation
réglez l''orientation de la souris pour les mouvements horizontaux.

RÉGLAGES PAR PALIERS DE DPI
Obtenez une sensibilité parfaite au pixel près, avec des paliers au DPI près.

ADAPTATEUR DE SENSIBILITÉ
Utilisez les paramètres DPI de votre souris actuelle sur la Viper V3 Pro.',
     'Conception ultralégère de 54 g
Capteur optique 35K Razer™ Focus Pro de 2e génération
Technologie Razer™ 8K Hz HyperPolling',
     179.99);

INSERT INTO option_produit (id, produit_id, nom, ordre) VALUES
    (16, 7, 'Couleur', 1);

INSERT INTO valeur_option (id, option_id, valeur, ordre) VALUES
    (39, 16, 'Noir', 1),
    (40, 16, 'Blanc', 2),
    (41, 16, 'Sentinels Edition', 3),
    (42, 16, 'Faker Edition', 4),
    (43, 16, 'Esports Green Edition', 5),
    (44, 16, 'Counter-Strike 2 Edition', 6);

-- Stocks : DONNÉES DE TEST (non fournies par Razer).
INSERT INTO variante (id, produit_id, reference, nom, prix, stock, est_defaut) VALUES
    (33, 7, 'RZ01-05120100-R3G1', 'Razer Viper V3 Pro - Noir', 179.99, 15, 1),
    (34, 7, 'RZ01-05120200-R3G1', 'Razer Viper V3 Pro - Blanche', 179.99, 7, 0),
    (35, 7, 'RZ01-05120400-R3M1', 'Razer Viper V3 Pro - Sentinels Edition', 199.99, 8, 0),
    (36, 7, 'RZ01-05120500-R3M1', 'Razer Viper V3 Pro - Faker Edition', 199.99, 9, 0),
    (37, 7, 'RZ01-05120600-R3M1', 'Razer Viper V3 Pro - Esports Green Edition', 189.88, 10, 0),
    (38, 7, 'RZ01-05120800-R3M1', 'Razer Viper V3 Pro - Counter-Strike 2 Edition', 189.99, 2, 0);

INSERT INTO variante_valeur (variante_id, valeur_id) VALUES
    (33, 39),
    (34, 40),
    (35, 41),
    (36, 42),
    (37, 43),
    (38, 44);

INSERT INTO image_produit (id, produit_id, variante_id, chemin_moyen, chemin_grand, texte_alt, est_principale, ordre) VALUES
    (74, 7, NULL, 'images/produits/viper-v3-pro/principale-500.webp', 'images/produits/viper-v3-pro/principale-500.webp', 'Razer Viper V3 Pro', 1, 0),
    (75, 7, NULL, 'images/produits/viper-v3-pro/galerie-1-767.webp', 'images/produits/viper-v3-pro/galerie-1-1199.webp', 'Razer Viper V3 Pro, vue 2', 0, 1),
    (76, 7, NULL, 'images/produits/viper-v3-pro/galerie-2-767.webp', 'images/produits/viper-v3-pro/galerie-2-1199.webp', 'Razer Viper V3 Pro, vue 3', 0, 2),
    (77, 7, NULL, 'images/produits/viper-v3-pro/galerie-3-767.webp', 'images/produits/viper-v3-pro/galerie-3-1199.webp', 'Razer Viper V3 Pro, vue 4', 0, 3),
    (78, 7, NULL, 'images/produits/viper-v3-pro/galerie-4-767.webp', 'images/produits/viper-v3-pro/galerie-4-1199.webp', 'Razer Viper V3 Pro, vue 5', 0, 4),
    (79, 7, NULL, 'images/produits/viper-v3-pro/galerie-5-767.webp', 'images/produits/viper-v3-pro/galerie-5-1199.webp', 'Razer Viper V3 Pro, vue 6', 0, 5),
    (80, 7, NULL, 'images/produits/viper-v3-pro/galerie-6-767.webp', 'images/produits/viper-v3-pro/galerie-6-1199.webp', 'Razer Viper V3 Pro, vue 7', 0, 6),
    (81, 7, 33, 'images/produits/viper-v3-pro/principale-500.webp', 'images/produits/viper-v3-pro/principale-500.webp', 'Razer Viper V3 Pro - Noir', 0, 0),
    (82, 7, 34, 'images/produits/viper-v3-pro/variante-rz01-05120200-r3g1-500.webp', 'images/produits/viper-v3-pro/variante-rz01-05120200-r3g1-500.webp', 'Razer Viper V3 Pro - Blanche', 0, 0),
    (83, 7, 35, 'images/produits/viper-v3-pro/variante-rz01-05120400-r3m1-500.webp', 'images/produits/viper-v3-pro/variante-rz01-05120400-r3m1-500.webp', 'Razer Viper V3 Pro - Sentinels Edition', 0, 0),
    (84, 7, 36, 'images/produits/viper-v3-pro/variante-rz01-05120500-r3m1-500.webp', 'images/produits/viper-v3-pro/variante-rz01-05120500-r3m1-500.webp', 'Razer Viper V3 Pro - Faker Edition', 0, 0),
    (85, 7, 37, 'images/produits/viper-v3-pro/variante-rz01-05120600-r3m1-500.webp', 'images/produits/viper-v3-pro/variante-rz01-05120600-r3m1-500.webp', 'Razer Viper V3 Pro - Esports Green Edition', 0, 0),
    (86, 7, 38, 'images/produits/viper-v3-pro/variante-rz01-05120800-r3m1-500.webp', 'images/produits/viper-v3-pro/variante-rz01-05120800-r3m1-500.webp', 'Razer Viper V3 Pro - Counter-Strike 2 Edition', 0, 0);

-- ---------------------------------------------------------------------------
-- Razer Cobra (souris)
-- Source : https://www.razer.com/fr-fr/gaming-mice/razer-cobra
-- Page d'achat : https://www.razer.com/fr-fr/gaming-mice/razer-cobra/RZ01-04650100-R3M1
-- Prix relevés le 15/10/2026.
-- ---------------------------------------------------------------------------
INSERT INTO produit (id, categorie_id, nom, slug, accroche, description, caracteristiques, prix) VALUES
    (8, 2, 'Razer Cobra', 'razer-cobra', 'Souris gaming filaire légère avec Razer Chroma™ RGB',
     'Vous visez la précision et l’immersion ? Frappez dans le mille avec la Razer Cobra, une souris gaming filaire et légère alimentée par Razer Chroma RGB. Armée de switches ultra-durables et dotée d’un éclairage sous-jacent Chroma dégradé, elle vous surprendra par ses puissantes performances pour une très petite taille.

CONCEPTION LÉGÈRE DE 58 G
Avec un design léger qui s’adapte à la plupart des styles de prise, la Razer Cobra permet non seulement un contrôle rapide et précis, mais aussi un confort d’utilisation incroyable, même pendant les longues sessions de jeu.

ÉCLAIRAGE CHROMA AVEC LUMIÈRE SOUS‑JACENTE DÉGRADÉE
Personnalisez la Razer Cobra avec environ 16,8 millions de couleurs et d’innombrables effets d’éclairage. Profitez d’une plus grande immersion avec une souris gaming RGB qui réagit de manière dynamique avec des centaines de jeux intégrés à Chroma.

SWITCHES OPTIQUES DE SOURIS RAZER™ DE 3E GÉNÉRATION
Avec un cycle de vie amélioré de 90 millions de clics - sans problème de double clic - et un temps d’activation de 0,2 ms sans délai anti-rebond, profitez d’une fiabilité et d’une rapidité qui éclipsent tous les autres modèles.

RÉGLAGES PRÉCIS DU CAPTEUR
Réglez la sensibilité de la Razer Cobra en effectuant des ajustements précis par incréments de 50 DPI. Vous obtiendrez le réglage parfait qui correspond exactement à votre style de jeu.

CÂBLE RAZER™ SPEEDFLEX
Le câble de la Razer Cobra est plus flexible et il est conçu pour générer une traînée minimale afin que vous puissiez effectuer des mouvements rapides et fluides tout en bénéficiant d’un contrôle accru.

FONCTIONNALITÉS PLUS AVANCÉES
Fabriqués à partir du PTFE le plus pur et de la plus haute qualité, les pieds de souris de la Razer Cobra, à l’avant, à l’arrière et sur l’anneau du capteur lui permettent de glisser en douceur sur n’importe quelle surface.

PROFIL DE MÉMOIRE INTÉGRÉ
Soyez prêt à jouer n’importe où grâce à l’accès à votre dernier profil Razer Synapse utilisé, comprenant notamment les paramètres DPI personnalisés, les configurations des boutons, et plus encore.',
     'Conception légère de 58 g
Switchs optiques de souris Razer™ de 3e génération
Éclairage Chroma avec éclairage sous-jacent dégradé',
     49.99);

INSERT INTO option_produit (id, produit_id, nom, ordre) VALUES
    (17, 8, 'Couleur', 1);

INSERT INTO valeur_option (id, option_id, valeur, ordre) VALUES
    (45, 17, 'Noir', 1),
    (46, 17, 'Minecraft Edition', 2),
    (47, 17, 'Pokémon Edition', 3),
    (48, 17, 'Gengar Edition', 4),
    (49, 17, 'Espeon & Umbreon Edition', 5),
    (50, 17, 'Pikachu & Eevee Edition', 6);

-- Stocks : DONNÉES DE TEST (non fournies par Razer).
INSERT INTO variante (id, produit_id, reference, nom, prix, stock, est_defaut) VALUES
    (39, 8, 'RZ01-04650100-R3M1', 'Razer Cobra - Noir', 49.99, 0, 1),
    (40, 8, 'RZ01-04650200-R3M1', 'Razer Cobra - Minecraft Edition', 69.99, 0, 0),
    (41, 8, 'RZ01-04650400-R3M1', 'Razer Cobra - Pokémon Edition', 69.99, 0, 0),
    (42, 8, 'RZ01-04650700-R3M1', 'Razer Cobra - Gengar Edition', 69.99, 0, 0),
    (43, 8, 'RZ01-04650800-RUEA', 'Razer Cobra - Espeon & Umbreon Edition', 79.99, 0, 0),
    (44, 8, 'RZ01-04650900-RUEA', 'Razer Cobra - Pikachu & Eevee Edition', 79.99, 0, 0);

INSERT INTO variante_valeur (variante_id, valeur_id) VALUES
    (39, 45),
    (40, 46),
    (41, 47),
    (42, 48),
    (43, 49),
    (44, 50);

INSERT INTO image_produit (id, produit_id, variante_id, chemin_moyen, chemin_grand, texte_alt, est_principale, ordre) VALUES
    (87, 8, NULL, 'images/produits/cobra/principale-500.webp', 'images/produits/cobra/principale-500.webp', 'Razer Cobra', 1, 0),
    (88, 8, NULL, 'images/produits/cobra/galerie-1-767.webp', 'images/produits/cobra/galerie-1-1199.webp', 'Razer Cobra, vue 2', 0, 1),
    (89, 8, NULL, 'images/produits/cobra/galerie-2-767.webp', 'images/produits/cobra/galerie-2-1199.webp', 'Razer Cobra, vue 3', 0, 2),
    (90, 8, NULL, 'images/produits/cobra/galerie-3-767.webp', 'images/produits/cobra/galerie-3-1199.webp', 'Razer Cobra, vue 4', 0, 3),
    (91, 8, NULL, 'images/produits/cobra/galerie-4-767.webp', 'images/produits/cobra/galerie-4-1199.webp', 'Razer Cobra, vue 5', 0, 4),
    (92, 8, NULL, 'images/produits/cobra/galerie-5-767.webp', 'images/produits/cobra/galerie-5-1199.webp', 'Razer Cobra, vue 6', 0, 5),
    (93, 8, NULL, 'images/produits/cobra/galerie-6-767.webp', 'images/produits/cobra/galerie-6-1199.webp', 'Razer Cobra, vue 7', 0, 6),
    (94, 8, 39, 'images/produits/cobra/principale-500.webp', 'images/produits/cobra/principale-500.webp', 'Razer Cobra - Noir', 0, 0),
    (95, 8, 40, 'images/produits/cobra/variante-rz01-04650200-r3m1-500.webp', 'images/produits/cobra/variante-rz01-04650200-r3m1-500.webp', 'Razer Cobra - Minecraft Edition', 0, 0),
    (96, 8, 41, 'images/produits/cobra/variante-rz01-04650400-r3m1-500.webp', 'images/produits/cobra/variante-rz01-04650400-r3m1-500.webp', 'Razer Cobra - Pokémon Edition', 0, 0),
    (97, 8, 42, 'images/produits/cobra/variante-rz01-04650700-r3m1-500.webp', 'images/produits/cobra/variante-rz01-04650700-r3m1-500.webp', 'Razer Cobra - Gengar Edition', 0, 0),
    (98, 8, 43, 'images/produits/cobra/variante-rz01-04650800-ruea-500.webp', 'images/produits/cobra/variante-rz01-04650800-ruea-500.webp', 'Razer Cobra - Espeon & Umbreon Edition', 0, 0),
    (99, 8, 44, 'images/produits/cobra/variante-rz01-04650900-ruea-500.webp', 'images/produits/cobra/variante-rz01-04650900-ruea-500.webp', 'Razer Cobra - Pikachu & Eevee Edition', 0, 0);

-- ---------------------------------------------------------------------------
-- Razer BlackShark V2 Pro (casques)
-- Source : https://www.razer.com/fr-fr/gaming-headsets/razer-blackshark-v2-pro
-- Page d'achat : https://www.razer.com/fr-fr/gaming-headsets/razer-blackshark-v2-pro/RZ04-04530100-R3M1
-- Prix relevés le 15/10/2026.
-- ---------------------------------------------------------------------------
INSERT INTO produit (id, categorie_id, nom, slug, accroche, description, caracteristiques, prix) VALUES
    (9, 3, 'Razer BlackShark V2 Pro', 'razer-blackshark-v2-pro', 'Casque gaming esport sans fil avec isolation du bruit avancée pour les jeux compétitifs',
     'Si l’esport est votre vocation, jouez-y avec le meilleur casque gaming sans-fil pour la compétition, développé en collaboration avec les meilleurs professionnels de l’esport. Primé à de nombreuses reprises, le Razer BlackShark V2 Pro profite de sons cristallins, d’une isolation phonique avancée et d''un confort permanent : il est conçu pour des performances pures.

MICRO À TRÈS LARGE BANDE RAZER HYPERCLEAR
Grâce à une gamme plus large de fréquences sonores, ce micro amovible de nouvelle génération capte et transmet une quantité phénoménale de détails dans votre voix : toutes les informations que vous donnerez à votre équipe profitent d''un rendu clair, puissant et naturel.

HAUT-PARLEURS EN TITANE DE 50 MM RAZER TRIFORCE
Doté de diaphragmes recouverts de titane offrant davantage de clarté, notre design breveté à la pointe de la technologie divise le haut-parleur en 3 parties permettant de régler individuellement les sons aigus, moyens et graves. Profitez de vos jeux avec un son d’une clarté absolue.

DES PROFILS SONORES OPTIMISÉS POUR LES FPS
Proposés par certains des meilleurs athlètes esport du monde, les profils audio FPS du casque vous fournissent un maximum d’informations pour un avantage compétitif ultime. Écoutez comme un pro ! Personnalisez facilement vos profils via Razer Synapse, puis enregistrez-les sur le casque pour les utiliser où que vous alliez sans avoir besoin de logiciel supplémentaire.

LÉGER. CONFORTABLE. DURABLE.
Tissage respirant qui vous aide à rester au frais et à l’aise.

ARCEAU AJUSTABLE EN ACIER RENFORCÉ
Une robustesse et une flexibilité accrue.

PROFIL ET FORCE DE SERRAGE OPTIMISÉS
Amélioration de l’étanchéité et de l’isolation acoustique pour une concentration absolue.

TAILLÉ POUR LA PERFORMANCE
Connexion 2,4 GHz à la pointe de l’industrie pour des jeux à très faible latence.

70 HEURES D’AUTONOMIE DE LA BATTERIE AVEC CHARGEMENT PAR TYPE C
Jouez pendant 6 heures avec seulement 15 minutes de charge.',
     'Micro à très large bande Razer™ HyperClear
Haut-parleurs en titane de 50 mm Razer™ TriForce
Technologie Razer™ HyperSpeed Wireless',
     229.99);

INSERT INTO option_produit (id, produit_id, nom, ordre) VALUES
    (18, 9, 'Couleur', 1);

INSERT INTO valeur_option (id, option_id, valeur, ordre) VALUES
    (51, 18, 'Noir', 1),
    (52, 18, 'Blanc', 2);

-- Stocks : DONNÉES DE TEST (non fournies par Razer).
INSERT INTO variante (id, produit_id, reference, nom, prix, stock, est_defaut) VALUES
    (45, 9, 'RZ04-04530100-R3M1', 'Razer BlackShark V2 Pro - Noir', 229.99, 9, 1),
    (46, 9, 'RZ04-04530200-R3M1', 'Razer BlackShark V2 Pro - Blanc', 229.99, 0, 0);

INSERT INTO variante_valeur (variante_id, valeur_id) VALUES
    (45, 51),
    (46, 52);

INSERT INTO image_produit (id, produit_id, variante_id, chemin_moyen, chemin_grand, texte_alt, est_principale, ordre) VALUES
    (100, 9, NULL, 'images/produits/blackshark-v2-pro/principale-500.webp', 'images/produits/blackshark-v2-pro/principale-500.webp', 'Razer BlackShark V2 Pro', 1, 0),
    (101, 9, NULL, 'images/produits/blackshark-v2-pro/galerie-1-767.webp', 'images/produits/blackshark-v2-pro/galerie-1-1199.webp', 'Razer BlackShark V2 Pro, vue 2', 0, 1),
    (102, 9, NULL, 'images/produits/blackshark-v2-pro/galerie-2-767.webp', 'images/produits/blackshark-v2-pro/galerie-2-1199.webp', 'Razer BlackShark V2 Pro, vue 3', 0, 2),
    (103, 9, NULL, 'images/produits/blackshark-v2-pro/galerie-3-767.webp', 'images/produits/blackshark-v2-pro/galerie-3-1199.webp', 'Razer BlackShark V2 Pro, vue 4', 0, 3),
    (104, 9, NULL, 'images/produits/blackshark-v2-pro/galerie-4-767.webp', 'images/produits/blackshark-v2-pro/galerie-4-1199.webp', 'Razer BlackShark V2 Pro, vue 5', 0, 4),
    (105, 9, NULL, 'images/produits/blackshark-v2-pro/galerie-5-767.webp', 'images/produits/blackshark-v2-pro/galerie-5-1199.webp', 'Razer BlackShark V2 Pro, vue 6', 0, 5),
    (106, 9, NULL, 'images/produits/blackshark-v2-pro/galerie-6-767.webp', 'images/produits/blackshark-v2-pro/galerie-6-1199.webp', 'Razer BlackShark V2 Pro, vue 7', 0, 6),
    (107, 9, 45, 'images/produits/blackshark-v2-pro/principale-500.webp', 'images/produits/blackshark-v2-pro/principale-500.webp', 'Razer BlackShark V2 Pro - Noir', 0, 0),
    (108, 9, 46, 'images/produits/blackshark-v2-pro/variante-rz04-04530200-r3m1-500.webp', 'images/produits/blackshark-v2-pro/variante-rz04-04530200-r3m1-500.webp', 'Razer BlackShark V2 Pro - Blanc', 0, 0);

-- ---------------------------------------------------------------------------
-- Razer BlackShark V2 X (casques)
-- Source : https://www.razer.com/fr-fr/gaming-headsets/razer-blackshark-v2-x
-- Page d'achat : https://www.razer.com/fr-fr/gaming-headsets/razer-blackshark-v2-x/RZ04-03240100-R3M1
-- Prix relevés le 15/10/2026.
-- ---------------------------------------------------------------------------
INSERT INTO produit (id, categorie_id, nom, slug, accroche, description, caracteristiques, prix) VALUES
    (10, 3, 'Razer BlackShark V2 X', 'razer-blackshark-v2-x', 'Casque filaire multiplateforme pour l’esport',
     'Conçu pour être à la hauteur quand cela compte le plus. Le casque gaming esport Razer BlackShark V2 X allie légèreté et confort à un audio de jeu de haute qualité, un microphone cardioïde d’une clarté cristalline et une annulation passive du bruit avancée. Il est conçu pour les gamers de compétition qui exigent la précision.

HAUT-PARLEURS DE 50 MM RAZER™ TRIFORCE
Un haut-parleur. Trois fréquences réglables. Nos haut-parleurs 50 mm Razer TriForce brevetés permettent aux ingénieurs de régler séparément les aigus, les médiums et les basses ; pour des aigus plus nets, des médiums plus clairs et des basses plus percutantes, offrant un audio de jeu immersif.

Micro cardioïde Razer™ HyperClear
Un mode de captation amélioré permet d’entendre plus de voix et moins de bruits. Ces derniers s’atténuent à l’arrière et sur les côtés du micro qui se place facilement près de votre bouche grâce à sa flexibilité.

ANNULATION PASSIVE DU BRUIT AVANCÉE
Que les bruits proviennent de la foule ou du bourdonnement de votre matériel, les oreillettes couvrent entièrement vos oreilles, empêchant le bruit de filtrer dans le casque. En outre, ses coussinets vous permettront de profiter d’une meilleure isolation passive du bruit.

CONCEPTION ULTRALÉGÈRE AVEC COUSSINETS D’OREILLE EN MOUSSE À MÉMOIRE DE FORME
Ne pesant que 240 g, le bandeau associe un rembourrage moelleux à un revêtement en similicuir doux, et s’accompagne de coussinets d’oreille en mousse à mémoire de forme pour un confort qui ne faiblit jamais, même lors des sessions gaming les plus longues.

SON SURROUND 7.1
Rien n’échappe à vos oreilles. Le son surround 7.1 avec audio positionnel de précision vous permet de localiser chaque pas, coup de feu et signal audio en jeu dès qu’ils surviennent.

COMPATIBILITÉ ENTRE PLATEFORMES
PC. Mac. PS5. Xbox. Nintendo Switch. Mobile. Où que vous jouiez, votre avantage audio vous suit sur toutes les plateformes prises en charge.

CONCEPTION DURABLE
Une âme d’acier inoxydable traverse le bandeau, renforcée par une couche interne de soutien et enveloppée de similicuir durable : conçue pour conserver sa forme lors d’un usage quotidien, session après session.',
     'Haut-parleurs de 50 mm Razer™ TriForce
Micro cardioïde Razer™ HyperClear
Confort et légèreté',
     69.99);

INSERT INTO option_produit (id, produit_id, nom, ordre) VALUES
    (19, 10, 'Couleur', 1);

INSERT INTO valeur_option (id, option_id, valeur, ordre) VALUES
    (53, 19, 'Noir', 1),
    (54, 19, 'Vert', 2),
    (55, 19, 'Blanc', 3),
    (56, 19, 'Quartz', 4);

-- Stocks : DONNÉES DE TEST (non fournies par Razer).
INSERT INTO variante (id, produit_id, reference, nom, prix, stock, est_defaut) VALUES
    (47, 10, 'RZ04-03240100-R3M1', 'Razer BlackShark V2 X - Noir', 79.99, 8, 1),
    (48, 10, 'RZ04-03240600-R3M1', 'Razer BlackShark V2 X - Vert', 79.99, 7, 0),
    (49, 10, 'RZ04-03240700-R3M1', 'Razer BlackShark V2 X - Blanc', 79.99, 8, 0),
    (50, 10, 'RZ04-03240800-R3M1', 'Razer BlackShark V2 X - Quartz', 69.99, 2, 0);

INSERT INTO variante_valeur (variante_id, valeur_id) VALUES
    (47, 53),
    (48, 54),
    (49, 55),
    (50, 56);

INSERT INTO image_produit (id, produit_id, variante_id, chemin_moyen, chemin_grand, texte_alt, est_principale, ordre) VALUES
    (109, 10, NULL, 'images/produits/blackshark-v2-x/principale-500.webp', 'images/produits/blackshark-v2-x/principale-500.webp', 'Razer BlackShark V2 X', 1, 0),
    (110, 10, NULL, 'images/produits/blackshark-v2-x/galerie-1-767.webp', 'images/produits/blackshark-v2-x/galerie-1-1199.webp', 'Razer BlackShark V2 X, vue 2', 0, 1),
    (111, 10, NULL, 'images/produits/blackshark-v2-x/galerie-2-767.webp', 'images/produits/blackshark-v2-x/galerie-2-1199.webp', 'Razer BlackShark V2 X, vue 3', 0, 2),
    (112, 10, NULL, 'images/produits/blackshark-v2-x/galerie-3-767.webp', 'images/produits/blackshark-v2-x/galerie-3-1199.webp', 'Razer BlackShark V2 X, vue 4', 0, 3),
    (113, 10, NULL, 'images/produits/blackshark-v2-x/galerie-4-767.webp', 'images/produits/blackshark-v2-x/galerie-4-1199.webp', 'Razer BlackShark V2 X, vue 5', 0, 4),
    (114, 10, NULL, 'images/produits/blackshark-v2-x/galerie-5-767.webp', 'images/produits/blackshark-v2-x/galerie-5-1199.webp', 'Razer BlackShark V2 X, vue 6', 0, 5),
    (115, 10, NULL, 'images/produits/blackshark-v2-x/galerie-6-767.webp', 'images/produits/blackshark-v2-x/galerie-6-1199.webp', 'Razer BlackShark V2 X, vue 7', 0, 6),
    (116, 10, 47, 'images/produits/blackshark-v2-x/principale-500.webp', 'images/produits/blackshark-v2-x/principale-500.webp', 'Razer BlackShark V2 X - Noir', 0, 0),
    (117, 10, 48, 'images/produits/blackshark-v2-x/variante-rz04-03240600-r3m1-500.webp', 'images/produits/blackshark-v2-x/variante-rz04-03240600-r3m1-500.webp', 'Razer BlackShark V2 X - Vert', 0, 0),
    (118, 10, 49, 'images/produits/blackshark-v2-x/variante-rz04-03240700-r3m1-500.webp', 'images/produits/blackshark-v2-x/variante-rz04-03240700-r3m1-500.webp', 'Razer BlackShark V2 X - Blanc', 0, 0),
    (119, 10, 50, 'images/produits/blackshark-v2-x/variante-rz04-03240800-r3m1-500.webp', 'images/produits/blackshark-v2-x/variante-rz04-03240800-r3m1-500.webp', 'Razer BlackShark V2 X - Quartz', 0, 0);

-- ---------------------------------------------------------------------------
-- Razer Barracuda X (casques)
-- Source : https://www.razer.com/fr-fr/gaming-headsets/razer-barracuda-x
-- Page d'achat : https://www.razer.com/fr-fr/gaming-headsets/razer-barracuda-x/RZ04-04430100-R3M1
-- Prix relevés le 15/10/2026.
-- ---------------------------------------------------------------------------
INSERT INTO produit (id, categorie_id, nom, slug, accroche, description, caracteristiques, prix) VALUES
    (11, 3, 'Razer Barracuda X', 'razer-barracuda-x', 'Casque gaming sans fil multiplateforme pour une expérience de jeu fluide à la maison comme en déplacement',
     'Un seul casque pour tous vos jeux : le Razer Barracuda X est un casque de gaming sans fil polyvalent et léger, conçu pour être utilisé facilement sur PC, console et appareils mobiles. Grâce à une conception intelligente double sans fil, passez facilement d’un jeu haute performance à la maison à une utilisation mobile fluide dans la rue.

Grâce à sa capacité à se connecter à la fois à un appareil 2,4 GHz et à un appareil Bluetooth, le SmartSwitch permet de passer simplement de l’un à l’autre, pour un confort inégalé.

Les appels provenant d’un appareil Bluetooth connecté passeront automatiquement par le casque, ce qui vous permet de répondre à l’appel puis de revenir au son du jeu sans jamais retirer le casque.

Le mode Ne pas déranger peut être activé dans l’application Razer Audio si vous souhaitez bloquer les appels entrants, tandis qu’un bouton dédié sur le casque vous permet de basculer manuellement entre les sources audio HyperSpeed Wireless et Bluetooth.

Que vous soyez à la maison pour un marathon de jeu ou que vous vous divertissiez pendant votre trajet quotidien au travail, le Razer Barracuda X a tout ce qu’il faut en matière de confort.

Notre conception brevetée de haut-parleurs en 3 parties permet de profiter de sons aigus, moyens et graves exceptionnels et précis, offrant ainsi une expérience de jeu en immersion totale et une écoute plus dynamique de la musique et les vidéos.

Tandis que le micro est réglé pour supprimer le bruit de fond pour une captation améliorée de la voix lors de vos sessions de jeu, il est facilement amovible pour obtenir un casque qui vous suit partout lors de vos déplacements.

Profitez d’une facilité de contrôle sur votre musique, vos vidéos et vos appels grâce aux boutons aisément accessibles situés en dessous des oreillettes du Razer Barracuda X.

Doté d’assez de puissance pour que vous puissiez l’utiliser durant toute une journée de jeu et de déplacements, le Razer Barracuda X est conçu pour avoir une longévité qui correspond à sa polyvalence.',
     'Razer™ SmartSwitch Dual Wireless
Conception ergonomique avec un poids de 250 g
Haut-parleurs de 40 mm Razer™ TriForce',
     119.99);

INSERT INTO option_produit (id, produit_id, nom, ordre) VALUES
    (20, 11, 'Couleur', 1);

INSERT INTO valeur_option (id, option_id, valeur, ordre) VALUES
    (57, 20, 'Noir', 1),
    (58, 20, 'Mercury', 2),
    (59, 20, 'Quartz', 3);

-- Stocks : DONNÉES DE TEST (non fournies par Razer).
INSERT INTO variante (id, produit_id, reference, nom, prix, stock, est_defaut) VALUES
    (51, 11, 'RZ04-04430100-R3M1', 'Razer Barracuda X - Noir', 119.99, 4, 1),
    (52, 11, 'RZ04-04430200-R3M1', 'Razer Barracuda X - Mercury', 119.99, 5, 0),
    (53, 11, 'RZ04-04430300-R3M1', 'Razer Barracuda X - Quartz', 119.99, 2, 0);

INSERT INTO variante_valeur (variante_id, valeur_id) VALUES
    (51, 57),
    (52, 58),
    (53, 59);

INSERT INTO image_produit (id, produit_id, variante_id, chemin_moyen, chemin_grand, texte_alt, est_principale, ordre) VALUES
    (120, 11, NULL, 'images/produits/barracuda-x/principale-500.webp', 'images/produits/barracuda-x/principale-500.webp', 'Razer Barracuda X', 1, 0),
    (121, 11, NULL, 'images/produits/barracuda-x/galerie-1-767.webp', 'images/produits/barracuda-x/galerie-1-1199.webp', 'Razer Barracuda X, vue 2', 0, 1),
    (122, 11, NULL, 'images/produits/barracuda-x/galerie-2-767.webp', 'images/produits/barracuda-x/galerie-2-1199.webp', 'Razer Barracuda X, vue 3', 0, 2),
    (123, 11, NULL, 'images/produits/barracuda-x/galerie-3-767.webp', 'images/produits/barracuda-x/galerie-3-1199.webp', 'Razer Barracuda X, vue 4', 0, 3),
    (124, 11, NULL, 'images/produits/barracuda-x/galerie-4-767.webp', 'images/produits/barracuda-x/galerie-4-1199.webp', 'Razer Barracuda X, vue 5', 0, 4),
    (125, 11, NULL, 'images/produits/barracuda-x/galerie-5-767.webp', 'images/produits/barracuda-x/galerie-5-1199.webp', 'Razer Barracuda X, vue 6', 0, 5),
    (126, 11, NULL, 'images/produits/barracuda-x/galerie-6-767.webp', 'images/produits/barracuda-x/galerie-6-1199.webp', 'Razer Barracuda X, vue 7', 0, 6),
    (127, 11, 51, 'images/produits/barracuda-x/principale-500.webp', 'images/produits/barracuda-x/principale-500.webp', 'Razer Barracuda X - Noir', 0, 0),
    (128, 11, 52, 'images/produits/barracuda-x/variante-rz04-04430200-r3m1-500.webp', 'images/produits/barracuda-x/variante-rz04-04430200-r3m1-500.webp', 'Razer Barracuda X - Mercury', 0, 0),
    (129, 11, 53, 'images/produits/barracuda-x/variante-rz04-04430300-r3m1-500.webp', 'images/produits/barracuda-x/variante-rz04-04430300-r3m1-500.webp', 'Razer Barracuda X - Quartz', 0, 0);

-- ---------------------------------------------------------------------------
-- Razer Kraken Kitty V2 (casques)
-- Source : https://www.razer.com/fr-fr/gaming-headsets/razer-kraken-kitty-v2
-- Page d'achat : https://www.razer.com/fr-fr/gaming-headsets/razer-kraken-kitty-v2/RZ04-04730100-R3M1
-- Prix relevés le 15/10/2026.
-- ---------------------------------------------------------------------------
INSERT INTO produit (id, categorie_id, nom, slug, accroche, description, caracteristiques, prix) VALUES
    (12, 3, 'Razer Kraken Kitty V2', 'razer-kraken-kitty-v2', 'Casque filaire RGB avec oreilles de chat',
     'Créez votre personnage de stream le plus adorable dans un style félin mortel avec le nouveau Razer Kraken Kitty Edition V2. Démarquez-vous et faites tourner les têtes avec des oreilles de chat uniques alimentées par Razer Chroma™ RGB et faites le show avec un éclairage réagissant au streaming et un micro d’une grande clarté.

OREILLES DE CHAT
Avec cette paire unique d’oreilles de chat, démarquez-vous lors des streams avec un casque dont le style reflète votre personnalité.

ÉCLAIRAGE RÉAGISSANT AU STREAMING
Dévoilez votre personnalité colorée et interpellez vos spectateurs grâce à l’éclairage des oreillettes qui réagit aux émoticônes, aux alertes et plus encore. Il peut être personnalisé avec plus de 16,8 millions de couleurs et d’innombrables effets.

LE SON EST AUSSI BON QUE SON LOOK
Conçu pour diminuer le bruit provenant de toutes les directions, ce micro vous garantit que votre voix sera aussi claire que votre style.

Haut-parleurs de 40 mm Razer™ TriForce
La conception brevetée en 3 parties des haut-parleurs du casque permet d’obtenir des aigus, des médiums et des graves exceptionnels sans distorsion, pour une clarté et une qualité de son exceptionnelles.

Son Surround 7.1
Soyez plus attentif au jeu et ne laissez rien échapper à vos oreilles de chat grâce au son positionnel précis qui vous permet de localiser précisément d’où vient chaque bruit.

Coussinets En Tissu Hybride Et En Similicuir
Un look d''enfer et un confort absolu. Les oreillettes douces et confortables du casque vous offrent des heures de streaming sans éprouver de fatigue, et leur excellente isolation sonore assurent une immersion totale en jeu.',
     'Oreilles de chat
Éclairage réagissant au streaming
Micro cardioïde Razer™ HyperClear',
     119.99);

INSERT INTO option_produit (id, produit_id, nom, ordre) VALUES
    (21, 12, 'Couleur', 1);

INSERT INTO valeur_option (id, option_id, valeur, ordre) VALUES
    (60, 21, 'Noir', 1),
    (61, 21, 'Quartz', 2),
    (62, 21, 'Gengar Edition', 3),
    (63, 21, 'Blanc', 4);

-- Stocks : DONNÉES DE TEST (non fournies par Razer).
INSERT INTO variante (id, produit_id, reference, nom, prix, stock, est_defaut) VALUES
    (54, 12, 'RZ04-04730100-R3M1', 'Razer Kraken Kitty V2 - Noir', 119.99, 6, 1),
    (55, 12, 'RZ04-04730200-R3M1', 'Razer Kraken Kitty V2 - Quartz', 119.99, 7, 0),
    (56, 12, 'RZ04-04730300-R3M1', 'Razer Kraken Kitty V2 - Gengar Edition', 159.99, 8, 0),
    (57, 12, 'RZ04-04730600-R3M1', 'Razer Kraken Kitty V2 - Blanc', 119.99, 2, 0);

INSERT INTO variante_valeur (variante_id, valeur_id) VALUES
    (54, 60),
    (55, 61),
    (56, 62),
    (57, 63);

INSERT INTO image_produit (id, produit_id, variante_id, chemin_moyen, chemin_grand, texte_alt, est_principale, ordre) VALUES
    (130, 12, NULL, 'images/produits/kraken-kitty-v2/principale-500.webp', 'images/produits/kraken-kitty-v2/principale-500.webp', 'Razer Kraken Kitty V2', 1, 0),
    (131, 12, NULL, 'images/produits/kraken-kitty-v2/galerie-1-767.webp', 'images/produits/kraken-kitty-v2/galerie-1-1199.webp', 'Razer Kraken Kitty V2, vue 2', 0, 1),
    (132, 12, NULL, 'images/produits/kraken-kitty-v2/galerie-2-767.webp', 'images/produits/kraken-kitty-v2/galerie-2-1199.webp', 'Razer Kraken Kitty V2, vue 3', 0, 2),
    (133, 12, NULL, 'images/produits/kraken-kitty-v2/galerie-3-767.webp', 'images/produits/kraken-kitty-v2/galerie-3-1199.webp', 'Razer Kraken Kitty V2, vue 4', 0, 3),
    (134, 12, NULL, 'images/produits/kraken-kitty-v2/galerie-4-767.webp', 'images/produits/kraken-kitty-v2/galerie-4-1199.webp', 'Razer Kraken Kitty V2, vue 5', 0, 4),
    (135, 12, NULL, 'images/produits/kraken-kitty-v2/galerie-5-767.webp', 'images/produits/kraken-kitty-v2/galerie-5-1199.webp', 'Razer Kraken Kitty V2, vue 6', 0, 5),
    (136, 12, NULL, 'images/produits/kraken-kitty-v2/galerie-6-767.webp', 'images/produits/kraken-kitty-v2/galerie-6-1199.webp', 'Razer Kraken Kitty V2, vue 7', 0, 6),
    (137, 12, 54, 'images/produits/kraken-kitty-v2/principale-500.webp', 'images/produits/kraken-kitty-v2/principale-500.webp', 'Razer Kraken Kitty V2 - Noir', 0, 0),
    (138, 12, 55, 'images/produits/kraken-kitty-v2/variante-rz04-04730200-r3m1-500.webp', 'images/produits/kraken-kitty-v2/variante-rz04-04730200-r3m1-500.webp', 'Razer Kraken Kitty V2 - Quartz', 0, 0),
    (139, 12, 56, 'images/produits/kraken-kitty-v2/variante-rz04-04730300-r3m1-500.webp', 'images/produits/kraken-kitty-v2/variante-rz04-04730300-r3m1-500.webp', 'Razer Kraken Kitty V2 - Gengar Edition', 0, 0),
    (140, 12, 57, 'images/produits/kraken-kitty-v2/variante-rz04-04730600-r3m1-500.webp', 'images/produits/kraken-kitty-v2/variante-rz04-04730600-r3m1-500.webp', 'Razer Kraken Kitty V2 - Blanc', 0, 0);
