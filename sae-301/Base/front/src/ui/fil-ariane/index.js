import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLien from "./lien.html?raw";
import templateTexte from "./texte.html?raw";
import templateCourant from "./courant.html?raw";

// Fil d'Ariane. Le dernier élément est la page affichée ; les précédents sont
// des liens (avec « chemin ») ou du simple texte (sans « chemin »).
// Un template par sorte d'élément : un template n'a ni condition ni boucle.
let FilArianeView = {
  /**
   * @param {Array<{libelle: string, chemin?: string}>} elements
   */
  dom: function (elements) {
    let fragment = htmlToFragment(template);

    let items = elements.map((element, i) => {
      if (i === elements.length - 1) {
        return htmlToFragment(genericRenderer(templateCourant, element));
      }

      if (element.chemin === undefined) {
        return htmlToFragment(genericRenderer(templateTexte, element));
      }

      return htmlToFragment(genericRenderer(templateLien, element));
    });

    fragment.querySelector('slot[name="elements"]').replaceWith(...items);
    return fragment;
  },
};

export { FilArianeView };
