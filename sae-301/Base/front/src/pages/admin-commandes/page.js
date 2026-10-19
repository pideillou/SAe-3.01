import { AdminAuthData } from "../../data/admin-auth.js";
import { AdminCommandeData } from "../../data/admin-commande.js";
import { pluriel } from "../../lib/format.js";
import { naviguer } from "../../lib/navigation.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../../ui/message/index.js";
import { TableauCommandesView } from "../../ui/tableau-commandes/index.js";
import template from "./template.html?raw";

/**
 * Page « Commandes » du back-office (GOF-b), à l'adresse /admin/commandes : la
 * liste des commandes de tous les clients, en lecture seule. Le changement de
 * statut et les filtres relèvent de la gestion des commandes.
 *
 * Réservée aux administrateurs : sans session administrateur, le visiteur est
 * envoyé vers /admin/connexion, et le serveur refuse de toute façon (401).
 */

let M = {
  commandes: [], // les commandes renvoyées par l'API
  limite: 0, // nombre maximal de commandes renvoyées
  message: null, // { type, texte }, ou null
};

let C = {};

C.init = async function () {
  definirMetadonnees({ titre: "Commandes - Back-office" });
  M.commandes = [];
  M.message = null;

  try {
    if (!(await AdminAuthData.moi()).connecte) {
      naviguer("admin/connexion");
      return "";
    }

    let reponse = await AdminCommandeData.fetchAll();
    M.commandes = reponse.commandes;
    M.limite = reponse.limite;
  } catch (erreur) {
    if (erreur.statut === 401) {
      naviguer("admin/connexion");
      return "";
    }

    M.message = { type: "erreur", texte: `Impossible de charger les commandes : ${erreur.message}` };
  }

  return V.init();
};

let V = {};

V.init = function () {
  let resume = "";

  if (M.message === null) {
    resume =
      M.commandes.length >= M.limite
        ? `Les ${M.limite} commandes les plus récentes.`
        : pluriel(M.commandes.length, "commande");
  }

  let pageFragment = htmlToFragment(genericRenderer(template, { resume }));

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let vide = pageFragment.querySelector("[data-vide]");
  let slotTableau = pageFragment.querySelector('slot[name="tableau"]');

  if (M.commandes.length === 0) {
    slotTableau.remove();
    if (M.message !== null) {
      vide.remove();
      pageFragment.querySelector("[data-resume]").remove();
    }
  } else {
    vide.remove();
    slotTableau.replaceWith(TableauCommandesView.dom(M.commandes));
  }

  return pageFragment;
};

export function AdminCommandesPage() {
  return C.init();
}
