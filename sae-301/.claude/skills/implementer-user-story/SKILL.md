---
name: implementer-user-story
description: Réalise une user story de la SAé 3.01 de bout en bout (code MVC, Tailwind, validations, tests, résumé de fin d'itération). À utiliser dès que PIDEILLOU cite un code de user story (CMD-a, DEC-b, STK-c, GOF-a, OPT-c, SUI-a, PIL-b, PRO-a et autres), demande de développer une fonctionnalité du site, ou dit "on passe à la suite".
---

# Implémenter une user story

## Avant de coder
1. Identifier la user story et vérifier dans le README qu'elle est la suivante dans l'ordre retenu et que ses dépendances sont faites. Sinon, prévenir PIDEILLOU avant de continuer.
2. Relire ses critères d'acceptation et sa Definition of Done spécifique dans le cahier des charges. Les transformer en liste de points à cocher.
3. Lire le code existant concerné et la base de code fournie. S'y conformer.
4. Proposer le nom de branche (code puis sujet court).

## Où mettre quoi
- Nouvelle page : front/src/pages/nom/ (page.js et template.html), puis la route dans front/src/main.js.
- Composant : front/src/ui/nom/ (index.js et template.html).
- Appel à l'API : front/src/data/ressource.js.
- Nouvelle route d'API : back/src/routes.php, et instanciation du contrôleur dans back/index.php.
- Contrôleur : back/src/Controller/. Modèle : back/src/Model/.
- Schéma et données de départ : sql/.

## Pendant
- Respecter .claude/rules/mvc-javascript.md et .claude/rules/tailwind-css.md.
- Appliquer .claude/rules/securite.md et .claude/rules/donnees-et-stock.md quand la user story les concerne.
- Valider les formulaires côté client et côté serveur, messages d'erreur en français.
- Ne rien inventer : données, textes et visuels viennent de PIDEILLOU ou de sources réelles.
- Rester dans le périmètre de la user story. Signaler les améliorations hors périmètre sans les faire.

## Après
Lancer la skill validateur-w3c sur toutes les pages touchées, corriger les erreurs à la source et relancer jusqu'à zéro erreur HTML. Passer en revue la Definition of Done commune (.claude/rules/qualite-livrable.md), puis écrire le résumé de fin d'itération :

- User story et branche proposée
- Critères d'acceptation et DoD : faits, non faits
- Vérifications faites, avec le rapport de validation W3C (erreurs avant et après), et celles que PIDEILLOU doit faire (navigateurs, CSS compilé)
- Modifications du back ou de sql/ à déposer ou importer sur le serveur avant de tester
- Fichiers créés ou modifiés
- Messages de commit proposés
- Rappel : le push est à faire par PIDEILLOU
