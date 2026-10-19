import { pluriel } from "../../lib/format.js";
import { ACTIONS_COMMANDE, STATUTS_COMMANDE } from "../../lib/statuts-commande.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Barre au-dessus du tableau des commandes : filtre par statut et action en lot
// sur la sélection. Le composant ne décide de rien : il signale le choix du
// filtre et la demande d'appliquer une action.
let BarreCommandesView = {
  /**
   * @param {{statut: string,          // filtre actuel (« » pour tous)
   *          action: string,          // action en lot choisie
   *          nombreSelection: number,
   *          envoiEnCours: boolean}} data
   * @param {{surFiltre: (statut: string) => void,
   *          surChoixAction: (action: string) => void,
   *          surApplication: () => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(
      genericRenderer(template, {
        compteur: data.nombreSelection === 0 ? "Aucune commande sélectionnée" : `${pluriel(data.nombreSelection, "commande")} sélectionnée${data.nombreSelection > 1 ? "s" : ""}`,
      })
    );

    let filtre = fragment.querySelector("#filtre-statut");
    for (let [statut, { libelle }] of Object.entries(STATUTS_COMMANDE)) {
      let option = document.createElement("option");
      option.value = statut;
      option.textContent = libelle;
      option.selected = statut === data.statut;
      filtre.append(option);
    }
    filtre.addEventListener("change", () => actions.surFiltre(filtre.value));

    let choix = fragment.querySelector("#action-lot");
    for (let [statut, libelle] of Object.entries(ACTIONS_COMMANDE)) {
      let option = document.createElement("option");
      option.value = statut;
      option.textContent = libelle;
      option.selected = statut === data.action;
      choix.append(option);
    }
    choix.addEventListener("change", () => actions.surChoixAction(choix.value));

    let bouton = fragment.querySelector('button[type="submit"]');
    bouton.disabled = data.nombreSelection === 0 || data.envoiEnCours;

    fragment.querySelector("form").addEventListener("submit", (ev) => {
      ev.preventDefault();
      actions.surApplication();
    });

    return fragment;
  },
};

export { BarreCommandesView };
