import { AdminAuthData } from "../../data/admin-auth.js";
import { AdminCommandeData } from "../../data/admin-commande.js";
import { pluriel } from "../../lib/format.js";
import { remplacer } from "../../lib/navigation.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { ACTIONS_COMMANDE, statutDe } from "../../lib/statuts-commande.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { BarreCommandesView } from "../../ui/barre-commandes/index.js";
import { ConfirmationSuppressionView } from "../../ui/confirmation-suppression/index.js";
import { MessageView } from "../../ui/message/index.js";
import { TableauCommandesView } from "../../ui/tableau-commandes/index.js";
import template from "./template.html?raw";

/**
 * Page « Commandes » du back-office (PIL-b), à l'adresse /admin/commandes : la
 * liste des commandes de tous les clients, triée par date, statut ou montant,
 * filtrable par statut, avec des actions en lot sur les commandes cochées
 * (disponible, retirée, annulée). Le détail d'une commande est sur sa propre
 * page. Toute annulation demande une confirmation.
 *
 * Réservée aux administrateurs : sans session administrateur, le visiteur est
 * envoyé vers /admin/connexion, et le serveur refuse de toute façon (401).
 */

// Sens du premier clic sur chaque colonne : la date et le montant du plus grand
// au plus petit, le statut dans l'ordre de traitement.
const SENS_INITIAL = { date: "desc", montant: "desc", statut: "asc" };

let M = {
  commandes: [], // les commandes renvoyées par l'API
  limite: 0, // nombre maximal de commandes renvoyées
  tri: "date", // colonne triée
  sens: "desc", // sens du tri
  statut: "", // filtre par statut (« » pour tous)
  action: "disponible", // action en lot choisie
  selection: new Set(), // numéros des commandes cochées
  aConfirmer: false, // l'annulation de la sélection attend une confirmation
  messages: [], // [{ type, texte }] affichés en haut de page
  envoiEnCours: false,
};

let C = {};

C.charger = async function () {
  let reponse = await AdminCommandeData.fetchAll({ tri: M.tri, sens: M.sens, statut: M.statut });

  M.commandes = reponse.commandes;
  M.limite = reponse.limite;

  // Une commande qui n'est plus dans la liste (filtre, changement de statut) ne reste pas cochée.
  let affichees = new Set(M.commandes.map((c) => c.numero));
  M.selection = new Set([...M.selection].filter((numero) => affichees.has(numero)));
};

/**
 * Une erreur de l'API : un 401 renvoie vers la connexion, le reste est montré.
 * Renvoie true si la page doit s'arrêter là.
 */
C.traiterErreur = function (erreur, prefixe) {
  if (erreur.statut === 401) {
    remplacer("admin/connexion");
    return true;
  }

  M.messages = [{ type: "erreur", texte: `${prefixe} ${erreur.message}` }];
  return false;
};

C.init = async function () {
  definirMetadonnees({ titre: "Commandes - Back-office" });
  M.tri = "date";
  M.sens = "desc";
  M.statut = "";
  M.action = "disponible";
  M.selection = new Set();
  M.aConfirmer = false;
  M.messages = [];
  M.envoiEnCours = false;

  try {
    if (!(await AdminAuthData.moi()).connecte) {
      remplacer("admin/connexion");
      return "";
    }

    await C.charger();
  } catch (erreur) {
    if (C.traiterErreur(erreur, "Impossible de charger les commandes :")) {
      return "";
    }
  }

  return V.init();
};

/**
 * Relit les commandes (nouveau tri ou filtre) puis reconstruit la page.
 */
C.recharger = async function () {
  try {
    await C.charger();
  } catch (erreur) {
    if (C.traiterErreur(erreur, "Impossible de charger les commandes :")) {
      return;
    }
  }

  V.rafraichir();
};

C.handler_tri = function (colonne) {
  M.sens = colonne === M.tri ? (M.sens === "asc" ? "desc" : "asc") : (SENS_INITIAL[colonne] ?? "desc");
  M.tri = colonne;
  M.messages = [];
  C.recharger();
};

C.handler_filtre = function (statut) {
  M.statut = statut;
  M.selection = new Set();
  M.aConfirmer = false;
  M.messages = [];
  C.recharger();
};

C.handler_selection = function (numero, coche) {
  M.aConfirmer = false;
  coche ? M.selection.add(numero) : M.selection.delete(numero);
  V.rafraichir();
  V.racine.querySelector(`[data-numero="${numero}"]`)?.focus();
};

