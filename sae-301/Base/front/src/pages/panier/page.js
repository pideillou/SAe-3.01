import { PanierData } from "../../data/panier.js";
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
 * Le panier vient du stockage local du navigateur (data/panier.js) : aucun
 * appel à l'API ici.
 */

let M = {
  lignes: [], // les lignes du panier
  message: null, // { type, texte }, ou null
};

let C = {};

C.charger = function () {
  M.lignes = PanierData.lignes();
};

C.init = function () {
  C.charger();
  M.message = null;
  definirMetadonnees({ titre: "Panier" });
  return V.init();
};

C.handler_quantite = function (varianteId, quantite) {
  let resultat = PanierData.changerQuantite(varianteId, quantite);

  C.charger();
  M.message = resultat.ok ? null : { type: "erreur", texte: resultat.raison };
  V.rafraichir();

  // La page est reconstruite : le focus est rendu au champ modifié.
  V.racine.querySelector(`#quantite-${varianteId}`)?.focus();
};

C.handler_suppression = function (varianteId) {
  PanierData.supprimer(varianteId);

  C.charger();
  M.message = { type: "succes", texte: "L'article a été retiré de votre panier." };
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
  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

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
