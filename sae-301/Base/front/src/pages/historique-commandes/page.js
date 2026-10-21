import { CommandeData } from "../../data/commande.js";
import { transfererDansLePanier } from "../../lib/panier-stock.js";
import { pluriel } from "../../lib/format.js";
import { remplacer } from "../../lib/navigation.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { CarteCommandeView } from "../../ui/carte-commande/index.js";
import { FiltreHistoriqueView } from "../../ui/filtre-historique/index.js";
import { MessageView } from "../../ui/message/index.js";
import { NavigationEspaceView } from "../../ui/navigation-espace/index.js";
import { PaginationView } from "../../ui/pagination/index.js";
import template from "./template.html?raw";

/**
 * Page « Mes commandes » (SUI-c), à l'adresse /espace-personnel/commandes :
 * l'historique des commandes du client connecté, de la plus récente à la plus
 * ancienne, par pages de 10, avec un filtre par statut et par période. Le
 * filtre et la pagination sont appliqués par le serveur.
 *
 * « Commander à nouveau » (SUI-a) remet dans le panier les articles d'une
 * commande passée, avec les options choisies à l'époque, après que le serveur a
 * vérifié ce qui est encore disponible.
 *
 * Réservée aux clients connectés : sans session, le serveur répond 401 et la
 * page envoie vers la connexion.
 */

const FILTRE_VIDE = { statut: "", du: "", au: "" };

let M = {
  commandes: [], // les commandes de la page affichée
  total: 0, // nombre de commandes correspondant au filtre, toutes pages confondues
  page: 1,
  pages: 1,
  filtre: { ...FILTRE_VIDE },
  message: null, // { type, texte }, ou null
  recommande: { messages: [], versPanier: false }, // résultat du dernier « Commander à nouveau »
  numeroEnCours: null, // commande en cours de transfert vers le panier, ou null
};

let C = {};

C.filtreActif = function () {
  return M.filtre.statut !== "" || M.filtre.du !== "" || M.filtre.au !== "";
};

/**
 * Charge une page de l'historique avec le filtre courant. En cas d'échec, la
 * liste affichée reste celle d'avant et le message explique pourquoi.
 *
 * @returns {Promise<boolean>}  faux si le visiteur a été envoyé vers la connexion
 */
C.charger = async function (page) {
  // Une nouvelle liste (page, filtre) efface le résultat du dernier transfert.
  M.recommande = { messages: [], versPanier: false };

  try {
    let reponse = await CommandeData.fetchAll(M.filtre, page);

    M.commandes = reponse.commandes;
    M.total = reponse.total;
    M.page = reponse.page;
    M.pages = reponse.pages;
    M.message = null;
  } catch (erreur) {
    if (erreur.statut === 401) {
      remplacer("connexion?retour=espace-personnel/commandes");
      return false;
    }

    M.message = { type: "erreur", texte: erreur.message };
  }

  return true;
};

C.init = async function () {
  definirMetadonnees({ titre: "Mes commandes" });
  M.filtre = { ...FILTRE_VIDE };
  M.commandes = [];
  M.total = 0;
  M.page = 1;
  M.pages = 1;
  M.message = null;
  M.recommande = { messages: [], versPanier: false };
  M.numeroEnCours = null;

  if (!(await C.charger(1))) {
    return "";
  }

  return V.init();
};

C.handler_filtrer = async function (filtre) {
  if (filtre.du !== "" && filtre.au !== "" && filtre.du > filtre.au) {
    M.filtre = filtre;
    M.message = { type: "erreur", texte: "La date de début doit précéder la date de fin." };
    V.rafraichir();
    return;
  }

  M.filtre = filtre;
  await C.charger(1);
  V.rafraichir();
};

C.handler_reinitialiser = async function () {
  M.filtre = { ...FILTRE_VIDE };
  await C.charger(1);
  V.rafraichir();
};

C.handler_page = async function (page) {
  await C.charger(page);
  V.rafraichir();

  // La liste change entièrement : le focus revient en haut de la page.
  V.racine.querySelector("h1").focus();
};

