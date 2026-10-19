import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Demande de confirmation avant une action irréversible : une suppression, une
// annulation de commande. Le composant ne fait rien lui-même : il signale la
// réponse de l'administrateur.
let ConfirmationSuppressionView = {
  /**
   * @param {{titre: string, texte: string, envoiEnCours: boolean,
   *          libelleConfirmation?: string, libelleAnnulation?: string}} data   libellés des boutons (« Oui, supprimer » et « Non, conserver » par défaut)
   * @param {{surConfirmation: () => void, surAnnulation: () => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(genericRenderer(template, {
        titre: data.titre,
        texte: data.texte,
        libelleConfirmation: data.libelleConfirmation ?? "Oui, supprimer",
        libelleAnnulation: data.libelleAnnulation ?? "Non, conserver",
      }));

    let confirmer = fragment.querySelector('[data-action="confirmer"]');
    confirmer.disabled = data.envoiEnCours;
    confirmer.addEventListener("click", () => actions.surConfirmation());
    fragment.querySelector('[data-action="annuler"]').addEventListener("click", () => actions.surAnnulation());

    return fragment;
  },
};

export { ConfirmationSuppressionView };
