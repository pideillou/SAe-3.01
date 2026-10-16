import { CommandeData } from "../../data/commande.js";
import { formaterDateHeure } from "../../lib/format.js";
import { naviguer } from "../../lib/navigation.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { MessageView } from "../../ui/message/index.js";
import { RecapitulatifCommandeView } from "../../ui/recapitulatif-commande/index.js";
import { The404Page } from "../404/page.js";
import template from "./template.html?raw";

/**
 * Page « Confirmation de commande » (CMD-a), à l'adresse /commande/:numero. Le
 * serveur ne montre une commande qu'à son propriétaire : celle d'un autre
 * client, ou un numéro inconnu, donne une page 404.
 */

// Libellé affiché pour chaque statut enregistré en base.
const STATUTS = {
  "en cours": "En cours",
  disponible: "Disponible",
  retirée: "Retirée",
  annulée: "Annulée",
};

let M = {
  commande: null, // la commande renvoyée par l'API, ou null
  message: null, // { type, texte }, ou null
};

let C = {};

C.init = async function (params) {
  definirMetadonnees({ titre: "Commande enregistrée" });
  M.commande = null;
  M.message = null;

  try {
    M.commande = (await CommandeData.fetchOne(params.numero)).commande;
  } catch (erreur) {
    if (erreur.statut === 401) {
      naviguer("connexion");
      return "";
    }

    if (erreur.statut === 404) {
      return The404Page();
    }

    M.message = { type: "erreur", texte: `Impossible de charger la commande : ${erreur.message}` };
  }

  return V.init();
};

let V = {};

V.init = function () {
  let commande = M.commande;

  let pageFragment = htmlToFragment(
    genericRenderer(template, {
      email: commande === null ? "" : commande.email,
      numero: commande === null ? "" : commande.numero,
      statut: commande === null ? "" : (STATUTS[commande.statut] ?? commande.statut),
      date: commande === null ? "" : formaterDateHeure(commande.creeLe),
      cheminCatalogue: urlPublique(""),
    })
  );

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  if (commande === null) {
    pageFragment.querySelector("[data-confirmation]").remove();
    return pageFragment;
  }

  pageFragment.querySelector('slot[name="recapitulatif"]').replaceWith(
    RecapitulatifCommandeView.dom(commande.lignes, commande.total)
  );

  return pageFragment;
};

export function ConfirmationCommandePage(params = {}) {
  return C.init(params);
}
