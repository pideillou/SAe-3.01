import { ProduitData } from "../../data/produit.js";
import { decouperDescription, formaterPrix, pluriel } from "../../lib/format.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { valeurDisponible, varianteApresChoix, varianteInitiale } from "../../lib/variantes.js";
import { BadgeStockView } from "../../ui/badge-stock/index.js";
import { DescriptionProduitView } from "../../ui/description-produit/index.js";
import { FilArianeView } from "../../ui/fil-ariane/index.js";
import { GalerieProduitView } from "../../ui/galerie-produit/index.js";
import { MessageView } from "../../ui/message/index.js";
import { SelecteurOptionsView } from "../../ui/selecteur-options/index.js";
import { The404Page } from "../404/page.js";
import template from "./template.html?raw";

/**
 * Page « Fiche produit » (DEC-c), à l'adresse /produit/slug : galerie
 * d'images, nom, description, choix des options avec le prix et le stock de
 * la variante obtenue, et retour vers la catégorie.
 *
 * Le bouton « Ajouter au panier » est présent mais ne fait encore rien : le
 * panier est une user story à part (CMD-b).
 */

let M = {
  produit: null, // la fiche renvoyée par l'API, ou null
  variante: null, // la variante choisie (prix, stock, valeurs d'options)
  index: 0, // indice de l'image affichée dans la galerie
  message: null, // { type, texte }, ou null
};

let C = {};

C.charger = async function (slug) {
  M.produit = null;
  M.variante = null;
  M.index = 0;
  M.message = null;

  try {
    M.produit = (await ProduitData.fetchOne(slug)).produit;
    M.variante = varianteInitiale(M.produit.variantes);
  } catch (erreur) {
    // Un produit inconnu est une adresse inconnue : page 404, et non un
    // message d'erreur dans la page.
    if (erreur.statut === 404) {
      return false;
    }

    M.produit = null;
    M.message = { type: "erreur", texte: `Impossible de charger le produit : ${erreur.message}` };
  }

  return true;
};

C.handler_choisirImage = function (index) {
  M.index = index;
  V.rafraichir();

  // La page est reconstruite : le focus, lui, est rendu à la miniature choisie,
  // pour que la navigation au clavier ne reparte pas du début de la page.
  V.racine.querySelector(`button[data-index="${index}"]`)?.focus();
};

C.handler_choisirValeur = function (valeurId) {
  let variante = varianteApresChoix(M.produit.variantes, valeurId, M.variante.valeurs);

  if (variante !== null) {
    M.variante = variante;
    M.index = 0; // l'image de la variante est la première de la galerie
  }

  V.rafraichir();
  V.racine.querySelector(`button[data-valeur="${valeurId}"]`)?.focus();
};

/**
 * Les images de la galerie pour la variante choisie : son image propre
 * (couleur, taille…) remplace l'image principale du produit.
 */
C.images = function () {
  let images = M.produit.images;

  if (M.variante !== null && M.variante.image !== null) {
    return [M.variante.image, ...images.slice(1)];
  }

  return images;
};

