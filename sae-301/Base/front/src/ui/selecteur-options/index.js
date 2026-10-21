import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateCarte from "./carte.html?raw";

// Mentions du Figma sous chaque choix.
const MENTIONS = {
  selectionne: "Sélectionné",
  disponible: "Disponible",
  indisponible: "Indisponible",
};

// Une option du produit (Couleur, Disposition du clavier…) : une carte par
// valeur, avec le prix de la variante obtenue en la choisissant. Le composant
// ne décide de rien : l'état de chaque carte lui est donné, et le choix est
// signalé par actions.surChoix.
let SelecteurOptionsView = {
  /**
   * @param {{titre: string,
   *          cartes: Array<{valeurId: number, libelle: string, prix: string,
   *                         etat: "selectionne"|"disponible"|"indisponible",
   *                         mention?: string}>}} data
   * @param {{surChoix: (valeurId: number) => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(genericRenderer(template, { titre: data.titre }));

    let cartes = data.cartes.map((carte) => {
      let element = htmlToFragment(
        genericRenderer(templateCarte, {
          valeurId: carte.valeurId,
          libelle: carte.libelle,
          prix: carte.prix,
          mention: carte.mention ?? MENTIONS[carte.etat],
          // « indisponible » reste un choix possible : on peut voir la variante
          // épuisée. Seul le style la distingue ; « selectionne » est exprimé
          // par aria-pressed, que Tailwind sait cibler. Une carte choisie mais
          // indisponible garde le style « indisponible » (jamais le vert du choix).
          etat: carte.etat === "indisponible" ? "indisponible" : "normal",
          selectionne: String(carte.selectionne === true || carte.etat === "selectionne"),
        })
      );

      element.querySelector("button").addEventListener("click", () => actions.surChoix(carte.valeurId));
      return element;
    });

    fragment.querySelector('slot[name="cartes"]').replaceWith(...cartes);
    return fragment;
  },
};

export { SelecteurOptionsView };
