import { ProduitData } from "../../data/produit.js";
import { pluriel } from "../../lib/format.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { GrilleProduitsView } from "../../ui/grille-produits/index.js";
import { MessageView } from "../../ui/message/index.js";
import { SectionCategorieView } from "../../ui/section-categorie/index.js";
import template from "./template.html?raw";

/**
 * Page « Catalogue » (DEC-b) : tous les produits, regroupés par catégorie,
 * avec pour chacun son nom, son prix et son image principale.
 */

// Nombre de cartes dont l'image est chargée immédiatement : la première rangée
// sur ordinateur, les deux premières sur mobile. Les autres attendent le
// défilement.
const CARTES_PRIORITAIRES = 4;

let M = {
  categories: null, // [{ nom, slug, produits: [...] }], dans l'ordre de l'API
  total: 0, // nombre de produits
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Regroupe les produits par catégorie, en gardant l'ordre fourni par l'API
 * (catégories déjà triées côté serveur).
 */
C.grouperParCategorie = function (produits) {
  let categories = [];

  for (let produit of produits) {
    let derniere = categories.at(-1);

    if (derniere === undefined || derniere.slug !== produit.categorie.slug) {
      derniere = { nom: produit.categorie.nom, slug: produit.categorie.slug, produits: [] };
      categories.push(derniere);
    }

    derniere.produits.push(produit);
  }

  return categories;
};

C.charger = async function () {
  try {
    let reponse = await ProduitData.fetchAll();
    M.categories = C.grouperParCategorie(reponse.produits);
    M.total = reponse.total;
    M.message = null;
  } catch (erreur) {
    M.categories = null;
    M.message = { type: "erreur", texte: `Impossible de charger le catalogue : ${erreur.message}` };
  }
};

C.init = async function () {
  await C.charger();
  return V.init();
};

let V = {};

V.init = function () {
  return V.createPageFragment();
};

V.createPageFragment = function () {
  let resume = "";

  if (M.categories !== null) {
    resume = `${pluriel(M.total, "périphérique")} • ${pluriel(M.categories.length, "catégorie")} • Retrait en magasin`;
  }

  let pageFragment = htmlToFragment(genericRenderer(template, { resume }));

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  if (M.categories === null) {
    // Rien à afficher : on retire le résumé et l'emplacement des catégories.
    pageFragment.querySelector("[data-resume]").remove();
    pageFragment.querySelector('slot[name="categories"]').remove();
    return pageFragment;
  }

  let slotCategories = pageFragment.querySelector('slot[name="categories"]');

  if (M.categories.length === 0) {
    slotCategories.replaceWith(GrilleProduitsView.dom([]));
    return pageFragment;
  }

  let sections = M.categories.map((categorie, i) =>
    SectionCategorieView.dom(categorie, i === 0 ? CARTES_PRIORITAIRES : 0)
  );
  slotCategories.replaceWith(...sections);

  return pageFragment;
};

export function CataloguePage() {
  return C.init();
}
