import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateArgument from "./argument.html?raw";
import templateCaracteristique from "./caracteristique.html?raw";
import templateParagraphe from "./paragraphe.html?raw";

// Section « Détails du produit » : les points forts en trois cartes, puis la
// description, dont les arguments à titre sont des volets repliables. Un
// template par sorte d'élément : un template n'a ni condition ni boucle.
let DescriptionProduitView = {
  /**
   * @param {Array<{titre: string|null, texte: string}>} blocs
   * @param {string[]} caracteristiques  les points forts (3 chez Razer)
   */
  dom: function (blocs, caracteristiques) {
    let fragment = htmlToFragment(template);

    // Les blocs sans titre restent du texte ; ceux qui ont un titre sont
    // repliables, le premier est ouvert.
    let paragraphes = blocs.filter((bloc) => bloc.titre === null);
    let argumentsTitres = blocs.filter((bloc) => bloc.titre !== null);

    let elementsParagraphes = paragraphes.map((bloc) => htmlToFragment(genericRenderer(templateParagraphe, bloc)));
    let elementsArguments = argumentsTitres.map((bloc) => htmlToFragment(genericRenderer(templateArgument, bloc)));
    elementsArguments[0]?.querySelector("details").setAttribute("open", "");

    if (elementsParagraphes.length === 0) {
      fragment.querySelector("[data-paragraphes]").remove();
    } else {
      fragment.querySelector('slot[name="paragraphes"]').replaceWith(...elementsParagraphes);
    }

    if (elementsArguments.length === 0) {
      fragment.querySelector("[data-arguments]").remove();
    } else {
      fragment.querySelector('slot[name="arguments"]').replaceWith(...elementsArguments);
    }

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
