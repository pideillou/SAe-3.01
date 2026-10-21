-- OPT-a : options choisies conservées sur chaque ligne de commande, au moment
-- de la commande (par exemple « Switch : Vert, Disposition : FR »). À importer
-- SANS réimporter import.sql (qui effacerait les commandes). Les lignes déjà
-- enregistrées gardent une valeur NULL : leur nom de variante contient déjà
-- les options, et l'affichage s'en sert dans ce cas.
-- Sans danger si la colonne existe déjà (MariaDB).

SET NAMES utf8mb4;

ALTER TABLE ligne_commande
    ADD COLUMN IF NOT EXISTS options VARCHAR(500) NULL AFTER variante_nom;