/**
 * Remet dans le panier les articles d'une commande passée. Le serveur vérifie la
 * disponibilité d'aujourd'hui ; le résultat est expliqué au client : ce qui a
 * été ajouté, ce qui ne l'a pas pu (épuisé, supprimé), les quantités et les
 * prix qui ont changé.
 */
C.handler_recommander = async function (numero) {
  if (M.numeroEnCours !== null) {
    return;
  }

  M.numeroEnCours = numero;
  V.rafraichir();

  try {
    let reponse = await CommandeData.recommander(numero);
    let messages = transfererDansLePanier(reponse);

    M.recommande = { messages, versPanier: messages[0].type === "succes" };
  } catch (erreur) {
    if (erreur.statut === 401) {
      remplacer("connexion?retour=espace-personnel/commandes");
      return;
    }

    M.recommande = {
      messages: [{ type: "erreur", texte: `Impossible de commander à nouveau : ${erreur.message}` }],
      versPanier: false,
    };
  }

  M.numeroEnCours = null;
  V.rafraichir();

  // Le résultat s'affiche en haut de page : le focus l'y amène.
  V.racine.querySelector("h1").focus();
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
  let filtre = C.filtreActif();

  let pageFragment = htmlToFragment(
    genericRenderer(template, {
      compteur: M.total === 0 ? "" : `${pluriel(M.total, "commande")}${filtre ? " correspondant à votre recherche" : ""}`,
      texteVide: filtre
        ? "Aucune commande ne correspond à ces critères."
        : "Vous n'avez pas encore passé de commande.",
      cheminCatalogue: urlPublique(""),
      cheminPanier: urlPublique("panier"),
    })
  );

  pageFragment.querySelector('slot[name="navigation"]').replaceWith(NavigationEspaceView.dom("commandes"));
  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  // Résultat de « Commander à nouveau » (le lien vers le panier seulement si
  // quelque chose y a été ajouté).
  if (M.recommande.messages.length === 0) {
    pageFragment.querySelector("[data-recommande]").remove();
  } else {
    pageFragment
      .querySelector('slot[name="recommande"]')
      .replaceWith(...M.recommande.messages.map((message) => MessageView.dom(message)));

    if (!M.recommande.versPanier) {
      pageFragment.querySelector("[data-lien-panier]").remove();
    }
  }

  // Le filtre reste affiché tant qu'il y a un filtre ou des commandes : sinon
  // il n'a rien à filtrer.
  let slotFiltre = pageFragment.querySelector('slot[name="filtre"]');
  if (M.total === 0 && !filtre) {
    slotFiltre.remove();
  } else {
    slotFiltre.replaceWith(
      FiltreHistoriqueView.dom(M.filtre, {
        surFiltre: C.handler_filtrer,
        surReinitialisation: C.handler_reinitialiser,
      })
    );
  }

  if (M.commandes.length === 0) {
    pageFragment.querySelector("[data-liste]").remove();
    pageFragment.querySelector('slot[name="pagination"]').remove();

    // Avec un filtre, le catalogue n'est pas la bonne réponse.
    if (filtre) {
      pageFragment.querySelector("[data-lien-catalogue]").remove();
    }

    return pageFragment;
  }

  pageFragment.querySelector("[data-vide]").remove();
  pageFragment
    .querySelector('slot[name="commandes"]')
    .replaceWith(
      ...M.commandes.map((commande) => {
        let carte = CarteCommandeView.dom(commande, { surRecommander: C.handler_recommander });
        // Pendant le transfert, les boutons sont bloqués : pas de double clic.
        if (M.numeroEnCours !== null) {
          carte.querySelector('[data-action="recommander"]').disabled = true;
        }
        return carte;
      })
    );

  let slotPagination = pageFragment.querySelector('slot[name="pagination"]');
  if (M.pages <= 1) {
    slotPagination.remove();
  } else {
    slotPagination.replaceWith(PaginationView.dom({ page: M.page, pages: M.pages }, { surPage: C.handler_page }));
  }

  return pageFragment;
};

export function HistoriqueCommandesPage() {
  return C.init();
}
