import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Formulaire de catégorie, pour la création comme pour la modification. Il ne
// valide rien et ne décide de rien : il transmet les saisies par
// actions.surEnvoi et affiche les erreurs qu'on lui donne.
let FormulaireCategorieView = {
  /**
   * @param {{enEdition: boolean,                    // modification d'une catégorie existante
   *          valeurs: {nom, description, ordre},   // saisies à afficher
   *          erreurs: Object<string, string>,      // un message par champ fautif
   *          envoiEnCours: boolean}} data
   * @param {{surEnvoi: (valeurs: {nom, description, ordre}) => void,
   *          surAnnulation: () => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(
      genericRenderer(template, {
        titre: data.enEdition ? "Modifier la catégorie" : "Nouvelle catégorie",
        bouton: data.enEdition ? "Enregistrer" : "Créer la catégorie",
        nom: data.valeurs.nom,
        description: data.valeurs.description,
        ordre: data.valeurs.ordre,
      })
    );

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
        description: formulaire.elements.description.value.trim(),
        ordre: formulaire.elements.ordre.value.trim(),
      });
    });

    fragment.querySelector('[data-action="annuler"]').addEventListener("click", () => actions.surAnnulation());

    return fragment;
  },
};

export { FormulaireCategorieView };
