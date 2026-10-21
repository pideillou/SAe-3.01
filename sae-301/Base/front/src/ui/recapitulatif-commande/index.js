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
   * @param {number|string} total  le total à payer (réduction déduite)
   * @param {{code: string, pourcentage: number, montant: number|string,
   *          sousTotal: number|string}|null} reduction  le code promotionnel
   *        appliqué, ou null
   */
  dom: function (lignes, total, reduction = null) {
    let fragment = htmlToFragment(
      genericRenderer(template, {
        total: formaterPrix(total),
        sousTotal: reduction === null ? "" : formaterPrix(reduction.sousTotal),
        code: reduction === null ? "" : reduction.code,
        pourcentage: reduction === null ? "" : reduction.pourcentage,
        montant: reduction === null ? "" : formaterPrix(reduction.montant),
      })
    );

    // Sans code promotionnel, le total est la seule ligne de montant.
    if (reduction === null) {
      fragment.querySelector("[data-sous-total]").remove();
      fragment.querySelector("[data-reduction]").remove();
    }

    fragment
      .querySelector('slot[name="lignes"]')
      .replaceWith(...lignes.map((ligne) => LigneCommandeView.dom(ligne)));

    return fragment;
  },
};

export { RecapitulatifCommandeView };
