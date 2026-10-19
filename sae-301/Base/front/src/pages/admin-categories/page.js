import { AdminAuthData } from "../../data/admin-auth.js";
import { AdminCategorieData } from "../../data/admin-categorie.js";
import { pluriel } from "../../lib/format.js";
import { naviguer } from "../../lib/navigation.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { erreursCategorie } from "../../lib/validation-categorie.js";
import { ConfirmationSuppressionView } from "../../ui/confirmation-suppression/index.js";
import { FormulaireCategorieView } from "../../ui/formulaire-categorie/index.js";
import { MessageView } from "../../ui/message/index.js";
import { TableauCategoriesView } from "../../ui/tableau-categories/index.js";
import template from "./template.html?raw";

/**
 * Page « Catégories » du back-office (GOF-c), à l'adresse /admin/categories :
 * liste, création, modification et suppression des catégories.
 *
 * Règle pour les produits d'une catégorie supprimée : la suppression est
 * bloquée tant que la catégorie en contient. Toute suppression passe par une
 * confirmation. Réservée aux administrateurs : le serveur refuse sans session
 * administrateur (401), et la page renvoie alors vers /admin/connexion.
 */

let M = {
  categories: [], // les catégories renvoyées par l'API
  ordreSuivant: 1, // ordre proposé à la prochaine catégorie créée
  enEdition: null, // la catégorie en cours de modification, ou null (création)
  aSupprimer: null, // la catégorie dont on demande la confirmation de suppression, ou null
  valeurs: { nom: "", description: "", ordre: "" }, // saisies du formulaire
  erreurs: {}, // un message par champ fautif
  message: null, // { type, texte }, ou null
  envoiEnCours: false,
};

let C = {};

C.valeursVides = function () {
  return { nom: "", description: "", ordre: String(M.ordreSuivant) };
};

C.charger = async function () {
  let reponse = await AdminCategorieData.fetchAll();
  M.categories = reponse.categories;
  M.ordreSuivant = reponse.ordreSuivant;
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

  M.erreurs = erreur.champs ?? {};
  M.message = { type: "erreur", texte: Object.keys(M.erreurs).length > 0 ? erreur.message : `${prefixe} ${erreur.message}` };
  return false;
};

C.init = async function () {
  definirMetadonnees({ titre: "Catégories - Back-office" });
  M.enEdition = null;
  M.aSupprimer = null;
  M.erreurs = {};
  M.message = null;
  M.envoiEnCours = false;

  try {
    if (!(await AdminAuthData.moi()).connecte) {
      naviguer("admin/connexion");
      return "";
    }

    await C.charger();
  } catch (erreur) {
    if (C.traiterErreur(erreur, "Impossible de charger les catégories :")) {
      return "";
    }
  }

  M.valeurs = C.valeursVides();
  return V.init();
};

C.handler_envoi = async function (valeurs) {
  M.valeurs = valeurs;
  M.message = null;
  M.erreurs = erreursCategorie(valeurs);

  if (Object.keys(M.erreurs).length > 0) {
    V.rafraichir();
    return;
  }

  M.envoiEnCours = true;
  V.rafraichir();

  let donnees = {
    nom: valeurs.nom,
    description: valeurs.description,
    ordre: valeurs.ordre === "" ? null : Number(valeurs.ordre),
  };

  try {
    let { categorie } =
      M.enEdition === null
        ? await AdminCategorieData.creer(donnees)
        : await AdminCategorieData.modifier(M.enEdition.id, donnees);

    M.message = {
      type: "succes",
      texte: `La catégorie « ${categorie.nom} » a été ${M.enEdition === null ? "créée" : "modifiée"}.`,
    };
    M.enEdition = null;
    M.erreurs = {};
    await C.charger();
    M.valeurs = C.valeursVides();
  } catch (erreur) {
    if (C.traiterErreur(erreur, "Enregistrement impossible :")) {
      return;
    }
  }

  M.envoiEnCours = false;
  V.rafraichir();
};

C.handler_modification = function (categorie) {
  M.enEdition = categorie;
  M.aSupprimer = null;
  M.erreurs = {};
  M.message = null;
  M.valeurs = { nom: categorie.nom, description: categorie.description ?? "", ordre: String(categorie.ordre) };
  V.rafraichir();
  V.racine.querySelector("#categorie-nom")?.focus();
};

C.handler_annulation_formulaire = function () {
  M.enEdition = null;
  M.erreurs = {};
  M.message = null;
  M.valeurs = C.valeursVides();
  V.rafraichir();
};

C.handler_suppression = function (categorie) {
  M.aSupprimer = categorie;
  M.message = null;
  V.rafraichir();
  V.racine.querySelector('[data-action="annuler"]')?.focus();
};

C.handler_annulation_suppression = function () {
  M.aSupprimer = null;
  V.rafraichir();
};

C.handler_confirmation_suppression = async function () {
  let categorie = M.aSupprimer;

  M.envoiEnCours = true;
  V.rafraichir();

  try {
    await AdminCategorieData.supprimer(categorie.id);

    if (M.enEdition !== null && M.enEdition.id === categorie.id) {
      M.enEdition = null;
      M.valeurs = C.valeursVides();
    }

    M.message = { type: "succes", texte: `La catégorie « ${categorie.nom} » a été supprimée.` };
    await C.charger();
  } catch (erreur) {
    if (C.traiterErreur(erreur, "Suppression impossible :")) {
      return;
    }
    // Le serveur a pu refuser parce que la catégorie a gagné des produits : la liste est relue.
    try {
      await C.charger();
    } catch (autre) {
      // La liste affichée reste celle d'avant.
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

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(
    genericRenderer(template, { resume: pluriel(M.categories.length, "catégorie") })
  );

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slotConfirmation = pageFragment.querySelector('slot[name="confirmation"]');
  if (M.aSupprimer === null) {
    slotConfirmation.remove();
  } else {
    slotConfirmation.replaceWith(
      ConfirmationSuppressionView.dom(
        {
          titre: "Supprimer cette catégorie ?",
          texte: `La catégorie « ${M.aSupprimer.nom} » sera supprimée définitivement. Cette action est irréversible.`,
          envoiEnCours: M.envoiEnCours,
        },
        { surConfirmation: C.handler_confirmation_suppression, surAnnulation: C.handler_annulation_suppression }
      )
    );
  }

  let slotTableau = pageFragment.querySelector('slot[name="tableau"]');
  if (M.categories.length === 0) {
    slotTableau.replaceWith(htmlToFragment('<p class="border border-bordure bg-surface p-6 text-sm text-texte-secondaire">Aucune catégorie pour le moment.</p>'));
  } else {
    slotTableau.replaceWith(
      TableauCategoriesView.dom(M.categories, {
        surModification: C.handler_modification,
        surSuppression: C.handler_suppression,
      })
    );
  }

  pageFragment.querySelector('slot[name="formulaire"]').replaceWith(
    FormulaireCategorieView.dom(
      { enEdition: M.enEdition !== null, valeurs: M.valeurs, erreurs: M.erreurs, envoiEnCours: M.envoiEnCours },
      { surEnvoi: C.handler_envoi, surAnnulation: C.handler_annulation_formulaire }
    )
  );

  return pageFragment;
};

export function AdminCategoriesPage() {
  return C.init();
}