C.init = async function (params) {
  let trouve = await C.charger(params.slug);

  if (!trouve) {
    return The404Page();
  }

  if (M.produit === null) {
    definirMetadonnees({ titre: "Produit indisponible" });
  } else {
    definirMetadonnees({
      titre: M.produit.nom,
      description: M.produit.accroche ?? undefined,
      // Adresse complète du fichier (avec le chemin du projet).
      image: M.produit.images.length === 0 ? undefined : urlPublique(M.produit.images[0].grand),
    });
  }

  return V.init();
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
 * La phrase sous les options : le stock de la variante choisie, et le prix qui
 * dépend des options quand les variantes n'ont pas toutes le même prix.
 */
V.noteStock = function (produit, variante) {
  let phrases = [];

  if (new Set(produit.variantes.map((v) => v.prix)).size > 1) {
    phrases.push("Le prix dépend des options sélectionnées.");
  }

  if (variante.etat === "epuise") {
    phrases.push("Cette variante est épuisée.");
  } else if (variante.etat === "bientot-epuise") {
    phrases.push(`Plus que ${pluriel(variante.stock, "unité")} en stock.`);
  } else {
    phrases.push(`${pluriel(variante.stock, "unité")} en stock.`);
  }

  return phrases.join(" ");
};

/**
 * Les cartes d'une option : pour chaque valeur, la variante qu'on obtiendrait
 * en la choisissant (avec ses autres choix conservés autant que possible).
 */
V.cartes = function (produit, option) {
  return option.valeurs.map((valeur) => {
    let selectionnee = M.variante.valeurs.includes(valeur.id);
    let variante = selectionnee
      ? M.variante
      : varianteApresChoix(produit.variantes, valeur.id, M.variante.valeurs);

    let etat = "disponible";
    if (selectionnee) {
      etat = "selectionne";
    } else if (!valeurDisponible(produit.variantes, valeur.id)) {
      etat = "indisponible";
    }

    return {
      valeurId: valeur.id,
      libelle: valeur.valeur,
      prix: variante === null ? "" : formaterPrix(variante.prix),
      etat,
    };
  });
};

V.createPageFragment = function () {
  let produit = M.produit;

  // Les adresses sont complètes (avec le chemin du projet) : la page est
  // reconstruite à chaque choix, et le routeur ne complète les liens qu'à
  // l'affichage de la page.
  let vide = {
    nom: "", accroche: "", description: "", categorie: { nom: "", slug: "" },
  };
  let fiche = produit ?? vide;
  let { introduction, blocs } = decouperDescription(fiche.description);

  let pageFragment = htmlToFragment(
    genericRenderer(template, {
      cheminRetour: urlPublique(`categorie/${fiche.categorie.slug}`),
      libelleRetour: `Retour aux ${fiche.categorie.nom.toLowerCase()}`,
      accroche: fiche.accroche ?? "",
      nom: fiche.nom,
      introduction,
      prix: produit === null || M.variante === null ? "" : formaterPrix(M.variante.prix),
      noteStock: produit === null || M.variante === null ? "" : V.noteStock(produit, M.variante),
    })
  );

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  if (produit === null) {
    // Rien à afficher : on ne garde que le message.
    pageFragment.querySelector("[data-fiche]").remove();
    return pageFragment;
  }

  pageFragment.querySelector('slot[name="fil-ariane"]').replaceWith(
    FilArianeView.dom([
      { libelle: "Catalogue", chemin: urlPublique("") },
      { libelle: produit.categorie.nom, chemin: urlPublique(`categorie/${produit.categorie.slug}`) },
      { libelle: produit.nom },
    ])
  );

  // Galerie
  let images = C.images();
  let slotGalerie = pageFragment.querySelector('slot[name="galerie"]');

  if (images.length === 0) {
    slotGalerie.remove();
  } else {
    slotGalerie.replaceWith(
      GalerieProduitView.dom(
        { images, index: Math.min(M.index, images.length - 1) },
        { surImage: C.handler_choisirImage }
      )
    );
  }

  // Stock, options et bouton : ils dépendent de la variante choisie.
  let slotStock = pageFragment.querySelector('slot[name="stock"]');
  let slotOptions = pageFragment.querySelector('slot[name="options"]');
  let bouton = pageFragment.querySelector('[data-action="ajouter-panier"]');

  if (M.variante === null) {
    // Produit sans variante : rien à choisir, rien à commander.
    slotStock.remove();
    slotOptions.remove();
    pageFragment.querySelector("[data-note-stock]").remove();
    bouton.disabled = true;
  } else {
    slotStock.replaceWith(BadgeStockView.dom(M.variante.etat));

    let groupes = produit.options
      .filter((option) => option.valeurs.length > 1)
      .map((option) =>
        SelecteurOptionsView.dom(
          { titre: option.nom, cartes: V.cartes(produit, option) },
          { surChoix: C.handler_choisirValeur }
        )
      );
    slotOptions.replaceWith(...groupes);

    // Un produit épuisé ne se met pas au panier. (L'ajout lui-même : CMD-b.)
    bouton.disabled = M.variante.stock === 0;
  }

  // Détails
  let slotDetails = pageFragment.querySelector('slot[name="details"]');

  if (blocs.length === 0 && produit.caracteristiques.length === 0) {
    slotDetails.remove();
  } else {
    slotDetails.replaceWith(DescriptionProduitView.dom(blocs, produit.caracteristiques));
  }

  return pageFragment;
};

export function ProduitPage(params = {}) {
  return C.init(params);
}
