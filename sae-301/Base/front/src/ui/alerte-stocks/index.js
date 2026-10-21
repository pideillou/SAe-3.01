import { pluriel } from "../../lib/format.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";

// L'alerte de stocks faibles : les variantes épuisées ou à la limite du seuil
// « Bientôt épuisé ». Le cadre passe à la couleur d'alerte dès qu'il y en a.
let AlerteStocksView = {
  /**
   * @param {Array<{produit: string, variante: string, stock: number,
   *                etat: "epuise"|"bientot-epuise"}>} variantes
   * @param {number} seuil
   */
  dom: function (variantes, seuil) {
    let fragment = htmlToFragment(
      genericRenderer(template, {
        etat: variantes.length === 0 ? "ok" : "alerte",
        resume:
          variantes.length === 0
            ? `Aucune variante n'est à ${pluriel(seuil, "unité")} ou moins.`
            : `${pluriel(variantes.length, "variante")} à ${pluriel(seuil, "unité")} ou moins : pensez à réapprovisionner.`,
      })
    );

    if (variantes.length === 0) {
      fragment.querySelector("[data-liste]").remove();
      return fragment;
    }

    let lignes = variantes.map((ligne) =>
      htmlToFragment(
        genericRenderer(templateLigne, {
          variante: ligne.variante,
          libelle: ligne.etat === "epuise" ? "Épuisé" : `Plus que ${pluriel(ligne.stock, "unité")}`,
          classes: ligne.etat === "epuise" ? "text-erreur" : "text-alerte",
        })
      )
    );

    fragment.querySelector('slot[name="variantes"]').replaceWith(...lignes);
    return fragment;
  },
};

export { AlerteStocksView };
