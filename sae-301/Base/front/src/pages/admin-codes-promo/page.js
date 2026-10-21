import { AdminAuthData } from "../../data/admin-auth.js";
import { AdminCodePromoData } from "../../data/admin-code-promo.js";
import { formaterPrix, pluriel } from "../../lib/format.js";
import { remplacer } from "../../lib/navigation.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { erreursCodePromo } from "../../lib/validation-code-promo.js";
import { ConfirmationSuppressionView } from "../../ui/confirmation-suppression/index.js";
import { FormulaireGestionCodeView } from "../../ui/formulaire-gestion-code/index.js";
import { MessageView } from "../../ui/message/index.js";
import { TableauCodesPromoView } from "../../ui/tableau-codes-promo/index.js";
import template from "./template.html?raw";

/**
 * Page « Codes promo » du back-office (PRO-b), à l'adresse /admin/codes-promo :
 * liste des codes avec leurs statistiques d'utilisation, création,
 * modification du pourcentage et de l'état (actif ou désactivé), suppression
 * après confirmation.
 *
 * Réservée aux administrateurs : le serveur refuse sans session administrateur
 * (401), et la page renvoie alors vers /admin/connexion.
 */

const VALEURS_VIDES = { code: "", pourcentage: "", actif: true };

let M = {
  codes: [], // les codes renvoyés par l'API, avec leurs statistiques
  resume: null, // les totaux renvoyés par l'API
  enEdition: null, // le code en cours de modification, ou null (création)
  aSupprimer: null, // le code dont on demande la confirmation de suppression, ou null
  valeurs: { ...VALEURS_VIDES }, // saisies du formulaire
  erreurs: {}, // un message par champ fautif
  message: null, // { type, texte }, ou null
  envoiEnCours: false,
};

let C = {};

C.charger = async function () {
  let reponse = await AdminCodePromoData.fetchAll();
  M.codes = reponse.codes;
  M.resume = reponse.resume;
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

  M.erreurs = erreur.champs ?? {};
  M.message = { type: "erreur", texte: Object.keys(M.erreurs).length > 0 ? erreur.message : `${prefixe} ${erreur.message}` };
  return false;
};

C.init = async function () {
  definirMetadonnees({ titre: "Codes promo - Back-office" });
  M.enEdition = null;
  M.aSupprimer = null;
  M.erreurs = {};
  M.message = null;
  M.envoiEnCours = false;
  M.valeurs = { ...VALEURS_VIDES };

  try {
    if (!(await AdminAuthData.moi()).connecte) {
      remplacer("admin/connexion");
      return "";
    }

    await C.charger();
  } catch (erreur) {
    if (C.traiterErreur(erreur, "Impossible de charger les codes promo :")) {
      return "";
    }
  }

  return V.init();
};

C.handler_envoi = async function (valeurs) {
  M.valeurs = valeurs;
  M.message = null;
  M.erreurs = erreursCodePromo(valeurs, M.enEdition !== null);

  if (Object.keys(M.erreurs).length > 0) {
    V.rafraichir();
    return;
  }

  M.envoiEnCours = true;
  V.rafraichir();

  try {
    let { code } =
      M.enEdition === null
        ? await AdminCodePromoData.creer({ code: valeurs.code, pourcentage: Number(valeurs.pourcentage), actif: valeurs.actif })
        : await AdminCodePromoData.modifier(M.enEdition.id, Number(valeurs.pourcentage), valeurs.actif);

    M.message = {
      type: "succes",
      texte: `Le code ${code.code} a été ${M.enEdition === null ? "créé" : "modifié"}.`,
    };
    M.enEdition = null;
    M.erreurs = {};
    M.valeurs = { ...VALEURS_VIDES };
    await C.charger();
  } catch (erreur) {
    if (C.traiterErreur(erreur, "Enregistrement impossible :")) {
      return;
    }
  }

  M.envoiEnCours = false;
  V.rafraichir();
};

C.handler_modification = function (code) {
  M.enEdition = code;
  M.aSupprimer = null;
  M.erreurs = {};
  M.message = null;
  M.valeurs = { code: code.code, pourcentage: String(code.pourcentage), actif: code.actif };
  V.rafraichir();
  V.racine.querySelector("#code-pourcentage")?.focus();
};

C.handler_annulation_formulaire = function () {
  M.enEdition = null;
  M.erreurs = {};
  M.message = null;
  M.valeurs = { ...VALEURS_VIDES };
  V.rafraichir();
};

