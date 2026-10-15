---
name: analyser-user-stories
description: Analyse les user stories de la SAé 3.01, dessine le graphe de dépendances et fixe un ordre de réalisation justifié. À utiliser dès que PIDEILLOU parle d'ordre de réalisation, de dépendances entre user stories, de priorisation, de planning, de graphe ou de README d'analyse, même s'il ne demande pas explicitement une "analyse".
---

# Analyser les user stories

Le cahier des charges demande un graphe de dépendances et un ordre de réalisation justifié, présentés aux enseignants puis placés dans le README du dépôt. Il n'existe pas un ordre unique : c'est la qualité de la justification qui est évaluée.

## Méthode
1. Lire la section 3 du cahier des charges et lister toutes les user stories par code (CMD, DEC, STK, GOF, OPT, SUI, PIL, PRO). L'epic Promotions est un bonus.
2. Pour chaque user story, noter de quelles autres elle dépend, dans le même epic et d'un epic à l'autre.
3. Représenter ces dépendances dans un graphe Mermaid, qui s'affiche directement dans le README sur GitHub.
4. Estimer la complexité de chaque user story. Les poids de notation ne sont pas communiqués : cette estimation fait partie du travail attendu.
5. Déduire l'ordre en s'appuyant sur les quatre critères du cahier des charges : dépendances techniques, valeur pour l'utilisateur, complexité, risque de devoir reprendre du code déjà écrit.
6. Justifier chaque choix en une ou deux phrases, en vocabulaire d'étudiant.

## Sortie
Une section ajoutée au README, sans supprimer la documentation du starter, avec : le graphe Mermaid, un tableau ordre / user story / dépendances / complexité estimée, et la justification de l'ordre.

## Précautions
- Si le README contient déjà un ordre présenté aux enseignants, ne pas le réécrire. Proposer les modifications à PIDEILLOU et expliquer pourquoi.
- Dire clairement quand une estimation de complexité est un jugement et non un fait.
