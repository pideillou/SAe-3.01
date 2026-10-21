import { AuthData } from "../../data/auth.js";
import { naviguer } from "../../lib/navigation.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";

/**
 * Page « Espace personnel » (CMD-c), à l'adresse /espace-personnel : réservée aux
 * clients connectés. C'est le serveur qui dit si la session est valide
 * (GET /api/moi) ; la page envoie vers la connexion s'il répond « non ».
 */

let M = {
  email: "", // adresse du compte connecté
  message: null, // { type, texte }, ou null
};

let C = {};

C.init = async function () {
  definirMetadonnees({ titre: "Espace personnel" });
  M.message = null;

  try {
    let etat = await AuthData.moi();

    if (!etat.connecte) {
      naviguer("connexion");
      return "";
    }

    M.email = etat.email;
  } catch (erreur) {
    M.email = "";
    M.message = { type: "erreur", texte: `Impossible de vérifier votre connexion : ${erreur.message}` };
  }

  return V.init();
};

C.handler_deconnexion = async function () {
  try {
    await AuthData.logout();
    naviguer("");
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
  let pageFragment = htmlToFragment(genericRenderer(template, { email: M.email, cheminCommandes: urlPublique("espace-personnel/commandes") }));

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));
  pageFragment
    .querySelector('[data-action="deconnexion"]')
    .addEventListener("click", C.handler_deconnexion);

  // Sans adresse (vérification impossible), il n'y a rien à montrer d'autre que le message.
  if (M.email === "") {
    pageFragment.querySelector("div").remove();
  }

  return pageFragment;
};

export function EspacePersonnelPage() {
  return C.init();
}
