import { ACTIONS_COMMANDE } from "../../lib/statuts-commande.js";
import { htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Boutons de changement de statut d'une commande : un par statut possible. Le
// composant ne change rien : il signale le statut demandé.
let ActionsStatutCommandeView = {
  /**
   * @param {{suivants: string[],          // statuts possibles depuis le statut actuel
   *          envoiEnCours: boolean}} data
   * @param {{surChangement: (statut: string) => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(template);
    let note = fragment.querySelector("[data-note]");
    let zone = fragment.querySelector("[data-boutons]");

    if (data.suivants.length === 0) {
      note.textContent = "Cette commande est terminée : son statut ne peut plus changer.";
      zone.remove();
      return fragment;
    }

    note.textContent = data.suivants.includes("annulée")
      ? "L'annulation remet les produits de la commande en stock. Les autres changements de statut ne touchent pas au stock."
      : "";

    zone.replaceChildren(
      ...data.suivants.map((statut) => {
        let bouton = document.createElement("button");
        bouton.type = "button";
        bouton.textContent = ACTIONS_COMMANDE[statut];
        bouton.disabled = data.envoiEnCours;
        bouton.dataset.statut = statut;
        bouton.className =
          statut === "annulée"
            ? "min-h-12 border border-bordure px-6 py-3 font-titres text-[0.9375rem] font-semibold uppercase transition-colors hover:border-erreur hover:text-erreur disabled:cursor-wait disabled:opacity-40"
            : "min-h-12 border border-razer bg-razer px-6 py-3 font-titres text-[0.9375rem] font-semibold text-sur-razer uppercase transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-40";
        bouton.addEventListener("click", () => actions.surChangement(statut));
        return bouton;
      })
    );

    if (data.suivants.length === 0 || note.textContent === "") {
      note.remove();
    }

    return fragment;
  },
};

export { ActionsStatutCommandeView };
