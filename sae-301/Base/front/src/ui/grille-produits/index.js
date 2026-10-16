import { htmlToFragment } from "../../lib/utils.js";
import { CarteProduitView } from "../carte-produit/index.js";
import template from "./template.html?raw";
import templateVide from "./vide.html?raw";

// Grille de cartes. Elle compose un autre composant, CarteProduitView : les
// cartes prennent la place du <slot name="cartes">.
let GrilleProduitsView = {
  /**
   * @param {Array}  produits
   * @param {number} prioritaires  nombre de cartes dont l'image est chargée
   *                               tout de suite (celles du haut de la page)
   * @param {object} actions  transmises à chaque carte (voir CarteProduitView)
   */
  dom: function (produits, prioritaires = 0, actions = {}) {
    if (produits.length === 0) {
      return htmlToFragment(templateVide);
    }

    let fragment = htmlToFragment(template);
    let cartes = produits.map((produit, i) => CarteProduitView.dom(produit, i < prioritaires, actions));
    fragment.querySelector('slot[name="cartes"]').replaceWith(...cartes);
    return fragment;
  },
};

export { GrilleProduitsView };
