import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../message/index.js";
import template from "./template.html?raw";

// Le formulaire « Mes informations » (nom, e-mail). Il ne valide rien : il
// transmet les valeurs saisies par actions.surEnvoi et affiche les erreurs et le
// message qu'on lui donne.
let FormulaireProfilView = {
  /**
   * @param {{nom: string, email: string,
   *          erreurs: Object<string, string>,   // un message par champ fautif
   *          message: {type, texte}|null,
   *          envoiEnCours: boolean}} data
   * @param {{surEnvoi: (valeurs: {nom: string, email: string}) => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(genericRenderer(template, { nom: data.nom, email: data.email }));

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
        nom: formulaire.elements.nom.value.trim(),
        email: formulaire.elements.email.value.trim(),
      });
    });

    return fragment;
  },
};

export { FormulaireProfilView };
