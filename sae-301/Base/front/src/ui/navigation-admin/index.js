import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLien from "./lien.html?raw";

// Navigation entre les sections du back-office. Le routeur pose lui-même
// aria-current="page" sur le lien de la page affichée.
let NavigationAdminView = {
  /**
   * @param {Array<{libelle: string, chemin: string}>} sections  chemins de route
   */
  dom: function (sections) {
    let fragment = htmlToFragment(template);

    let liens = sections.map((section) => htmlToFragment(genericRenderer(templateLien, section)));
    fragment.querySelector('slot[name="liens"]').replaceWith(...liens);

    return fragment;
  },
};

export { NavigationAdminView };
