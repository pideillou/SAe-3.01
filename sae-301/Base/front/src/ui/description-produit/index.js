import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateArgument from "./argument.html?raw";
import templateCaracteristique from "./caracteristique.html?raw";
import templateParagraphe from "./paragraphe.html?raw";

// Panneau « Détails du produit » : les points forts sur une ligne, puis les
// arguments de la description, chacun avec son titre quand il en a un. Un
// template par sorte d'élément : un template n'a ni condition ni boucle.
let DescriptionProduitView = {
  /**
   * @param {Array<{titre: string|null, texte: string}>} blocs
   * @param {string[]} caracteristiques  les points forts (3 chez Razer)
   */
  dom: function (blocs, caracteristiques) {
    let fragment = htmlToFragment(template);

    let elements = blocs.map((bloc) =>
      htmlToFragment(genericRenderer(bloc.titre === null ? templateParagraphe : templateArgument, bloc))
    );
    fragment.querySelector('slot[name="blocs"]').replaceWith(...elements);

    if (caracteristiques.length === 0) {
      fragment.querySelector("[data-caracteristiques]").remove();
    } else {
      let points = caracteristiques.map((texte) =>
        htmlToFragment(genericRenderer(templateCaracteristique, { texte }))
      );
      fragment.querySelector('slot[name="caracteristiques"]').replaceWith(...points);
    }

    return fragment;
  },
};

export { DescriptionProduitView };
