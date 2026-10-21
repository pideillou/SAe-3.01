import { AdminAuthData } from "../../data/admin-auth.js";
import { AdminCommandeData } from "../../data/admin-commande.js";
import { formaterDateHeure } from "../../lib/format.js";
import { naviguer } from "../../lib/navigation.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { statutDe } from "../../lib/statuts-commande.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { ActionsStatutCommandeView } from "../../ui/actions-statut-commande/index.js";
import { ConfirmationSuppressionView } from "../../ui/confirmation-suppression/index.js";
import { JournalCommandeView } from "../../ui/journal-commande/index.js";
import { MessageView } from "../../ui/message/index.js";
import { RecapitulatifCommandeView } from "../../ui/recapitulatif-commande/index.js";
import { The404Page } from "../404/page.js";
import template from "./template.html?raw";

/**
 * Page d'une commande du back-office (PIL-b), à l'adresse /admin/commandes/:numero :
 * le détail complet (client, articles avec les prix d'origine, total), les
 * boutons de changement de statut et le journal des modifications faites par
 * les administrateurs. L'annulation demande une confirmation.
 *
 * Réservée aux administrateurs : sans session administrateur, le visiteur est
 * envoyé vers /admin/connexion, et le serveur refuse de toute façon (401).
 */

let M = {
  numero: "", // numéro demandé dans l'adresse
  commande: null, // la commande renvoyée par l'API, ou null
  aConfirmer: false, // l'annulation attend une confirmation
  messages: [], // [{ type, texte }]
  envoiEnCours: false,
};

let C = {};

C.init = async function (params) {
  M.numero = params.numero;
  M.commande = null;
  M.aConfirmer = false;
  M.messages = [];
  M.envoiEnCours = false;

  try {
    if (!(await AdminAuthData.moi()).connecte) {
      naviguer("admin/connexion");
      return "";
    }

    M.commande = (await AdminCommandeData.fetchOne(M.numero)).commande;
  } catch (erreur) {
    if (erreur.statut === 401) {
      naviguer("admin/connexion");
      return "";
    }

    if (erreur.statut === 404) {
      return The404Page();
    }

    M.messages = [{ type: "erreur", texte: `Impossible de charger la commande : ${erreur.message}` }];
  }

  definirMetadonnees({ titre: `Commande ${M.numero} - Back-office` });
  return V.init();
};

C.handler_changement = function (statut) {
  // Toute annulation demande une confirmation, avant de rien faire.
  if (statut === "annulée") {
    M.aConfirmer = true;
    M.messages = [];
    V.rafraichir();
    V.racine.querySelector('[data-action="annuler"]')?.focus();
    return;
  }

  C.appliquer(statut);
};

C.handler_annulation_confirmation = function () {
  M.aConfirmer = false;
  V.rafraichir();
};

C.handler_confirmation = function () {
  C.appliquer("annulée");
};

C.appliquer = async function (statut) {
  M.envoiEnCours = true;
  V.rafraichir();

  try {
    let reponse = await AdminCommandeData.changerStatut([M.numero], statut);
    let resultat = reponse.resultats[0];

    M.messages = resultat.ok
      ? [{ type: "succes", texte: `La commande est maintenant « ${statutDe(statut).libelle} ».` }]
      : [{ type: "erreur", texte: resultat.erreur }];

    // Statut, boutons possibles et journal viennent du serveur : on les relit.
    M.commande = (await AdminCommandeData.fetchOne(M.numero)).commande;
  } catch (erreur) {
    if (erreur.statut === 401) {
      naviguer("admin/connexion");
      return;
    }

    M.messages = [{ type: "erreur", texte: `Modification impossible : ${erreur.message}` }];
  }

  M.aConfirmer = false;
  M.envoiEnCours = false;
  V.rafraichir();
};

let V = {};

V.racine = null; // élément racine de la page affichée

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  return fragment;
};

/**
 * Reconstruit toute la page à partir du modèle, et remplace l'ancienne.
 */
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
};

V.createPageFragment = function () {
  let commande = M.commande;
  let statut = statutDe(commande === null ? "" : commande.statut);

  let pageFragment = htmlToFragment(
    genericRenderer(template, {
      cheminListe: urlPublique("admin/commandes"),
      numero: M.numero,
      statut: statut.libelle,
      classesStatut: statut.classes,
      email: commande === null ? "" : commande.email,
      date: commande === null ? "" : formaterDateHeure(commande.creeLe),
    })
  );

  pageFragment
    .querySelector('slot[name="message"]')
    .replaceWith(...M.messages.map((message) => MessageView.dom(message)));

  if (commande === null) {
    pageFragment.querySelector("[data-contenu]").remove();
    return pageFragment;
  }

  pageFragment.querySelector('slot[name="recapitulatif"]').replaceWith(
    RecapitulatifCommandeView.dom(
      commande.lignes,
      commande.total,
      commande.reduction === null ? null : { ...commande.reduction, sousTotal: commande.sousTotal }
    )
  );

  let slotConfirmation = pageFragment.querySelector('slot[name="confirmation"]');
  if (!M.aConfirmer) {
    slotConfirmation.remove();
  } else {
    slotConfirmation.replaceWith(
      ConfirmationSuppressionView.dom(
        {
          titre: "Annuler cette commande ?",
          texte: `La commande ${commande.numero} sera annulée et ses produits remis en stock. Elle ne pourra plus changer de statut.`,
          envoiEnCours: M.envoiEnCours,
          libelleConfirmation: "Oui, annuler",
          libelleAnnulation: "Non, ne pas annuler",
        },
        { surConfirmation: C.handler_confirmation, surAnnulation: C.handler_annulation_confirmation }
      )
    );
  }

  pageFragment.querySelector('slot[name="actions"]').replaceWith(
    ActionsStatutCommandeView.dom(
      { suivants: commande.suivants, envoiEnCours: M.envoiEnCours },
      { surChangement: C.handler_changement }
    )
  );

  pageFragment.querySelector('slot[name="journal"]').replaceWith(JournalCommandeView.dom(commande.journal));

  return pageFragment;
};

export function AdminCommandePage(params = {}) {
  return C.init(params);
}
