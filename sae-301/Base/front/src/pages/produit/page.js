import { PanierData } from "../../data/panier.js";
import { ProduitData } from "../../data/produit.js";
import { decouperDescription, formaterPrix, pluriel } from "../../lib/format.js";
import { ajouterAuPanier } from "../../lib/panier-stock.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { cartesOption, varianteApresChoix, varianteInitiale } from "../../lib/variantes.js";
import { BadgeStockView } from "../../ui/badge-stock/index.js";
import { DescriptionProduitView } from "../../ui/description-produit/index.js";
import { FilArianeView } from "../../ui/fil-ariane/index.js";
import { GalerieProduitView } from "../../ui/galerie-produit/index.js";
import { MessageView } from "../../ui/message/index.js";
import { NotificationView } from "../../ui/notification/index.js";
import { PrixPromotionView } from "../../ui/prix-promotion/index.js";
import { SelecteurOptionsView } from "../../ui/selecteur-options/index.js";
import { The404Page } from "../404/page.js";
import template from "./template.html?raw";

/**
 * Page « Fiche produit » (DEC-c), à l'adresse /produit/slug : galerie
 * d'images, nom, description, choix des options avec le prix et le stock de
 * la variante obtenue, et retour vers la catégorie.
 *
 * Le bouton « Ajouter au panier » met la variante choisie dans le panier (CMD-b).
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

C.handler_ajouter = async function () {
  let resultat = await ajouterAuPanier(PanierData.articleDepuis(M.produit, M.variante));

  V.notifier(
    resultat.ok
      ? { type: "succes", texte: `${M.variante.nom} a été ajouté à votre panier.` }
      : { type: "erreur", texte: resultat.raison }
  );
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
 * Affiche un message au bas de l'écran, à la place du précédent, sans
 * reconstruire la page (le visiteur garde sa position et ses choix).
 */
V.notifier = function (message) {
  V.racine.querySelector("[data-notification]").replaceChildren(NotificationView.dom(message));
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

  // Prix de la variante choisie, avec la promotion automatique s'il y en a une
  // (PRO-c : ancien prix barré et pourcentage).
  pageFragment.querySelector('slot[name="prix"]').replaceWith(
    M.variante === null
      ? ""
      : PrixPromotionView.dom({ prix: M.variante.prix, prixBarre: M.variante.prixBarre, promotion: produit.promotion })
  );

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
    bouton.textContent = "Indisponible";
  } else {
    slotStock.replaceWith(BadgeStockView.dom(M.variante.etat));

    let groupes = produit.options
      .filter((option) => option.valeurs.length > 1)
      .map((option) =>
        SelecteurOptionsView.dom(
          { titre: option.nom, cartes: cartesOption(produit, option, M.variante) },
          { surChoix: C.handler_choisirValeur }
        )
      );
    slotOptions.replaceWith(...groupes);

    // Un produit épuisé ne se met pas au panier.
    if (M.variante.stock === 0) {
      bouton.disabled = true;
      bouton.textContent = "Épuisé";
    }
    bouton.addEventListener("click", C.handler_ajouter);
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
