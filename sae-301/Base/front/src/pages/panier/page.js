import { PanierData } from "../../data/panier.js";
import { ProduitData } from "../../data/produit.js";
import { formaterPrix, pluriel } from "../../lib/format.js";
import { synchroniserPanier } from "../../lib/panier-stock.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { cartesOption, varianteApresChoix } from "../../lib/variantes.js";
import { EditionOptionsPanierView } from "../../ui/edition-options-panier/index.js";
import { FilArianeView } from "../../ui/fil-ariane/index.js";
import { LignePanierView } from "../../ui/ligne-panier/index.js";
import { MessageView } from "../../ui/message/index.js";
import { ResumePanierView } from "../../ui/resume-panier/index.js";
import template from "./template.html?raw";

/**
 * Page « Panier » (CMD-b), à l'adresse /panier : les articles choisis, leurs
 * quantités modifiables, la suppression d'une ligne et le total, recalculé à
 * chaque modification.
 *
 * Les options d'un article se modifient dans la page (OPT-a) : un panneau
 * s'ouvre sous la ligne avec les mêmes choix que la fiche produit.
 *
 * Le panier vient du stockage local du navigateur (data/panier.js). À
 * l'ouverture et après chaque changement de quantité, il est confronté au
 * stock réel (STK-c) : les quantités sont ramenées au stock, les articles
 * épuisés retirés, et chaque changement est expliqué au visiteur.
 */

let M = {
  lignes: [], // les lignes du panier
  messages: [], // [{ type, texte }] affichés en haut de page
  edition: null, // { varianteId, produit, variante } : la ligne dont on modifie les options
};

let C = {};

C.charger = function () {
  M.lignes = PanierData.lignes();
};

/**
 * Confronte le panier au stock réel et retient les messages à afficher. Si le
 * serveur ne répond pas, le panier reste tel quel et le visiteur en est averti.
 */
C.synchroniser = async function () {
  try {
    let messages = await synchroniserPanier();
    C.charger();
    return messages.map((texte) => ({ type: "erreur", texte }));
  } catch (erreur) {
    return [{ type: "erreur", texte: `Le stock n'a pas pu être vérifié : ${erreur.message}` }];
  }
};

C.init = async function () {
  definirMetadonnees({ titre: "Panier" });
  M.edition = null;
  C.charger();
  M.messages = await C.synchroniser();
  return V.init();
};

C.handler_quantite = async function (varianteId, quantite) {
  let resultat = PanierData.changerQuantite(varianteId, quantite);

  // Réponse immédiate : le total est recalculé avec le contrôle local, puis le
  // serveur confirme ou corrige.
  C.charger();
  M.messages = resultat.ok ? [] : [{ type: "erreur", texte: resultat.raison }];
  V.rafraichir();
  V.racine.querySelector(`#quantite-${varianteId}`)?.focus();

  let corrections = await C.synchroniser();

  if (corrections.length > 0) {
    M.messages = [...M.messages, ...corrections];
    V.rafraichir();
    V.racine.querySelector(`#quantite-${varianteId}`)?.focus();
  }
};

/**
 * Ouvre (ou ferme, si elle l'est déjà) la modification des options d'une
 * ligne. Les options viennent de la fiche du produit.
 */
C.handler_modifier = async function (varianteId) {
  if (M.edition !== null && M.edition.varianteId === varianteId) {
    C.fermerEdition(varianteId);
    return;
  }

  let ligne = M.lignes.find((l) => l.varianteId === varianteId);

  try {
    let produit = (await ProduitData.fetchOne(ligne.produitSlug)).produit;
    let variante = produit.variantes.find((v) => v.id === varianteId);

    if (variante === undefined) {
      throw new Error("cette variante n'existe plus");
    }

    M.edition = { varianteId, produit, variante };
    M.messages = [];
  } catch (erreur) {
    M.edition = null;
    M.messages = [{ type: "erreur", texte: `Impossible de modifier les options : ${erreur.message}` }];
  }

  V.rafraichir();
  V.racine.querySelector('[data-valeur]')?.focus();
};

