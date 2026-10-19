import { formaterDateHeure } from "../../lib/format.js";
import { statutDe } from "../../lib/statuts-commande.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateEntree from "./entree.html?raw";

// Journal des changements de statut d'une commande : quoi, quand, par quel
// administrateur. Lecture seule.
let JournalCommandeView = {
  /**
   * @param {Array<{administrateur, ancien, nouveau, creeLe}>} entrees  du plus récent au plus ancien
   */
  dom: function (entrees) {
    let fragment = htmlToFragment(template);

    if (entrees.length === 0) {
      fragment.querySelector("[data-liste]").remove();
      return fragment;
    }

    fragment.querySelector("[data-vide]").remove();
    fragment.querySelector("[data-liste]").replaceChildren(
      ...entrees.map((entree) => {
        let ancien = statutDe(entree.ancien);
        let nouveau = statutDe(entree.nouveau);

        return htmlToFragment(
          genericRenderer(templateEntree, {
            ancien: ancien.libelle,
            classesAncien: ancien.classes,
            nouveau: nouveau.libelle,
            classesNouveau: nouveau.classes,
            date: formaterDateHeure(entree.creeLe),
            administrateur: entree.administrateur,
          })
        );
      })
    );

    return fragment;
  },
};

export { JournalCommandeView };
