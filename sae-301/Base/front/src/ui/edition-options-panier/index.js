import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { SelecteurOptionsView } from "../selecteur-options/index.js";
import template from "./template.html?raw";

// Le panneau qui s'ouvre sous une ligne du panier pour en changer les options :
// un sélecteur par option, une phrase sur le prix et le stock de la variante
// obtenue, et les boutons Valider et Annuler. Il ne décide de rien : tout lui
// est donné, et les actions de l'utilisateur sont signalées par actions.
let EditionOptionsPanierView = {
  /**
   * @param {{varianteId: number, note: string, valideDesactive: boolean,
   *          groupes: Array<{titre: string, cartes: Array}>}} data
   * @param {{surChoix: (valeurId: number) => void,
   *          surValidation: () => void,
   *          surAnnulation: () => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(
      genericRenderer(template, { varianteId: data.varianteId, note: data.note })
    );

    fragment.querySelector('slot[name="options"]').replaceWith(
      ...data.groupes.map((groupe) =>
        SelecteurOptionsView.dom(groupe, { surChoix: actions.surChoix })
      )
    );

    let valider = fragment.querySelector('[data-action="valider"]');
    valider.disabled = data.valideDesactive;
    valider.addEventListener("click", actions.surValidation);
    fragment.querySelector('[data-action="annuler"]').addEventListener("click", actions.surAnnulation);

    return fragment;
  },
};

export { EditionOptionsPanierView };
