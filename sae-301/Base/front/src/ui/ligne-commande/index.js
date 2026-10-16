import { formaterPrix } from "../../lib/format.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import template from "./template.html?raw";

// Une ligne de commande en lecture seule : image, nom, quantité x prix et total
// de la ligne. Aucune action : on ne modifie plus une commande validée.
let LigneCommandeView = {
  /**
   * @param {{nom: string, image: string|null, prixUnitaire: string, quantite: number}} ligne
   */
  dom: function (ligne) {
    let totalLigne = (Math.round(Number(ligne.prixUnitaire) * 100) * ligne.quantite) / 100;

    let fragment = htmlToFragment(
      genericRenderer(template, {
        nom: ligne.nom,
        image: ligne.image === null ? "" : urlPublique(ligne.image),
        quantite: ligne.quantite,
        prixUnitaire: formaterPrix(ligne.prixUnitaire),
        totalLigne: formaterPrix(totalLigne),
      })
    );

    // Un template n'a pas de condition : l'image absente se retire ici.
    if (ligne.image === null) {
      fragment.querySelector("[data-image]").remove();
    }

    return fragment;
  },
};

export { LigneCommandeView };
