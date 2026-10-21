import { STATUTS_COMMANDE } from "../../lib/statuts-commande.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Le filtre de l'historique : statut et période. Il ne filtre rien lui-même : il
// signale les valeurs choisies, et la page recharge la liste auprès du serveur.
let FiltreHistoriqueView = {
  /**
   * @param {{statut: string, du: string, au: string}} filtre  valeurs actuelles
   *          (chaînes vides : pas de filtre)
   * @param {{surFiltre: (filtre: {statut: string, du: string, au: string}) => void,
   *          surReinitialisation: () => void}} actions
   */
  dom: function (filtre, actions) {
    let fragment = htmlToFragment(genericRenderer(template, { du: filtre.du, au: filtre.au }));

    let select = fragment.querySelector("select");
    let options = [new Option("Tous les statuts", "")];
    for (let [valeur, statut] of Object.entries(STATUTS_COMMANDE)) {
      options.push(new Option(statut.libelle, valeur));
    }
    select.replaceChildren(...options);
    select.value = filtre.statut;

    let formulaire = fragment.querySelector("form");
    formulaire.addEventListener("submit", (ev) => {
      ev.preventDefault();
      actions.surFiltre({
        statut: select.value,
        du: formulaire.elements.du.value,
        au: formulaire.elements.au.value,
      });
    });

    fragment
      .querySelector('[data-action="reinitialiser"]')
      .addEventListener("click", () => actions.surReinitialisation());

    return fragment;
  },
};

export { FiltreHistoriqueView };
