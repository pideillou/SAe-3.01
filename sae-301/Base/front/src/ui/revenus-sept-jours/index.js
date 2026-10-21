import { formaterPrix, pluriel } from "../../lib/format.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateJour from "./jour.html?raw";

// Revenus des 7 derniers jours : une colonne par jour, hauteur proportionnelle
// au meilleur jour. Chaque montant est écrit au-dessus de sa colonne.
let RevenusSeptJoursView = {
  /**
   * @param {Array<{date: string, commandes: number, revenu: string}>} revenus
   *        sept jours, du plus ancien au plus récent
   */
  dom: function (revenus) {
    let totalCentimes = revenus.reduce((somme, jour) => somme + Math.round(Number(jour.revenu) * 100), 0);
    let commandes = revenus.reduce((somme, jour) => somme + jour.commandes, 0);
    let maximum = Math.max(...revenus.map((jour) => Number(jour.revenu)), 0);

    let fragment = htmlToFragment(
      genericRenderer(template, {
        total: formaterPrix(totalCentimes / 100),
        commandes: pluriel(commandes, "commande"),
      })
    );

    let jours = revenus.map((jour) => {
      let hauteur = maximum === 0 ? 0 : Math.round((Number(jour.revenu) / maximum) * 1000) / 10;

      return htmlToFragment(
        genericRenderer(templateJour, {
          revenu: formaterPrix(jour.revenu),
          hauteur,
          y: Math.round((100 - hauteur) * 10) / 10,
          // « mer. 21 » : le jour de la semaine et le quantième.
          jour: new Date(`${jour.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
        })
      );
    });

    fragment.querySelector('slot[name="jours"]').replaceWith(...jours);
    return fragment;
  },
};

export { RevenusSeptJoursView };
