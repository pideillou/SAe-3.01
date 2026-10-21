import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Formulaire de code promotionnel, pour la création comme pour la modification.
// Il ne valide rien : il transmet les saisies par actions.surEnvoi et affiche
// les erreurs qu'on lui donne. En modification, le nom du code est affiché en
// lecture seule (les commandes passées y sont rattachées).
let FormulaireGestionCodeView = {
  /**
   * @param {{enEdition: boolean,
   *          valeurs: {code: string, pourcentage: string, actif: boolean},
   *          erreurs: Object<string, string>,
   *          envoiEnCours: boolean}} data
   * @param {{surEnvoi: (valeurs: {code, pourcentage, actif}) => void,
   *          surAnnulation: () => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(
      genericRenderer(template, {
        titre: data.enEdition ? "Modifier le code" : "Nouveau code",
        bouton: data.enEdition ? "Enregistrer" : "Créer le code",
        aideCode: data.enEdition
          ? "Le nom d'un code ne change pas. Pour en changer, créez un nouveau code et désactivez celui-ci."
          : "2 à 30 caractères : lettres sans accent, chiffres, tiret ou tiret bas. Enregistré en majuscules.",
        code: data.valeurs.code,
        pourcentage: data.valeurs.pourcentage,
      })
    );

    let formulaire = fragment.querySelector("form");
    formulaire.elements.actif.checked = data.valeurs.actif;
    formulaire.elements.code.readOnly = data.enEdition;

    for (let [champ, message] of Object.entries(data.erreurs)) {
      let zone = fragment.querySelector(`[data-erreur="${champ}"]`);
      let saisie = fragment.querySelector(`[name="${champ}"]`);

      if (zone !== null && saisie !== null) {
        zone.textContent = message;
        saisie.setAttribute("aria-invalid", "true");
      }
    }

    formulaire.querySelector('button[type="submit"]').disabled = data.envoiEnCours;

    formulaire.addEventListener("submit", (ev) => {
      ev.preventDefault();
      actions.surEnvoi({
        code: formulaire.elements.code.value.trim(),
        pourcentage: formulaire.elements.pourcentage.value.trim(),
        actif: formulaire.elements.actif.checked,
      });
    });

    fragment.querySelector('[data-action="annuler"]').addEventListener("click", () => actions.surAnnulation());

    return fragment;
  },
};

export { FormulaireGestionCodeView };
