import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import template from "./template.html?raw";

// Classes écrites en entier : Tailwind ne génère que celles qu'il trouve telles quelles.
const COULEURS = {
  erreur: "border-erreur",
  succes: "border-razer",
};

// Durée d'affichage avant disparition, en millisecondes.
const DUREE = 5000;

// Message court, posé au bas de l'écran (confirmation d'un ajout au panier,
// refus pour cause de stock). La disparition au bout de quelques secondes est un
// comportement d'affichage, géré ici : la page n'en sait rien.
let NotificationView = {
  /**
   * @param {{type: "erreur"|"succes", texte: string}} data
   * @returns {DocumentFragment}
   */
  dom: function (data) {
    let fragment = htmlToFragment(
      genericRenderer(template, {
        texte: data.texte,
        couleurs: COULEURS[data.type],
        chemin: urlPublique("panier"),
      })
    );
    let racine = fragment.firstElementChild;

    // Un refus s'explique de lui-même : le lien vers le panier ne sert qu'à la confirmation.
    if (data.type === "erreur") {
      racine.querySelector("a").remove();
    }

    setTimeout(() => racine.remove(), DUREE);
    return fragment;
  },
};

export { NotificationView };
