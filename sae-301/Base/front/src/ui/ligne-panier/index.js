import { formaterPrix } from "../../lib/format.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import template from "./template.html?raw";

// Une ligne du panier : image, nom, options choisies, prix, quantité modifiable,
// total de la ligne, modification des options et suppression. Le composant ne
// modifie rien : il signale les actions de l'utilisateur, et la page met le
// panier à jour puis se reconstruit.
let LignePanierView = {
  /**
   * @param {object} ligne  une ligne de PanierData.lignes()
   * @param {number} totalLigne  prix de la ligne (prix unitaire x quantité)
   * @param {{surQuantite: (varianteId: number, quantite: number) => void,
   *          surModification: (varianteId: number) => void,
   *          surSuppression: (varianteId: number) => void}} actions
   * @param {Node|null} edition  le panneau de modification des options, s'il
   *          est ouvert sur cette ligne
   */
  dom: function (ligne, totalLigne, actions, edition = null) {
    let options = ligne.options ?? "";

    let fragment = htmlToFragment(
      genericRenderer(template, {
        varianteId: ligne.varianteId,
        chemin: urlPublique(`produit/${ligne.produitSlug}`),
        image: ligne.image === null ? "" : urlPublique(ligne.image.moyen),
        // Avec les options à part, le titre est le produit ; sans elles (ligne
        // ajoutée avant OPT-a), le nom de la variante les contient.
        titre: options === "" ? ligne.nom : ligne.produitNom,
        nom: ligne.nom,
        options,
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

    if (options === "") {
      fragment.querySelector("[data-options]").remove();
    }

    let modifier = fragment.querySelector('[data-action="modifier"]');
    modifier.setAttribute("aria-expanded", String(edition !== null));
    modifier.addEventListener("click", () => actions.surModification(ligne.varianteId));

    let slotEdition = fragment.querySelector('slot[name="edition"]');
    if (edition === null) {
      slotEdition.remove();
    } else {
      slotEdition.replaceWith(edition);
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
