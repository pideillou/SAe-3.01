import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { BadgeStockView } from "../badge-stock/index.js";
import fleche from "../../assets/fleche.svg";
import template from "./template.html?raw";

// Carte d'un produit, tel que le renvoie l'API :
// { nom, slug, prix, etat, image: { moyen } } ; la carte est un lien vers la fiche.
// « etat » est l'état de stock du produit (STK-b) : le badge le montre, et un
// produit épuisé est grisé et ne peut plus être ajouté au panier.
let CarteProduitView = {
  html: function (produit) {
    // Les valeurs sont mises en forme avant d'être passées au template.
    return genericRenderer(template, {
      nom: produit.nom,
      prix: formaterPrix(produit.prix),
      // L'image principale est un original carré de 500 px : assez net pour
      // une carte, même sur un écran haute densité.
      image: urlPublique(produit.image.moyen),
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
    fragment.querySelector("img").loading = prioritaire ? "eager" : "lazy";

    fragment.querySelector('slot[name="stock"]').replaceWith(BadgeStockView.dom(produit.etat));

    let bouton = fragment.querySelector('[data-action="ajouter-panier"]');

    if (produit.etat === "epuise") {
      // Un template n'a pas de condition : l'état épuisé se règle ici. Les
      // classes sont écrites en entier pour que Tailwind les génère.
      fragment.querySelector("img").classList.add("opacity-40", "grayscale");
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