C.fermerEdition = function (varianteId) {
  M.edition = null;
  V.rafraichir();
  V.racine.querySelector(`[data-action="modifier"][data-variante="${varianteId}"]`)?.focus();
};

C.handler_choisirValeur = function (valeurId) {
  let variante = varianteApresChoix(M.edition.produit.variantes, valeurId, M.edition.variante.valeurs);

  if (variante !== null) {
    M.edition.variante = variante;
  }

  V.rafraichir();
  V.racine.querySelector(`button[data-valeur="${valeurId}"]`)?.focus();
};

C.handler_validerOptions = async function () {
  let { varianteId, produit, variante } = M.edition;
  let resultat = PanierData.changerVariante(varianteId, PanierData.articleDepuis(produit, variante));

  M.edition = null;
  C.charger();

  if (!resultat.ok) {
    M.messages = [{ type: "erreur", texte: resultat.raison }];
  } else if (varianteId === variante.id) {
    M.messages = [];
  } else {
    M.messages = [{ type: "succes", texte: `Les options de ${produit.nom} ont été modifiées.` }];
  }

  V.rafraichir();
  V.racine.querySelector(`#quantite-${variante.id}`)?.focus();

  let corrections = await C.synchroniser();

  if (corrections.length > 0) {
    M.messages = [...M.messages, ...corrections];
    V.rafraichir();
  }
};

C.handler_suppression = function (varianteId) {
  PanierData.supprimer(varianteId);
  M.edition = null;

  C.charger();
  M.messages = [{ type: "succes", texte: "L'article a été retiré de votre panier." }];
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

/**
 * Le panneau de modification des options, pour la ligne qui est en cours de
 * modification (null pour les autres).
 */
V.edition = function (ligne) {
  if (M.edition === null || M.edition.varianteId !== ligne.varianteId) {
    return null;
  }

  let { produit, variante } = M.edition;
  let groupes = produit.options
    .filter((option) => option.valeurs.length > 1)
    .map((option) => ({ titre: option.nom, cartes: cartesOption(produit, option, variante) }));

  let note;
  if (groupes.length === 0) {
    note = "Ce produit n'a pas d'autre option à choisir.";
  } else if (variante.stock === 0) {
    note = "Cette variante est épuisée.";
  } else {
    note = `${formaterPrix(variante.prix)} l'unité, ${pluriel(variante.stock, "unité")} en stock.`;
  }

  return EditionOptionsPanierView.dom(
    { varianteId: ligne.varianteId, note, valideDesactive: variante.stock === 0, groupes },
    {
      surChoix: C.handler_choisirValeur,
      surValidation: C.handler_validerOptions,
      surAnnulation: () => C.fermerEdition(ligne.varianteId),
    }
  );
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(genericRenderer(template, { cheminCatalogue: urlPublique("") }));

  pageFragment.querySelector('slot[name="fil-ariane"]').replaceWith(
    FilArianeView.dom([{ libelle: "Catalogue", chemin: urlPublique("") }, { libelle: "Panier" }])
  );
  pageFragment
    .querySelector('slot[name="message"]')
    .replaceWith(...M.messages.map((message) => MessageView.dom(message)));

  if (M.lignes.length === 0) {
    pageFragment.querySelector("[data-contenu]").remove();
    return pageFragment;
  }

  pageFragment.querySelector("[data-vide]").remove();

  let actions = {
    surQuantite: C.handler_quantite,
    surModification: C.handler_modifier,
    surSuppression: C.handler_suppression,
  };
  let lignes = M.lignes.map((ligne) =>
    LignePanierView.dom(ligne, PanierData.totalLigne(ligne), actions, V.edition(ligne))
  );
  pageFragment.querySelector('slot[name="lignes"]').replaceWith(...lignes);

  pageFragment.querySelector('slot[name="resume"]').replaceWith(
    ResumePanierView.dom({
      articles: M.lignes.reduce((somme, ligne) => somme + ligne.quantite, 0),
      total: PanierData.total(),
    })
  );

  return pageFragment;
};

export function PanierPage() {
  return C.init();
}
