import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";

// Les classes sont écrites en entier : Tailwind ne génère que celles qu'il
// trouve telles quelles dans le code.
const COULEURS = {
  "en-stock": "fill-razer",
  "bientot-epuise": "fill-alerte",
  epuise: "fill-erreur",
};

// Histogramme des stocks : une barre par produit, longueur proportionnelle au
// stock du produit le mieux fourni. Les barres sont des formes SVG (largeur en
// attribut), l'effectif est écrit en toutes lettres à côté : le graphique n'est
// jamais la seule source de l'information.
let HistogrammeStocksView = {
  /**
   * @param {Array<{produit: string, unites: number, etat: string}>} stocks
   * @param {number} seuil  seuil « Bientôt épuisé »
   */
  dom: function (stocks, seuil) {
    let fragment = htmlToFragment(genericRenderer(template, { seuil }));
    let maximum = Math.max(1, ...stocks.map((ligne) => ligne.unites));

    let lignes = stocks.map((ligne) =>
      htmlToFragment(
        genericRenderer(templateLigne, {
          produit: ligne.produit,
          unites: ligne.unites,
          largeur: Math.round((ligne.unites / maximum) * 1000) / 10,
          couleur: COULEURS[ligne.etat] ?? COULEURS["en-stock"],
        })
      )
    );

    fragment.querySelector('slot[name="lignes"]').replaceWith(...lignes);
    return fragment;
  },
};

export { HistogrammeStocksView };
