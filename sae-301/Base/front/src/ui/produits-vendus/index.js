import { formaterPrix } from "../../lib/format.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";

// Le classement des produits les plus vendus.
let ProduitsVendusView = {
  /**
   * @param {Array<{produit: string, unites: number, chiffreAffaires: string}>} produits
   */
  dom: function (produits) {
    let fragment = htmlToFragment(template);

    if (produits.length === 0) {
      fragment.querySelector("[data-liste]").remove();
      return fragment;
    }

    fragment.querySelector("[data-vide]").remove();

    let lignes = produits.map((ligne, i) =>
      htmlToFragment(
        genericRenderer(templateLigne, {
          rang: i + 1,
          produit: ligne.produit,
          unites: ligne.unites,
          chiffreAffaires: formaterPrix(ligne.chiffreAffaires),
        })
      )
    );

    fragment.querySelector('slot[name="produits"]').replaceWith(...lignes);
    return fragment;
  },
};

export { ProduitsVendusView };
