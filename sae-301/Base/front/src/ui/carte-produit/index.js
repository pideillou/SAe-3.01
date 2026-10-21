import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { BadgeStockView } from "../badge-stock/index.js";
import { PrixPromotionView } from "../prix-promotion/index.js";
import fleche from "../../assets/fleche.svg";
import template from "./template.html?raw";

// Carte d'un produit, tel que le renvoie l'API :
// { nom, slug, prix, prixBarre, promotion, etat, image: { moyen } | null } ; la carte
// est un lien vers la fiche. Un produit en promotion automatique (PRO-c) montre son
// prix réduit, l'ancien prix barré et le pourcentage.
// « etat » est l'état de stock du produit (STK-b) : le badge le montre, et un
// produit épuisé est grisé et ne peut plus être ajouté au panier.
let CarteProduitView = {
  html: function (produit) {
    // Les valeurs sont mises en forme avant d'être passées au template.
    return genericRenderer(template, {
      nom: produit.nom,
      // L'image principale est un original carré de 500 px : assez net pour
      // une carte, même sur un écran haute densité. Un produit créé dans le
      // back-office n'a pas forcément d'image : voir dom().
      image: produit.image === null ? "" : urlPublique(produit.image.moyen),
      chemin: `/produit/${produit.slug}`,
      fleche: fleche,
    });
  },

  /**
   * @param {object}  produit
   * @param {boolean} prioritaire  true pour les cartes visibles dès l'ouverture
   *                               de la page : leur image n'est pas différée.
   * @param {{surAjout: (produit: object) => void}} actions  signale le clic sur
   *        « Ajouter au panier » ; la carte ne sait pas ce qu'on en fait.
   */
  dom: function (produit, prioritaire = false, actions = {}) {
    let fragment = htmlToFragment(CarteProduitView.html(produit));

    // Un template n'a pas de condition : le chargement différé se règle ici.
    // Les images hors de l'écran ne sont téléchargées qu'à l'approche du
    // défilement, ce qui garde le catalogue sous les 3 secondes.
    let image = fragment.querySelector("img");
    image.loading = prioritaire ? "eager" : "lazy";

    // Produit sans image : un cadre neutre garde la grille alignée.
    if (produit.image === null) {
      let cadre = document.createElement("div");
      cadre.className = "aspect-photo w-full bg-surface-haute";
      cadre.setAttribute("aria-hidden", "true");
      image.replaceWith(cadre);
      image = cadre;
    }

    fragment.querySelector('slot[name="stock"]').replaceWith(BadgeStockView.dom(produit.etat));
    fragment.querySelector('slot[name="prix"]').replaceWith(PrixPromotionView.dom(produit));

    let bouton = fragment.querySelector('[data-action="ajouter-panier"]');

    if (produit.etat === "epuise") {
      // Un template n'a pas de condition : l'état épuisé se règle ici. Les
      // classes sont écrites en entier pour que Tailwind les génère.
      image.classList.add("opacity-40", "grayscale");
      bouton.disabled = true;
      bouton.textContent = "Épuisé";
    }

    fragment
      .querySelector('[data-action="ajouter-panier"]')
      .addEventListener("click", () => actions.surAjout?.(produit));

    return fragment;
  },
};

export { CarteProduitView };