/**
 * Active ou désactive un code d'un clic, sans passer par le formulaire.
 */
C.handler_bascule = async function (code) {
  M.message = null;
  M.envoiEnCours = true;
  V.rafraichir();

  try {
    await AdminCodePromoData.modifier(code.id, code.pourcentage, !code.actif);
    M.message = { type: "succes", texte: `Le code ${code.code} est maintenant ${code.actif ? "désactivé" : "actif"}.` };
    await C.charger();
  } catch (erreur) {
    if (C.traiterErreur(erreur, "Modification impossible :")) {
      return;
    }
  }

  M.envoiEnCours = false;
  V.rafraichir();
};

C.handler_suppression = function (code) {
  M.aSupprimer = code;
  M.message = null;
  V.rafraichir();
  V.racine.querySelector('[data-action="annuler"]')?.focus();
};

C.handler_annulation_suppression = function () {
  M.aSupprimer = null;
  V.rafraichir();
};

C.handler_confirmation_suppression = async function () {
  let code = M.aSupprimer;

  M.envoiEnCours = true;
  V.rafraichir();

  try {
    await AdminCodePromoData.supprimer(code.id);

    if (M.enEdition !== null && M.enEdition.id === code.id) {
      M.enEdition = null;
      M.valeurs = { ...VALEURS_VIDES };
    }

    M.message = { type: "succes", texte: `Le code ${code.code} a été supprimé.` };
    await C.charger();
  } catch (erreur) {
    if (C.traiterErreur(erreur, "Suppression impossible :")) {
      return;
    }
  }

  M.aSupprimer = null;
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

  // Le focus va au premier champ en erreur, pour que le clavier et les lecteurs
  // d'écran retrouvent l'endroit à corriger.
  V.racine.querySelector('[aria-invalid="true"]')?.focus();
};

V.resume = function () {
  if (M.resume === null) {
    return "";
  }

  return (
    `${pluriel(M.resume.codes, "code")} dont ${M.resume.actifs} actif${M.resume.actifs > 1 ? "s" : ""} · ` +
    `${pluriel(M.resume.utilisations, "commande")} avec un code · ` +
    `${formaterPrix(M.resume.reductionTotale)} de réductions accordées (commandes annulées exclues).`
  );
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(genericRenderer(template, { resume: V.resume() }));

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slotConfirmation = pageFragment.querySelector('slot[name="confirmation"]');
  if (M.aSupprimer === null) {
    slotConfirmation.remove();
  } else {
    let utilise = M.aSupprimer.utilisations + M.aSupprimer.annulees;

    slotConfirmation.replaceWith(
      ConfirmationSuppressionView.dom(
        {
          titre: "Supprimer ce code ?",
          texte:
            `Le code ${M.aSupprimer.code} sera supprimé définitivement : les clients ne pourront plus l'utiliser.` +
            (utilise > 0
              ? ` Les ${pluriel(utilise, "commande")} passée${utilise > 1 ? "s" : ""} avec ce code gardent leur réduction, mais ses statistiques ne seront plus visibles.`
              : "") +
            " Pour le suspendre sans le perdre, désactivez-le plutôt.",
          envoiEnCours: M.envoiEnCours,
        },
        { surConfirmation: C.handler_confirmation_suppression, surAnnulation: C.handler_annulation_suppression }
      )
    );
  }

  let slotTableau = pageFragment.querySelector('slot[name="tableau"]');
  if (M.codes.length === 0) {
    slotTableau.replaceWith(
      htmlToFragment('<p class="border border-bordure bg-surface p-6 text-sm text-texte-secondaire">Aucun code promo pour le moment. Créez le premier ci-dessous.</p>')
    );
  } else {
    slotTableau.replaceWith(
      TableauCodesPromoView.dom(
        M.codes,
        { surModification: C.handler_modification, surBascule: C.handler_bascule, surSuppression: C.handler_suppression },
        M.envoiEnCours
      )
    );
  }

  pageFragment.querySelector('slot[name="formulaire"]').replaceWith(
    FormulaireGestionCodeView.dom(
      { enEdition: M.enEdition !== null, valeurs: M.valeurs, erreurs: M.erreurs, envoiEnCours: M.envoiEnCours },
      { surEnvoi: C.handler_envoi, surAnnulation: C.handler_annulation_formulaire }
    )
  );

  return pageFragment;
};

export function AdminCodesPromoPage() {
  return C.init();
}
