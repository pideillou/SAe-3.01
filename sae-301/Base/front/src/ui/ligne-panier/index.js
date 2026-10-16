import { formaterPrix } from "../../lib/format.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import template from "./template.html?raw";

// Une ligne du panier : image, nom, prix, quantité modifiable, total de la
// ligne et suppression. Le composant ne modifie rien : il signale les actions
// de l'utilisateur, et la page met le panier à jour puis se reconstruit.
let LignePanierView = {
  /**
   * @param {object} ligne  une ligne de PanierData.lignes()
   * @param {number} totalLigne  prix de la ligne (prix unitaire x quantité)
   * @param {{surQuantite: (varianteId: number, quantite: number) => void,
   *          surSuppression: (varianteId: number) => void}} actions
   */
  dom: function (ligne, totalLigne, actions) {
    let fragment = htmlToFragment(
      genericRenderer(template, {
        varianteId: ligne.varianteId,
        chemin: urlPublique(`produit/${ligne.produitSlug}`),
        image: ligne.image === null ? "" : urlPublique(ligne.image.moyen),
        nom: ligne.nom,
        prixUnitaire: formaterPrix(ligne.prix),
        mentionStock:
          ligne.quantite === ligne.stock
            ? "Quantité maximale atteinte"
            : `${ligne.stock} disponible(s) à la dernière vérification`,
        stock: ligne.stock,
        quantite: ligne.quantite,
        totalLigne: formaterPrix(totalLigne),
      })
    );

    // Un template n'a pas de condition : l'image absente et les boutons
    // inutilisables se règlent ici.
    if (ligne.image === null) {
      fragment.querySelector("[data-image]").remove();
    }

    let moins = fragment.querySelector('[data-action="moins"]');
    let plus = fragment.querySelector('[data-action="plus"]');
    let saisie = fragment.querySelector("[data-quantite]");

    moins.disabled = ligne.quantite <= 1;
    plus.disabled = ligne.quantite >= ligne.stock;

    moins.addEventListener("click", () => actions.surQuantite(ligne.varianteId, ligne.quantite - 1));
    plus.addEventListener("click", () => actions.surQuantite(ligne.varianteId, ligne.quantite + 1));
    saisie.addEventListener("change", () => actions.surQuantite(ligne.varianteId, Number(saisie.value)));

    fragment
      .querySelector('[data-action="supprimer"]')
      .addEventListener("click", () => actions.surSuppression(ligne.varianteId));

    return fragment;
  },
};

export { LignePanierView };
