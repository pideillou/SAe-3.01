import { pluriel } from "../../lib/format.js";
import { statutDe } from "../../lib/statuts-commande.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateStatut from "./statut.html?raw";

// Nombre de commandes par statut, dans l'ordre du déroulement d'une commande.
let CommandesParStatutView = {
  /**
   * @param {{total: number, parStatut: Object<string, number>}} commandes
   */
  dom: function (commandes) {
    let fragment = htmlToFragment(genericRenderer(template, { total: pluriel(commandes.total, "commande") }));

    let statuts = Object.entries(commandes.parStatut).map(([statut, nombre]) => {
      let { libelle, classes } = statutDe(statut);
      return htmlToFragment(genericRenderer(templateStatut, { libelle, classes, nombre }));
    });

    fragment.querySelector('slot[name="statuts"]').replaceWith(...statuts);
    return fragment;
  },
};

export { CommandesParStatutView };
