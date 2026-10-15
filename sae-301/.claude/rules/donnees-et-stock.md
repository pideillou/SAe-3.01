# Données, commandes et stock

## Schéma
- La base est MySQL, tables en InnoDB, ce qui permet les transactions.
- Le schéma et les données de départ vivent dans sql/. Tout changement de schéma y est reporté, pour que la base soit reconstructible.
- Le import.sql du starter supprime les tables avant de les recréer. Prévenir PIDEILLOU avant tout import qui effacerait des commandes existantes.

## Commandes
- Une commande a un numéro unique et le statut « en cours » à sa création. Statuts possibles : en cours, disponible, retirée, annulée.
- Les lignes de commande conservent le prix de chaque produit et les options choisies au moment de la commande.
- Une commande passée reste lisible même si le produit a été modifié ou supprimé depuis.
- Le panier est vidé après validation.

## Stock
- Décrémenté à la validation d'une commande. Recrédité uniquement quand la commande passe à « annulée ». Aucun autre changement de statut ne modifie le stock.
- Mises à jour atomiques dans une transaction PDO (beginTransaction, commit, rollBack en cas d'erreur).
- Le stock ne devient jamais négatif.
- Journal des mouvements de stock tenu à jour.
- Si les produits ont des variantes, tout se fait par variante : affichage, contraintes, mise à jour.
- Le seuil « Bientôt épuisé » est une valeur de configuration (fichier ou table de paramètres), modifiable depuis le back-office.

## Modélisation
- Avant de modéliser produits et stock, regarder dans le README si OPT-b (variantes) est prévue. Si oui, modéliser les variantes dès le départ pour éviter la migration de données et de code que cette user story exige.
- Catégorie supprimée : appliquer une règle explicite pour ses produits (réaffectation ou blocage de la suppression). Demander à PIDEILLOU laquelle choisir.
- Toute suppression demande une confirmation.
- Les modifications faites par les administrateurs sur les commandes sont journalisées (PIL-b).
