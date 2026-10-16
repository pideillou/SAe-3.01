import { PanierData } from "../../data/panier.js";
import { synchroniserPanier } from "../../lib/panier-stock.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
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
 * Le panier vient du stockage local du navigateur (data/panier.js). À
 * l'ouverture et après chaque changement de quantité, il est confronté au
 * stock réel (STK-c) : les quantités sont ramenées au stock, les articles
 * épuisés retirés, et chaque changement est expliqué au visiteur.
 */

let M = {
  lignes: [], // les lignes du panier
  messages: [], // [{ type, texte }] affichés en haut de page
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

C.handler_suppression = function (varianteId) {
  PanierData.supprimer(varianteId);

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

  let actions = { surQuantite: C.handler_quantite, surSuppression: C.handler_suppression };
  let lignes = M.lignes.map((ligne) => LignePanierView.dom(ligne, PanierData.totalLigne(ligne), actions));
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
