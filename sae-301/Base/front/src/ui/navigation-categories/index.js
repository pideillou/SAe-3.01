import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLien from "./lien.html?raw";

// Les deux présentations du Figma. Les classes sont écrites en entier, et non
// assemblées : Tailwind ne génère que les classes qu'il trouve telles quelles.
//   bandeau  : desktop, ligne de liens sous l'en-tête, le lien actif est vert
//              et souligné.
//   pastilles : mobile, boutons dans le contenu, la pastille active est verte.
// La page affichée reçoit aria-current="page" du routeur (lib/router.js) : les
// variantes de style s'y accrochent.
const VARIANTES = {
  bandeau: {
    // -mt-px : le bandeau recouvre le trait sous l'en-tête, comme dans le
    // Figma où les deux lignes de navigation ne forment qu'un seul bloc.
    classesNav: "relative -mt-px border-b border-bordure bg-fond",
    classesListe: "mx-auto flex h-14 max-w-300 gap-10 px-8",
    classesItem: "flex",
    classesLien:
      "flex items-center border-b-2 border-transparent text-sm text-texte-secondaire transition-colors hover:text-texte aria-[current=page]:border-razer aria-[current=page]:font-semibold aria-[current=page]:text-razer",
    libelleTous: "Tous les produits",
  },
  pastilles: {
    classesNav: "",
    classesListe: "flex flex-wrap gap-2",
    classesItem: "flex",
    classesLien:
      "border border-bordure bg-surface px-3 py-2.5 text-xs text-texte-secondaire transition-colors hover:border-texte-secondaire aria-[current=page]:border-razer aria-[current=page]:bg-razer aria-[current=page]:text-sur-razer",
    libelleTous: "Tous",
  },
};

// Menu des catégories : « Tous » puis une entrée par catégorie, avec son nombre
// de produits. Le composant ne décide de rien : il affiche ce qu'il reçoit, et
// les liens sont des liens internes (data-link) gérés par le routeur.
let NavigationCategoriesView = {
  /**
   * @param {{categories: Array<{nom: string, slug: string, nombre: number}>,
   *          total: number}} data
   * @param {"bandeau"|"pastilles"} variante
   */
  dom: function (data, variante) {
    let style = VARIANTES[variante];

    let fragment = htmlToFragment(genericRenderer(template, style));

    let entrees = [
      { chemin: "/", libelle: `${style.libelleTous} (${data.total})` },
      ...data.categories.map((categorie) => ({
        chemin: `/categorie/${categorie.slug}`,
        libelle: `${categorie.nom} (${categorie.nombre})`,
      })),
    ];

    // Le bandeau du Figma écrit « Tous les produits » sans nombre : le nombre
    // total figure déjà dans le résumé de la page.
    if (variante === "bandeau") {
      entrees[0].libelle = style.libelleTous;
    }

    let liens = entrees.map((entree) =>
      htmlToFragment(genericRenderer(templateLien, { ...style, ...entree }))
    );

    fragment.querySelector('slot[name="liens"]').replaceWith(...liens);
    return fragment;
  },
};

export { NavigationCategoriesView };
