-- GOF-a : ajoute le motif « ajustement » au journal des mouvements de stock
-- (modification du stock par l'administrateur). À importer SANS réimporter
-- import.sql. Rejouable : MODIFY remet simplement la même définition.

ALTER TABLE mouvement_stock
    MODIFY motif ENUM('commande', 'annulation', 'ajustement') NOT NULL;
