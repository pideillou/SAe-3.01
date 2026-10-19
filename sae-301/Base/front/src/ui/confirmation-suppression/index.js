import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Demande de confirmation avant une suppression (toute suppression en exige
// une). Le composant ne supprime rien : il signale la réponse du visiteur.
let ConfirmationSuppressionView = {
  /**
   * @param {{titre: string, texte: string, envoiEnCours: boolean}} data
   * @param {{surConfirmation: () => void, surAnnulation: () => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(genericRenderer(template, { titre: data.titre, texte: data.texte }));

    let confirmer = fragment.querySelector('[data-action="confirmer"]');
    confirmer.disabled = data.envoiEnCours;
    confirmer.addEventListener("click", () => actions.surConfirmation());
    fragment.querySelector('[data-action="annuler"]').addEventListener("click", () => actions.surAnnulation());

    return fragment;
  },
};

export { ConfirmationSuppressionView };
