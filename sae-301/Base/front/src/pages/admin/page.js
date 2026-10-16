import { AdminAuthData } from "../../data/admin-auth.js";
import { StatsData } from "../../data/stats.js";
import { naviguer } from "../../lib/navigation.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../../ui/message/index.js";
import { StatistiquesView } from "../../ui/statistiques/index.js";
import template from "./template.html?raw";

/**
 * Page « Administration ».
 *
 * La page ne protège rien : c'est le serveur qui décide de l'accès (session
 * administrateur, séparée de celle des clients). La page demande l'état de la
 * session, envoie vers /admin/connexion s'il n'y en a pas, et affiche la
 * réponse du serveur : 200 avec les statistiques, 401 sinon.
 */

let M = {
  email: "", // adresse de l'administrateur connecté
  stats: null, // statistiques, si le serveur les a fournies
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande les statistiques. Le résultat dépend de ce que décide le serveur.
 */
C.chargerStats = async function () {
  try {
    M.stats = await StatsData.fetch();
  } catch (erreur) {
    M.stats = null;

    let texte = erreur.message;
    if (erreur.statut === 401) texte = "Vous n'êtes pas connecté.";

    M.message = { type: "erreur", texte };
  }
};

C.init = async function () {
  definirMetadonnees({ titre: "Administration" });
  M.message = null;
  M.stats = null;

  try {
    let etat = await AdminAuthData.moi();

    if (!etat.connecte) {
      naviguer("admin/connexion");
      return "";
    }

    M.email = etat.email;
  } catch (erreur) {
    M.email = "";
    M.message = { type: "erreur", texte: `Impossible de vérifier votre connexion : ${erreur.message}` };
    return V.init();
  }

  await C.chargerStats();
  return V.init();
};

C.handler_deconnexion = async function () {
  try {
    await AdminAuthData.logout();
    naviguer("admin/connexion");
  } catch (erreur) {
    M.message = { type: "erreur", texte: `Déconnexion impossible : ${erreur.message}` };
    V.rafraichir();
  }
};

let V = {};

V.racine = null; // élément racine de la page affichée

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  return fragment;
};

V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(genericRenderer(template, { email: M.email }));

  pageFragment
    .querySelector('[data-action="deconnexion"]')
    .addEventListener("click", C.handler_deconnexion);
  if (M.email === "") {
    pageFragment.querySelector("[data-session]").remove();
  }

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
