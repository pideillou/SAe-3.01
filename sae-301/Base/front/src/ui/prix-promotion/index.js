import { formaterPrix } from "../../lib/format.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Un prix, avec la promotion automatique (PRO-c) quand il y en a une : le prix
// réduit en couleur, l'ancien prix barré et le pourcentage de la réduction. Sans
// promotion, c'est le prix seul. La taille du texte vient de l'élément qui reçoit
// ce composant : il ne fixe que ce qui distingue le prix promotionnel.
let PrixPromotionView = {
  /**
   * @param {{prix: string, prixBarre?: string|null, promotion?: number|null}} data
   *        prix : le prix à payer ; prixBarre : l'ancien prix (null hors promotion) ;
   *        promotion : le pourcentage de la réduction
   * @returns {DocumentFragment|Text}
   */
  dom: function (data) {
    if (data.prixBarre === null || data.prixBarre === undefined) {
      return document.createTextNode(formaterPrix(data.prix));
    }

    return htmlToFragment(
      genericRenderer(template, {
        prix: formaterPrix(data.prix),
        prixBarre: formaterPrix(data.prixBarre),
        pourcentage: data.promotion ?? 20,
      })
    );
  },
};

export { PrixPromotionView };