C.handler_tout_selectionner = function (coche) {
  M.aConfirmer = false;
  M.selection = coche ? new Set(M.commandes.map((c) => c.numero)) : new Set();
  V.rafraichir();
  V.racine.querySelector('[data-role="tout"]')?.focus();
};

C.handler_choix_action = function (action) {
  M.action = action;
  M.aConfirmer = false;
  V.rafraichir();
  V.racine.querySelector("#action-lot")?.focus();
};

C.handler_application = function () {
  M.messages = [];

  // Toute annulation demande une confirmation, avant de rien faire.
  if (M.action === "annulée") {
    M.aConfirmer = true;
    V.rafraichir();
    V.racine.querySelector('[data-action="annuler"]')?.focus();
    return;
  }

  C.appliquer();
};

C.handler_annulation_confirmation = function () {
  M.aConfirmer = false;
  V.rafraichir();
};

/**
 * Applique l'action choisie à toutes les commandes cochées, puis résume ce qui
 * s'est passé : combien ont été modifiées, et pourquoi les autres ont été refusées.
 */
C.appliquer = async function () {
  M.envoiEnCours = true;
  V.rafraichir();

  try {
    let reponse = await AdminCommandeData.changerStatut([...M.selection], M.action);
    let refusees = reponse.resultats.filter((resultat) => !resultat.ok);

    M.messages = [];

    if (reponse.modifiees > 0) {
      M.messages.push({
        type: "succes",
        texte: `${pluriel(reponse.modifiees, "commande")} ${reponse.modifiees > 1 ? "ont" : "a"} été ${reponse.modifiees > 1 ? "passées" : "passée"} à « ${statutDe(reponse.statut).libelle} ».`,
      });
    }

    for (let refus of refusees) {
      M.messages.push({ type: "erreur", texte: refus.erreur });
    }

    M.selection = new Set();
    await C.charger();
  } catch (erreur) {
    if (C.traiterErreur(erreur, "Modification impossible :")) {
      return;
    }
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
  let enErreur = M.messages.some((message) => message.type === "erreur") && M.commandes.length === 0 && M.limite === 0;

  let resume = "";
  if (!enErreur) {
    resume =
      M.commandes.length >= M.limite
        ? `Les ${M.limite} commandes les plus récentes.`
        : pluriel(M.commandes.length, "commande");
  }

  let pageFragment = htmlToFragment(
    genericRenderer(template, {
      resume,
      texteVide: M.statut === "" ? "Aucune commande pour le moment." : `Aucune commande « ${statutDe(M.statut).libelle} ».`,
    })
  );

  pageFragment
    .querySelector('slot[name="message"]')
    .replaceWith(...M.messages.map((message) => MessageView.dom(message)));

  let slotConfirmation = pageFragment.querySelector('slot[name="confirmation"]');
  if (!M.aConfirmer) {
    slotConfirmation.remove();
  } else {
    slotConfirmation.replaceWith(
      ConfirmationSuppressionView.dom(
        {
          titre: `Annuler ${pluriel(M.selection.size, "commande")} ?`,
          texte:
            "Les produits de ces commandes seront remis en stock. Une commande annulée ne peut plus changer de statut. Les commandes déjà retirées ne peuvent pas être annulées.",
          envoiEnCours: M.envoiEnCours,
          libelleConfirmation: "Oui, annuler",
          libelleAnnulation: "Non, ne rien annuler",
        },
        { surConfirmation: C.appliquer, surAnnulation: C.handler_annulation_confirmation }
      )
    );
  }

  pageFragment.querySelector('slot[name="barre"]').replaceWith(
    BarreCommandesView.dom(
      { statut: M.statut, action: M.action, nombreSelection: M.selection.size, envoiEnCours: M.envoiEnCours },
      { surFiltre: C.handler_filtre, surChoixAction: C.handler_choix_action, surApplication: C.handler_application }
    )
  );

  let vide = pageFragment.querySelector("[data-vide]");
  let slotTableau = pageFragment.querySelector('slot[name="tableau"]');

  if (M.commandes.length === 0) {
    slotTableau.remove();
    if (enErreur) {
      vide.remove();
      pageFragment.querySelector("[data-resume]").remove();
    }
  } else {
    vide.remove();
    slotTableau.replaceWith(
      TableauCommandesView.dom(
        { commandes: M.commandes, tri: M.tri, sens: M.sens, selection: M.selection },
        { surTri: C.handler_tri, surSelection: C.handler_selection, surToutSelectionner: C.handler_tout_selectionner }
      )
    );
  }

  return pageFragment;
};

export function AdminCommandesPage() {
  return C.init();
}
