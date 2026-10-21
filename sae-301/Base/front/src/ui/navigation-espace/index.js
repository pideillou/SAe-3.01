import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLien from "./lien.html?raw";

// Les sections de l'espace personnel.
const SECTIONS = [
  { cle: "accueil", libelle: "Accueil", chemin: "espace-personnel" },
  { cle: "commandes", libelle: "Mes commandes", chemin: "espace-personnel/commandes" },
  { cle: "profil", libelle: "Mon profil", chemin: "espace-personnel/profil" },
];

// Navigation entre les pages de l'espace personnel. La page reconstruit son
// contenu à chaque changement : elle dit elle-même quelle section est affichée
// (aria-current="page").
let NavigationEspaceView = {
  /**
   * @param {"accueil"|"commandes"|"profil"} courante  la section affichée
   */
  dom: function (courante) {
    let fragment = htmlToFragment(template);

    let liens = SECTIONS.map((section) => {
      let lien = htmlToFragment(
        genericRenderer(templateLien, { chemin: urlPublique(section.chemin), libelle: section.libelle })
      );

      if (section.cle === courante) {
        lien.querySelector("a").setAttribute("aria-current", "page");
      }

      return lien;
    });

    fragment.querySelector('slot[name="liens"]').replaceWith(...liens);
    return fragment;
  },
};

export { NavigationEspaceView };
