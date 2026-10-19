import { AdminAuthData } from "../../data/admin-auth.js";
import { StatsData } from "../../data/stats.js";
import { naviguer } from "../../lib/navigation.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../../ui/message/index.js";
import { StatistiquesView } from "../../ui/statistiques/index.js";
import template from "./template.html?raw";

/**
 * Page d'accueil du back-office (GOF-b), à l'adresse /admin : les indicateurs
 * du site (produits, stocks, commandes).
 *
 * La page ne protège rien : c'est le serveur qui décide de l'accès (session
 * administrateur, séparée de celle des clients). La page demande l'état de la
 * session, envoie vers /admin/connexion s'il n'y en a pas, et affiche la
 * réponse du serveur : 200 avec les indicateurs, 401 sinon.
 */

let M = {
  stats: null, // indicateurs, si le serveur les a fournis
  message: null, // { type, texte }, ou null
};

let C = {};

C.init = async function () {
  definirMetadonnees({ titre: "Back-office" });
  M.message = null;
  M.stats = null;

  try {
    if (!(await AdminAuthData.moi()).connecte) {
      naviguer("admin/connexion");
      return "";
    }

    M.stats = await StatsData.fetch();
  } catch (erreur) {
    if (erreur.statut === 401) {
      naviguer("admin/connexion");
      return "";
    }

    M.message = { type: "erreur", texte: `Impossible de charger les indicateurs : ${erreur.message}` };
  }

  return V.init();
};

let V = {};

V.init = function () {
  let pageFragment = htmlToFragment(template);

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slotStats = pageFragment.querySelector('slot[name="statistiques"]');
  if (M.stats === null) {
    slotStats.remove();
  } else {
    slotStats.replaceWith(StatistiquesView.dom(M.stats));
  }

  return pageFragment;
};

export function AdminPage() {
  return C.init();
}
