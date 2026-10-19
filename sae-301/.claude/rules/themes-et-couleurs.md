# Thèmes et couleurs

Les couleurs de la charte sont déclarées en deux étages dans front/src/global.css, pour qu'un thème s'ajoute sans toucher aux templates.

1. La palette : les valeurs, dans un bloc par thème (dans @layer base). Le thème par défaut est « sombre », le seul que prévoit le Figma : il s'applique à :root, sans attribut. Variables nommées --couleur-nom.
2. @theme inline : relie chaque nom de classe Tailwind à sa variable de palette (--color-nom: var(--couleur-nom)). Grâce à « inline », bg-nom devient background-color: var(--couleur-nom) et suit le thème actif. Ne pas retirer « inline » : sans lui, la couleur serait figée au niveau de :root.

## Règles
- Aucune couleur écrite en dur ailleurs que dans les blocs de thème de global.css : ni #hex, rgb() ou hsl() dans un template, un composant ou le JavaScript, ni valeur arbitraire du type bg-[#...], ni couleur par défaut de Tailwind (bg-white, text-gray-500…). Une couleur du CSS se lit avec var(--couleur-nom).
- Les classes portent un nom de rôle (fond, surface, texte, texte-secondaire, bordure, razer, sur-razer, alerte, erreur), jamais une teinte (vert, gris). Un thème peut changer la teinte, pas le rôle.
- Nouvelle couleur de la charte : l'ajouter aux deux endroits, --couleur-nom dans CHAQUE bloc de thème, et --color-nom: var(--couleur-nom) dans @theme inline. Valeur et nom viennent des variables du Figma. Ne jamais ajouter une couleur dans un seul thème.
- Les polices, tailles et proportions restent dans le @theme normal : elles ne dépendent pas du thème.

## Ajouter un thème
Seulement avec l'accord de PIDEILLOU et si le Figma le prévoit (voir tailwind-css.md).

1. Un bloc [data-theme="nom"] dans @layer base de global.css, qui définit color-scheme (dark ou light) et TOUTES les variables --couleur-* du thème sombre, avec les valeurs du Figma.
2. Activer le thème avec <html data-theme="nom">. S'il doit être choisi par le visiteur : un petit module dans lib/ qui pose l'attribut et mémorise le choix dans localStorage. Lectures et écritures protégées par try/catch (le stockage peut être bloqué), et le site doit s'afficher correctement sans.
3. Vérifier : le contraste du texte (texte et texte-secondaire sur fond, surface et surface-haute, sur-razer sur razer, erreur et alerte sur surface) et chaque état de stock ; parcourir le front-office et le back-office dans le nouveau thème ; valider le CSS compilé (skill validateur-w3c).

## Limites connues
- <meta name="theme-color"> de front/index.html est fixe (couleur du thème sombre) : il ne suit pas un changement de thème. À mettre à jour en JavaScript si un second thème est livré.
- Une image qui contient une couleur de fond propre (logo, photos) ne change pas avec le thème.
