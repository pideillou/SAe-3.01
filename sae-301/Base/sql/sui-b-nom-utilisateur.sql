-- SUI-b : nom du client, modifiable depuis son espace personnel. À importer
-- SANS réimporter import.sql (qui effacerait les commandes). Les comptes
-- existants gardent un nom vide (NULL). Sans danger si la colonne existe déjà
-- (MariaDB).

SET NAMES utf8mb4;

ALTER TABLE utilisateur
    ADD COLUMN IF NOT EXISTS nom VARCHAR(80) NULL AFTER mot_de_passe;
