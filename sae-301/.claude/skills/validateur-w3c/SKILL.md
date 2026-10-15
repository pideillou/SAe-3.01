---
name: validateur-w3c
description: Valide le HTML et le CSS du projet avec le validateur du W3C (Nu Html Checker), corrige les erreurs à la source et rédige un rapport. À utiliser dès que PIDEILLOU parle de W3C, de validation HTML ou CSS, d'erreurs de validateur, de code valide, ou qu'une user story arrive à la vérification de sa Definition of Done commune. À utiliser aussi avant un commit important et avant le rendu, même si la validation n'est pas demandée explicitement.
---

# Validateur W3C

La Definition of Done commune exige un HTML et un CSS valides au validateur du W3C, pour chaque user story. Dans ce projet, le HTML affiché est construit par JavaScript : valider seulement le fichier source ne prouve presque rien.

## Quoi valider
- front/index.html : le document statique, à valider tel quel.
- Le DOM rendu de chaque page touchée par la user story, une fois les données chargées : catalogue, fiche produit, panier, formulaires, pages d'administration, selon le cas.
- Le CSS compilé par npm run build, dans front/dist/. Jamais front/src/global.css : les règles propres à Tailwind (@import "tailwindcss", @theme, @utility) ne sont pas du CSS standard et seraient signalées à tort.
- Ne pas valider les template.html seuls : ce sont des fragments avec des placeholders {{cle}}, pas des documents complets.

## Outil
Utiliser le Nu Html Checker (vnu), le moteur de validator.w3.org/nu. Il contrôle le HTML, le CSS et le SVG en ligne de commande et demande Java 8 ou plus.

1. Vérifier la présence de Java (java -version) et de vnu.jar ou de la commande vnu.
2. Si l'un des deux manque, ne rien installer sans l'accord de PIDEILLOU (règle d'AGENTS.md). Lui proposer d'installer vnu, par exemple avec le paquet npm vnu-jar, ou de passer par les validateurs en ligne : validator.w3.org/nu en collant le code, et jigsaw.w3.org/css-validator pour le CSS.
3. Lire java -jar vnu.jar --help pour confirmer les options de la version installée.

Exemples :
- Un fichier : java -jar vnu.jar --format text front/index.html
- Depuis l'entrée standard : cat page.html | java -jar vnu.jar -
- Un fichier CSS compilé : le passer en argument à vnu et vérifier dans la sortie qu'il a bien été traité comme du CSS.

## Valider le DOM rendu
1. Lancer le front (npm run dev). Rappel : il relaie les appels à l'API déployée, donc une page qui dépend d'une modification du back non déposée sur le serveur ne s'affichera pas correctement.
2. Si un outil de navigation est disponible (Claude in Chrome ou navigateur intégré), ouvrir chaque route, attendre la fin du chargement et récupérer document.documentElement.outerHTML.
3. Écrire le résultat, précédé de <!doctype html>, dans un fichier temporaire hors du dépôt, puis le valider avec vnu.
4. Sans outil de navigation, demander à PIDEILLOU de copier le HTML rendu (outils de développement, onglet Éléments, clic droit sur la balise html, copier l'outerHTML) et de le coller dans validator.w3.org/nu. Le code source affiché par « afficher le code source » n'est pas le bon : il ne contient que la coquille de index.html.
5. Valider l'état avec données chargées. Si la user story gère des états particuliers (panier vide, erreur, produit épuisé), valider aussi ceux-là.

## Traiter les résultats
- Corriger chaque erreur à la source (index.html, template.html, page.js, composants), jamais dans le fichier de sortie, puis relancer la validation.
- Corriger aussi les avertissements quand c'est simple. Sinon, les lister avec leur cause.
- Erreurs fréquentes dans cette architecture : identifiants (id) en double quand un composant est répété dans une liste, placeholder {{cle}} resté dans le DOM, élément img sans alt, liens ou boutons imbriqués, li hors d'une liste, attribut for d'un label qui ne pointe vers aucun champ.
- Ne jamais masquer une erreur avec les options de filtrage de vnu.
- Ne jamais écrire « valide » sans avoir lancé l'outil et lu zéro erreur dans la sortie.

## Cas particulier du CSS de Tailwind
Le CSS compilé par Tailwind v4 contient du CSS moderne que le validateur CSS du W3C peut ne pas reconnaître. Si les erreurs portent sur des règles générées par Tailwind et non sur du CSS écrit dans global.css :
- ne pas modifier le fichier compilé ;
- relever le message exact, la règle concernée et la propriété en cause ;
- dire à PIDEILLOU qu'il s'agit probablement d'une limite du validateur, à documenter dans son README, et demander son accord avant tout contournement (par exemple changer la configuration de Tailwind).
Corriger en revanche toute erreur dans le CSS écrit à la main.

## Rapport
Terminer par un court rapport :
- pages et fichiers validés (routes, états, CSS compilé) ;
- nombre d'erreurs et d'avertissements avant et après corrections ;
- corrections faites ;
- ce qui reste, avec la cause ;
- ce que PIDEILLOU doit repasser lui-même dans les validateurs en ligne du W3C avant de déclarer la user story terminée.
