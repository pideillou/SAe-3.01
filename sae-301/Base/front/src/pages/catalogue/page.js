import { CategorieData } from "../../data/categorie.js";
import { ProduitData } from "../../data/produit.js";
import { pluriel } from "../../lib/format.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { FilArianeView } from "../../ui/fil-ariane/index.js";
import { GrilleProduitsView } from "../../ui/grille-produits/index.js";
import { MessageView } from "../../ui/message/index.js";
import { NavigationCategoriesView } from "../../ui/navigation-categories/index.js";
import { SectionCategorieView } from "../../ui/section-categorie/index.js";
import { The404Page } from "../404/page.js";
import template from "./template.html?raw";

/**
 * Page « Catalogue » : DEC-b (tous les produits, regroupés par catégorie) et
 * DEC-a (un seul rayon, à l'adresse /categorie/slug).
 *
 * Une seule page pour les deux adresses : sans paramètre de route elle affiche
 * tout le catalogue, avec « slug » elle n'affiche que cette catégorie.
 */

// Nombre de cartes dont l'image est chargée immédiatement : la première rangée
// sur ordinateur, les deux premières sur mobile. Les autres attendent le
// défilement.
const CARTES_PRIORITAIRES = 4;

let M = {
  navigation: null, // { categories: [{ nom, slug, nombre }], total } pour le menu
  categorie: null, // { nom, slug } de la catégorie affichée, ou null pour tout
  rayons: null, // [{ nom, slug, produits: [...] }], dans l'ordre de l'API
  total: 0, // nombre de produits affichés
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Regroupe les produits par catégorie, en gardant l'ordre fourni par l'API
 * (catégories déjà triées côté serveur).
 */
C.grouperParCategorie = function (produits) {
  let rayons = [];

  for (let produit of produits) {
    let dernier = rayons.at(-1);

    if (dernier === undefined || dernier.slug !== produit.categorie.slug) {
      dernier = { nom: produit.categorie.nom, slug: produit.categorie.slug, produits: [] };
      rayons.push(dernier);
    }

    dernier.produits.push(produit);
  }

  return rayons;
};

/**
 * Charge le menu et les produits en parallèle : les deux requêtes sont
 * indépendantes, la page n'attend que la plus lente.
 */
C.charger = async function (slug) {
  M.navigation = null;
  M.categorie = null;
  M.rayons = null;
  M.total = 0;
  M.message = null;

  try {
    let [navigation, catalogue] = await Promise.all([
      CategorieData.fetchAll(),
      ProduitData.fetchAll(slug),
    ]);

    M.navigation = navigation;
    M.categorie = catalogue.categorie;
    M.rayons = C.grouperParCategorie(catalogue.produits);
    M.total = catalogue.total;
  } catch (erreur) {
    // Une catégorie inconnue est une adresse inconnue : page 404, et non un
    // message d'erreur dans la page.
    if (erreur.statut === 404) {
      return false;
    }

    M.message = { type: "erreur", texte: `Impossible de charger le catalogue : ${erreur.message}` };
  }

  return true;
};

C.init = async function (params) {
  let trouvee = await C.charger(params.slug);

  if (!trouvee) {
    return The404Page();
  }

  definirMetadonnees({ titre: M.categorie === null ? undefined : M.categorie.nom });

  return V.init();
};

let V = {};

V.init = function () {
  return V.createPageFragment();
};

/**
 * Fil d'Ariane : « Catalogue / Tous les produits » ou « Catalogue / Claviers ».
 */
V.filAriane = function () {
  if (M.categorie === null) {
    return [{ libelle: "Catalogue" }, { libelle: "Tous les produits" }];
  }

  return [{ libelle: "Catalogue", chemin: "/" }, { libelle: M.categorie.nom }];
};

V.createPageFragment = function () {
  let enErreur = M.rayons === null;

  let titre = M.categorie === null ? "Tous les produits" : M.categorie.nom;
  let resume = "";

  if (!enErreur) {
    resume =
      M.categorie === null
        ? `${pluriel(M.total, "périphérique")} • ${pluriel(M.navigation.categories.length, "catégorie")} • Retrait en magasin`
        : `${pluriel(M.total, "périphérique")} • Retrait en magasin`;
  }

  let pageFragment = htmlToFragment(genericRenderer(template, { titre, resume }));

  pageFragment.querySelector('slot[name="fil-ariane"]').replaceWith(FilArianeView.dom(V.filAriane()));
  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  if (enErreur) {
    // Rien à afficher : on retire le résumé et les emplacements restants.
    pageFragment.querySelector("[data-resume]").remove();
    for (let slot of pageFragment.querySelectorAll("slot")) {
      slot.remove();
    }
    return pageFragment;
  }

  pageFragment
    .querySelector('slot[name="bandeau"]')
    .replaceWith(NavigationCategoriesView.dom(M.navigation, "bandeau"));
  pageFragment
    .querySelector('slot[name="pastilles"]')
    .replaceWith(NavigationCategoriesView.dom(M.navigation, "pastilles"));

  let slotContenu = pageFragment.querySelector('slot[name="contenu"]');

  if (M.rayons.length === 0) {
    slotContenu.replaceWith(GrilleProduitsView.dom([]));
  } else if (M.categorie === null) {
    // Tout le catalogue : un rayon par catégorie.
    let sections = M.rayons.map((rayon, i) =>
      SectionCategorieView.dom(rayon, i === 0 ? CARTES_PRIORITAIRES : 0)
    );
    slotContenu.replaceWith(...sections);
  } else {
    // Une catégorie : le titre de la page est déjà son nom, la grille suffit.
    // Un titre de niveau 2, visible seulement des lecteurs d'écran, évite de
    // passer du h1 aux h3 des cartes sans niveau intermédiaire.
    slotContenu.replaceWith(
      htmlToFragment('<h2 class="sr-only">Produits</h2>'),
      GrilleProduitsView.dom(M.rayons[0].produits, CARTES_PRIORITAIRES)
    );
  }

  return pageFragment;
};

export function CataloguePage(params = {}) {
  return C.init(params);
}
