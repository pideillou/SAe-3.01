import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Le champ « Code promo » de la page de commande. Il ne vérifie rien : il
// transmet le code saisi par actions.surApplication, et affiche soit le champ
// (avec l'erreur éventuelle), soit le code appliqué avec un bouton « Retirer ».
let FormulaireCodePromoView = {
  /**
   * @param {{saisie: string,                 // texte du champ
   *          erreur: string,                 // message sous le champ, ou ""
   *          applique: {code: string, pourcentage: number}|null,
   *          envoiEnCours: boolean}} data
   * @param {{surApplication: (code: string) => void,
   *          surRetrait: () => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(
      genericRenderer(template, {
        saisie: data.saisie,
        code: data.applique === null ? "" : data.applique.code,
        pourcentage: data.applique === null ? "" : data.applique.pourcentage,
      })
    );

    let formulaire = fragment.querySelector("form");
    let zone = fragment.querySelector("[data-applique]");

    // Un template n'a pas de condition : on garde l'un des deux états.
    if (data.applique === null) {
      zone.remove();
    } else {
      formulaire.remove();
      zone.querySelector('[data-action="retirer"]').addEventListener("click", () => actions.surRetrait());
      return fragment;
    }

    if (data.erreur !== "") {
      fragment.querySelector("[data-erreur]").textContent = data.erreur;
      formulaire.elements.code.setAttribute("aria-invalid", "true");
    }

    formulaire.querySelector('button[type="submit"]').disabled = data.envoiEnCours;
    formulaire.addEventListener("submit", (ev) => {
      ev.preventDefault();
      actions.surApplication(formulaire.elements.code.value.trim());
    });

    return fragment;
  },
};

export { FormulaireCodePromoView };
