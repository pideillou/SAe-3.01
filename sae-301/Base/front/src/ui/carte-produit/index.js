import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import fleche from "../../assets/fleche.svg";
import template from "./template.html?raw";

// Carte d'un produit, tel que le renvoie l'API :
// { nom, slug, prix, image: { moyen } } ; la carte est un lien vers la fiche.
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
   */
  dom: function (produit, prioritaire = false) {
    let fragment = htmlToFragment(CarteProduitView.html(produit));

    // Un template n'a pas de condition : le chargement différé se règle ici.
    // Les images hors de l'écran ne sont téléchargées qu'à l'approche du
    // défilement, ce qui garde le catalogue sous les 3 secondes.
    fragment.querySelector("img").loading = prioritaire ? "eager" : "lazy";

    return fragment;
  },
};

export { CarteProduitView };
