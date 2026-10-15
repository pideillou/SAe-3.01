---
name: verifier-livraison
description: Contrôle final avant le rendu de la SAé 3.01 (vendredi 23 octobre 2026) : livrables, validation W3C, Lighthouse, navigateurs, comptes de test, README, accès des enseignants. À utiliser dès que PIDEILLOU parle de rendu, de livraison, de checklist finale, de dernière ligne droite, d'audit Lighthouse ou demande si tout est prêt.
---

# Vérifier la livraison

Produire une checklist où chaque ligne est marquée fait, à faire ou non vérifiable par l'agent. Ne jamais marquer fait ce qui n'a pas été contrôlé.

## Livrables
- Lien Figma vers les prototypes
- Application hébergée sur mmi.unilim.fr, correspondant à la branche principale du dépôt GitHub
- Lien du dépôt GitHub (si privé, enseignants ajoutés en collaborateurs)
- Rapport d'audit Lighthouse
- README avec le graphe de dépendances et l'ordre de réalisation justifié
- Accès pour un compte visiteur et, le cas échéant, un compte administrateur

## Qualité, par user story réalisée
- Critères d'acceptation et Definition of Done spécifique remplis
- Definition of Done commune : W3C, charte Razer, responsive, 3 navigateurs, formulaires validés des deux côtés, pages réservées protégées
- Aucune page /admin accessible sans authentification administrateur

## Déploiement
- npm run build passe sans erreur.
- « chemin » de back/config/config.php et BASE de front/vite.config.js sont identiques.
- .htaccess, back/ et front/dist/ sont déposés sur le serveur.
- « debug » vaut false dans config.php en production.
- Les comptes en dur du starter (alice, admin) ont disparu.
- Aucun identifiant de base de données dans le dépôt.

## Contrôles globaux
- Parcours complet : catalogue, fiche produit, panier, connexion, commande, confirmation.
- Parcours administrateur : gestion des produits et des commandes.
- Aucune donnée fictive ni texte provisoire visible.
- Aucun secret dans le dépôt.
- Le catalogue se charge en moins de 3 secondes.

## À rappeler à PIDEILLOU
Les pushs, la validation W3C, les tests sur trois navigateurs, le rapport Lighthouse et le formulaire de rendu des enseignants sont à faire par lui.
