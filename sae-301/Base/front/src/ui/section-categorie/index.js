import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { pluriel } from "../../lib/format.js";
import { GrilleProduitsView } from "../grille-produits/index.js";
import template from "./template.html?raw";

// Une catégorie du catalogue : son titre, son nombre de produits, sa grille.
let SectionCategorieView = {
  /**
   * @param {{nom: string, slug: string, produits: Array}} categorie
   * @param {number} prioritaires  voir GrilleProduitsView
   */
  dom: function (categorie, prioritaires = 0) {
    let fragment = htmlToFragment(
      genericRenderer(template, {
        nom: categorie.nom,
        slug: categorie.slug,
        nombre: pluriel(categorie.produits.length, "produit"),
      })
    );

    fragment
      .querySelector('slot[name="grille"]')
      .replaceWith(GrilleProduitsView.dom(categorie.produits, prioritaires));

    return fragment;
  },
};

export { SectionCategorieView };
