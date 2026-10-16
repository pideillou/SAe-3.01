import { formaterPrix, pluriel } from "../../lib/format.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import template from "./template.html?raw";

// Récapitulatif du panier : nombre d'articles et total.
let ResumePanierView = {
  /**
   * @param {{articles: number, total: number}} data
   */
  dom: function (data) {
    return htmlToFragment(
      genericRenderer(template, {
        articles: pluriel(data.articles, "article"),
        total: formaterPrix(data.total),
        cheminCatalogue: urlPublique(""),
        cheminCommande: urlPublique("commande"),
      })
    );
  },
};

export { ResumePanierView };
