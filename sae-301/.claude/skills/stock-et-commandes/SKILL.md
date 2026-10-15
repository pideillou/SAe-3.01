---
name: stock-et-commandes
description: Implémente la validation de commande, les stocks, les variantes et les annulations de la SAé 3.01 avec transactions, journal de mouvements et test de concurrence. À utiliser pour CMD-a, STK-a, STK-b, STK-c, OPT-a, OPT-b, PIL-b ou dès qu'il est question de stock, de quantité maximale, de dernière unité, de transaction, d'annulation de commande ou de rollback.
---

# Stock et commandes

C'est la partie la plus risquée du projet : une erreur ici donne des stocks faux ou des commandes impossibles. Lire d'abord .claude/rules/donnees-et-stock.md.

## Validation d'une commande
1. Vérifier le stock côté serveur, par variante si le produit en a. Ne pas se fier au panier du navigateur.
2. Dans une seule transaction PDO (beginTransaction, commit, rollBack dans le catch), exécutée par une méthode de modèle : créer la commande avec son numéro unique et le statut « en cours », créer les lignes avec prix et options du moment, décrémenter le stock, écrire le journal.
3. Décrémenter par une mise à jour conditionnelle (seulement si le stock est suffisant) et contrôler le nombre de lignes modifiées. Si une ligne échoue, annuler toute la transaction (rollback) et renvoyer un message clair en français.
4. Vider le panier seulement après la réussite de la transaction.

## Annulation
- Le passage à « annulée » recrédite le stock dans une transaction et écrit le journal.
- Les autres changements de statut (en cours, disponible, retirée) ne touchent pas au stock.
- Une commande retirée ne peut plus être annulée.

## Journal des mouvements
Au minimum : produit ou variante concernés, quantité (positive ou négative), motif (commande ou annulation), commande liée, date.

## Test de concurrence obligatoire
Lancer deux commandes simultanées portant sur la dernière unité d'un produit (par exemple deux requêtes lancées en parallèle contre l'API déployée). Résultat attendu : une seule réussit, l'autre échoue proprement, le stock vaut 0 et jamais moins, le journal ne contient qu'un mouvement de sortie. Documenter le scénario et le résultat pour PIDEILLOU.

## Cas limites à tester
Stock modifié pendant la session, quantité du panier supérieure au stock, produit épuisé, produit supprimé depuis l'ajout au panier.
