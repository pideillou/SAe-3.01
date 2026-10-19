# Tailwind CSS

Tailwind CSS v4 est déjà installé (plugin Vite). La feuille d'entrée est front/src/global.css. Il n'y a pas de fichier tailwind.config : les personnalisations se déclarent dans global.css (@theme pour les variables, @utility pour une classe maison).

- Tout le style passe par des classes Tailwind, écrites dans les template.html. CSS personnalisé uniquement pour ce que Tailwind ne couvre pas, dans global.css.
- Tailwind ne génère que les classes écrites en entier : "text-red-700", jamais "text-" + couleur.
- La charte graphique de Razer vient des variables du prototype Figma de PIDEILLOU. Les couleurs se déclarent dans la palette d'un thème et dans @theme inline (voir themes-et-couleurs.md), les polices et tailles dans @theme. Aucune couleur, police ou espacement écrit en dur (pas de valeur arbitraire du type bg-[#...]).
- Le Figma ne prévoit qu'un thème sombre, livré par défaut. Un autre thème ne s'ajoute qu'avec l'accord de PIDEILLOU, selon la procédure de themes-et-couleurs.md.
- Mobile first : les classes sans préfixe visent le mobile, puis les préfixes de breakpoint pour tablette et desktop. Vérifier les trois formats.
- Reproduire les composants et variants du Figma dans ui/. Un composant par dossier, pas de longues chaînes de classes dupliquées.
- Le back-office (/admin) est cohérent avec le front-office mais visuellement distinct.
- États visuels à prévoir : survol, focus visible, désactivé, erreur de formulaire, et les trois états de stock (En stock, Bientôt épuisé, Épuisé).
- HTML sémantique et valide W3C, texte alternatif sur les images, contraste suffisant.
