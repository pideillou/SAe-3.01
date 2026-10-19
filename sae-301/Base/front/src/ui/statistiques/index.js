import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLigne from "./ligne-categorie.html?raw";

// Indicateurs de l'accueil du back-office : catalogue, stocks et commandes.
// Un template par élément répété : la ligne de catégorie a le sien, et chaque
// ligne prend place dans le <slot name="categories">.
let StatistiquesView = {
  /**
   * @param {{produits: number, variantes: number, unites: number,
   *          commandes: {total: number, enCours: number},
   *          parCategorie: Array<{categorie: string, nombre: number}>}} stats
   */
  dom: function (stats) {
    let fragment = htmlToFragment(
      genericRenderer(template, {
        produits: stats.produits,
        variantes: stats.variantes,
        unites: stats.unites,
        commandes: stats.commandes.total,
        commandesEnCours: stats.commandes.enCours,
      })
    );

    let lignes = stats.parCategorie.map((ligne) => htmlToFragment(genericRenderer(templateLigne, ligne)));
    fragment.querySelector('slot[name="categories"]').replaceWith(...lignes);

    return fragment;
  },
};

export { StatistiquesView };
