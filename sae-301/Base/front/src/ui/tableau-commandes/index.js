import { formaterDateHeure, formaterPrix } from "../../lib/format.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";

// Classes écrites en entier : Tailwind ne génère que celles qu'il trouve telles quelles.
const STATUTS = {
  "en cours": { libelle: "En cours", classes: "text-alerte" },
  disponible: { libelle: "Disponible", classes: "text-razer" },
  retirée: { libelle: "Retirée", classes: "text-texte-secondaire" },
  annulée: { libelle: "Annulée", classes: "text-erreur" },
};

// Tableau des commandes du back-office, en lecture seule.
let TableauCommandesView = {
  /**
   * @param {Array<{numero, statut, total, creeLe, email, articles}>} commandes
   */
  dom: function (commandes) {
    let fragment = htmlToFragment(template);

    let lignes = commandes.map((commande) => {
      let statut = STATUTS[commande.statut] ?? { libelle: commande.statut, classes: "" };

      return htmlToFragment(
        genericRenderer(templateLigne, {
          numero: commande.numero,
          date: formaterDateHeure(commande.creeLe),
          email: commande.email,
          articles: commande.articles,
          statut: statut.libelle,
          classesStatut: statut.classes,
          total: formaterPrix(commande.total),
        })
      );
    });

    fragment.querySelector("[data-lignes]").replaceChildren(...lignes);
    return fragment;
  },
};

export { TableauCommandesView };
