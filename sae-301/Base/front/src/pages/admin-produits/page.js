import { AdminAuthData } from "../../data/admin-auth.js";
import { AdminProduitData } from "../../data/admin-produit.js";
import { pluriel } from "../../lib/format.js";
import { naviguer } from "../../lib/navigation.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { ConfirmationSuppressionView } from "../../ui/confirmation-suppression/index.js";
import { FormulaireSeuilView } from "../../ui/formulaire-seuil/index.js";
import { MessageView } from "../../ui/message/index.js";
import { TableauProduitsView } from "../../ui/tableau-produits/index.js";
import template from "./template.html?raw";

/**
 * Page « Produits » du back-office (GOF-a), à l'adresse /admin/produits : la
 * liste des produits avec leur état de stock, la suppression (après
 * confirmation) et le réglage du seuil « Bientôt épuisé ». La création et la
 * modification d'un produit ont leur page (/admin/produits/nouveau et /admin/produits/:id).
 *
 * Réservée aux administrateurs : le serveur refuse sans session administrateur
 * (401), et la page renvoie alors vers /admin/connexion.
 */

let M = {
  produits: [], // les produits renvoyés par l'API
  seuil: 5, // seuil « Bientôt épuisé » en vigueur
  seuilSaisi: "5", // contenu du champ du seuil
  erreurSeuil: null, // message d'erreur du champ du seuil, ou null
  aSupprimer: null, // le produit dont on demande la confirmation de suppression, ou null
  message: null, // { type, texte }, ou null
  envoiEnCours: false,
};

let C = {};

C.charger = async function () {
  let reponse = await AdminProduitData.fetchAll();
  M.produits = reponse.produits;
  M.seuil = reponse.seuil;
  M.seuilSaisi = String(reponse.seuil);
};

/**
 * Une erreur de l'API : un 401 renvoie vers la connexion, le reste est montré.
 * Renvoie true si la page doit s'arrêter là.
 */
C.traiterErreur = function (erreur, prefixe) {
  if (erreur.statut === 401) {
    naviguer("admin/connexion");
    return true;
  }

  M.message = { type: "erreur", texte: `${prefixe} ${erreur.message}` };
  return false;
};

C.init = async function () {
  definirMetadonnees({ titre: "Produits - Back-office" });
  M.aSupprimer = null;
  M.erreurSeuil = null;
  M.envoiEnCours = false;
  M.message = null;

  try {
    if (!(await AdminAuthData.moi()).connecte) {
      naviguer("admin/connexion");
      return "";
    }

    await C.charger();
  } catch (erreur) {
    if (C.traiterErreur(erreur, "Impossible de charger les produits :")) {
      return "";
    }
  }

  return V.init();
};

C.handler_demande_suppression = function (produit) {
  M.aSupprimer = produit;
  M.message = null;
  V.rafraichir();
  V.racine.querySelector('[data-action="annuler"]')?.focus();
};

C.handler_annulation_suppression = function () {
  M.aSupprimer = null;
  V.rafraichir();
};

C.handler_confirmation_suppression = async function () {
  let produit = M.aSupprimer;

  M.envoiEnCours = true;
  V.rafraichir();

  try {
    await AdminProduitData.supprimer(produit.id);
    M.message = { type: "succes", texte: `Le produit « ${produit.nom} » a été supprimé.` };
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

C.handler_seuil = async function (saisie) {
  M.seuilSaisi = saisie;
  M.message = null;
  M.erreurSeuil = null;

  if (!/^\d+$/.test(saisie) || Number(saisie) > 1000) {
    M.erreurSeuil = "Le seuil doit être un nombre entier de 0 à 1000.";
    V.rafraichir();
    return;
  }

  M.envoiEnCours = true;
  V.rafraichir();

  try {
    await AdminProduitData.definirSeuil(Number(saisie));
    M.message = { type: "succes", texte: `Le seuil « Bientôt épuisé » est maintenant de ${saisie}.` };
    await C.charger();
  } catch (erreur) {
    if (C.traiterErreur(erreur, "Enregistrement impossible :")) {
      return;
    }
  }

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

  V.racine.querySelector('[aria-invalid="true"]')?.focus();
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(
    genericRenderer(template, {
      resume: pluriel(M.produits.length, "produit"),
      cheminNouveau: urlPublique("admin/produits/nouveau"),
    })
  );

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slotConfirmation = pageFragment.querySelector('slot[name="confirmation"]');
  if (M.aSupprimer === null) {
    slotConfirmation.remove();
  } else {
    slotConfirmation.replaceWith(
      ConfirmationSuppressionView.dom(
        {
          titre: "Supprimer ce produit ?",
          texte: `Le produit « ${M.aSupprimer.nom} », ses variantes, ses stocks et ses images seront supprimés définitivement. Les commandes déjà passées gardent leur copie du produit.`,
          envoiEnCours: M.envoiEnCours,
        },
        { surConfirmation: C.handler_confirmation_suppression, surAnnulation: C.handler_annulation_suppression }
      )
    );
  }

  let slotTableau = pageFragment.querySelector('slot[name="tableau"]');
  if (M.produits.length === 0) {
    slotTableau.replaceWith(
      htmlToFragment('<p class="border border-bordure bg-surface p-6 text-sm text-texte-secondaire">Aucun produit pour le moment.</p>')
    );
  } else {
    slotTableau.replaceWith(TableauProduitsView.dom(M.produits, { surSuppression: C.handler_demande_suppression }));
  }

  pageFragment.querySelector('slot[name="seuil"]').replaceWith(
    FormulaireSeuilView.dom(
      { valeur: M.seuilSaisi, erreur: M.erreurSeuil, envoiEnCours: M.envoiEnCours },
      { surEnvoi: C.handler_seuil }
    )
  );

  return pageFragment;
};

export function AdminProduitsPage() {
  return C.init();
}
