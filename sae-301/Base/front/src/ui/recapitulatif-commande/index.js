import { formaterPrix } from "../../lib/format.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { LigneCommandeView } from "../ligne-commande/index.js";
import template from "./template.html?raw";

// Liste des articles d'une commande et son total, en lecture seule. Sert à la
// fois avant la validation (d'après le panier) et sur la page de confirmation
// (d'après la commande enregistrée).
let RecapitulatifCommandeView = {
  /**
   * @param {Array<{nom, image, prixUnitaire, quantite}>} lignes
   * @param {number|string} total
   */
  dom: function (lignes, total) {
    let fragment = htmlToFragment(genericRenderer(template, { total: formaterPrix(total) }));

    fragment
      .querySelector('slot[name="lignes"]')
      .replaceWith(...lignes.map((ligne) => LigneCommandeView.dom(ligne)));

    return fragment;
  },
};

export { RecapitulatifCommandeView };
