import { htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../message/index.js";
import template from "./template.html?raw";

// Le formulaire de changement de mot de passe : mot de passe actuel, nouveau
// mot de passe et confirmation. Comme les autres formulaires, il ne valide rien.
let FormulaireMotDePasseView = {
  /**
   * @param {{erreurs: Object<string, string>,
   *          message: {type, texte}|null,
   *          envoiEnCours: boolean}} data
   * @param {{surEnvoi: (valeurs: {actuel, nouveau, confirmation}) => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(template);

    fragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(data.message));

    for (let [champ, message] of Object.entries(data.erreurs)) {
      let zone = fragment.querySelector(`[data-erreur="${champ}"]`);
      let saisie = fragment.querySelector(`[name="${champ}"]`);

      if (zone !== null && saisie !== null) {
        zone.textContent = message;
        saisie.setAttribute("aria-invalid", "true");
      }
    }

    let formulaire = fragment.querySelector("form");
    formulaire.querySelector('button[type="submit"]').disabled = data.envoiEnCours;

    formulaire.addEventListener("submit", (ev) => {
      ev.preventDefault();
      actions.surEnvoi({
        actuel: formulaire.elements.actuel.value,
        nouveau: formulaire.elements.nouveau.value,
        confirmation: formulaire.elements.confirmation.value,
      });
    });

    return fragment;
  },
};

export { FormulaireMotDePasseView };
