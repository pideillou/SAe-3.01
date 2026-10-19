import { pluriel } from "../../lib/format.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";

// Tableau des catégories du back-office. Il ne modifie rien : il signale le
// clic sur « Modifier » ou « Supprimer », et la page décide de la suite.
let TableauCategoriesView = {
  /**
   * @param {Array<{id, nom, slug, description, ordre, nombre}>} categories
   * @param {{surModification: (categorie: object) => void,
   *          surSuppression: (categorie: object) => void}} actions
   */
  dom: function (categories, actions) {
    let fragment = htmlToFragment(template);

    let lignes = categories.map((categorie) => {
      let ligne = htmlToFragment(
        genericRenderer(templateLigne, {
          ordre: categorie.ordre,
          nom: categorie.nom,
          description: categorie.description ?? "",
          slug: categorie.slug,
          nombre: pluriel(categorie.nombre, "produit"),
        })
      );

      // Un template n'a pas de condition : ces ajustements se font ici.
      if (categorie.description === null) {
        ligne.querySelector("[data-description]").remove();
      }

      // Une catégorie qui contient des produits ne peut pas être supprimée :
      // le bouton est désactivé et la raison est écrite sous lui. Le serveur
      // refuse de toute façon.
      let supprimer = ligne.querySelector('[data-action="supprimer"]');
      if (categorie.nombre > 0) {
        supprimer.disabled = true;
      } else {
        ligne.querySelector("[data-note-produits]").remove();
      }

      ligne.querySelector('[data-action="modifier"]').addEventListener("click", () => actions.surModification(categorie));
      supprimer.addEventListener("click", () => actions.surSuppression(categorie));

      return ligne;
    });

    fragment.querySelector("[data-lignes]").replaceChildren(...lignes);
    return fragment;
  },
};

export { TableauCategoriesView };
