import { formaterPrix, pluriel } from "../../lib/format.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { BadgeStockView } from "../badge-stock/index.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";

// Tableau des produits du back-office. Il ne modifie rien : il signale le clic
// sur « Supprimer », et la page demande la confirmation.
let TableauProduitsView = {
  /**
   * @param {Array<{id, nom, categorie, variantes, stockTotal, etat, prixMin, prixMax}>} produits
   * @param {{surSuppression: (produit: object) => void}} actions
   */
  dom: function (produits, actions) {
    let fragment = htmlToFragment(template);

    let lignes = produits.map((produit) => {
      let prix =
        produit.prixMin === produit.prixMax
          ? formaterPrix(produit.prixMin)
          : `${formaterPrix(produit.prixMin)} à ${formaterPrix(produit.prixMax)}`;

      let ligne = htmlToFragment(
        genericRenderer(templateLigne, {
          nom: produit.nom,
          categorie: produit.categorie,
          variantes: produit.variantes,
          prix,
          stock: pluriel(produit.stockTotal, "unité"),
          chemin: urlPublique(`admin/produits/${produit.id}`),
        })
      );

      ligne.querySelector("[data-etat]").replaceWith(BadgeStockView.dom(produit.etat));
      ligne.querySelector('[data-action="supprimer"]').addEventListener("click", () => actions.surSuppression(produit));

      return ligne;
    });

    fragment.querySelector("[data-lignes]").replaceChildren(...lignes);
    return fragment;
  },
};

export { TableauProduitsView };
