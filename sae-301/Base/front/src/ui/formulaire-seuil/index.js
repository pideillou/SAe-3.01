import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Réglage du seuil « Bientôt épuisé ». Le composant ne valide rien : il
// transmet la saisie par actions.surEnvoi et affiche l'erreur qu'on lui donne.
let FormulaireSeuilView = {
  /**
   * @param {{valeur: string, erreur: string|null, envoiEnCours: boolean}} data
   * @param {{surEnvoi: (valeur: string) => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(genericRenderer(template, { seuil: data.valeur }));
    let formulaire = fragment.querySelector("form");

    if (data.erreur !== null) {
      formulaire.querySelector('[data-erreur="seuil"]').textContent = data.erreur;
      formulaire.elements.seuil.setAttribute("aria-invalid", "true");
    }

    formulaire.querySelector('button[type="submit"]').disabled = data.envoiEnCours;
    formulaire.addEventListener("submit", (ev) => {
      ev.preventDefault();
      actions.surEnvoi(formulaire.elements.seuil.value.trim());
    });

    return fragment;
  },
};

export { FormulaireSeuilView };
