---
name: integrer-maquette-tailwind
description: Transforme les prototypes Figma de PIDEILLOU en HTML et Tailwind CSS réutilisables (variables, composants, variants, responsive). À utiliser dès qu'il est question de maquette, Figma, intégration, composant d'interface, charte graphique Razer, design tokens, responsive ou mise en page, même si Tailwind n'est pas mentionné.
---

# Du Figma au HTML et Tailwind

La première semaine de la SAé vise des prototypes Figma aboutis (variables, composants, variants), puis le HTML et le CSS des composants pour les intégrer vite pendant le développement.

## Méthode
1. Récupérer les valeurs réelles du Figma : couleurs, typographies, espacements, rayons, ombres. Si elles ne sont pas accessibles, demander un export ou les valeurs à PIDEILLOU. Ne jamais deviner.
2. Déclarer ces variables dans @theme, dans front/src/global.css (Tailwind v4, pas de tailwind.config). Ensuite, utiliser uniquement les classes issues du thème.
3. Un composant Figma devient un dossier front/src/ui/nom/ avec template.html et index.js. Les données passent par des placeholders {{cle}}, sans boucle ni condition dans le template. Un variant devient un paramètre de index.js qui choisit les classes, pas un composant dupliqué. Les classes sont écrites en entier.
4. Construire mobile first, puis les breakpoints tablette et desktop. Vérifier les trois formats.
5. Couvrir les états : survol, focus, désactivé, erreur, et les trois états de stock (En stock, Bientôt épuisé, Épuisé).
6. HTML sémantique et valide au W3C, texte alternatif sur les images.
7. Séparer clairement l'apparence du back-office de celle du front-office, tout en gardant la cohérence.

## Précautions
- Le site doit respecter la charte de Razer mais proposer une expérience différente de sa boutique existante. Ne pas copier l'interface actuelle.
- Les composants ne contiennent pas de logique métier : elle appartient aux modèles et contrôleurs (voir mvc-javascript.md).
