import { AuthData } from "../../data/auth.js";
import { ProfilData } from "../../data/profil.js";
import { formaterDateHeure, pluriel } from "../../lib/format.js";
import { remplacer } from "../../lib/navigation.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { CarteCommandeView } from "../../ui/carte-commande/index.js";
import { MessageView } from "../../ui/message/index.js";
import { NavigationEspaceView } from "../../ui/navigation-espace/index.js";
import template from "./template.html?raw";

/**
 * Page « Espace personnel » (CMD-c, SUI-b), à l'adresse /espace-personnel :
 * l'accueil du client connecté. Elle salue le client, rappelle ses
 * informations et montre ses dernières commandes. Le profil se modifie sur
 * /espace-personnel/profil, l'historique complet sur /espace-personnel/commandes.
 *
 * Réservée aux clients connectés : c'est le serveur qui dit si la session est
 * valide (GET /api/profil répond 401 sinon), la page envoie alors vers la
 * connexion.
 */

let M = {
  profil: null, // { nom, email, creeLe }, ou null
  nombreCommandes: 0,
  commandes: [], // les dernières commandes
  message: null, // { type, texte }, ou null
};

let C = {};

C.init = async function () {
  definirMetadonnees({ titre: "Espace personnel" });
  M.profil = null;
  M.nombreCommandes = 0;
  M.commandes = [];
  M.message = null;

  try {
    let reponse = await ProfilData.fetch();

    M.profil = reponse.profil;
    M.nombreCommandes = reponse.nombreCommandes;
    M.commandes = reponse.commandesRecentes;
  } catch (erreur) {
    if (erreur.statut === 401) {
      remplacer("connexion?retour=espace-personnel");
      return "";
    }

    M.message = { type: "erreur", texte: `Impossible de charger votre espace personnel : ${erreur.message}` };
  }

  return V.init();
};

C.handler_deconnexion = async function () {
  try {
    await AuthData.logout();
    remplacer("");
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
  let profil = M.profil;

  let pageFragment = htmlToFragment(
    genericRenderer(template, {
      salutation: profil === null ? "" : profil.nom === "" ? "Bonjour" : `Bonjour ${profil.nom}`,
      nom: profil === null || profil.nom === "" ? "Non renseigné" : profil.nom,
      email: profil === null ? "" : profil.email,
      depuis: profil === null ? "" : formaterDateHeure(profil.creeLe).split(" à ")[0],
      compteur: M.nombreCommandes === 0 ? "" : pluriel(M.nombreCommandes, "commande") + " au total",
      cheminProfil: urlPublique("espace-personnel/profil"),
      cheminCommandes: urlPublique("espace-personnel/commandes"),
      cheminCatalogue: urlPublique(""),
    })
  );

  pageFragment.querySelector('slot[name="navigation"]').replaceWith(NavigationEspaceView.dom("accueil"));
  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  // Sans profil (chargement impossible), il n'y a rien à montrer d'autre que le message.
  if (profil === null) {
    pageFragment.querySelector("[data-contenu]").remove();
    return pageFragment;
  }

  pageFragment.querySelector('[data-action="deconnexion"]').addEventListener("click", C.handler_deconnexion);

  if (M.commandes.length === 0) {
    pageFragment.querySelector("[data-liste]").remove();
    pageFragment.querySelector("[data-lien-commandes]").remove();
  } else {
    pageFragment.querySelector("[data-vide]").remove();
    pageFragment
      .querySelector('slot[name="commandes"]')
      .replaceWith(...M.commandes.map((commande) => CarteCommandeView.dom(commande)));
  }

  return pageFragment;
};

export function EspacePersonnelPage() {
  return C.init();
}
