import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Les trois états de stock du Figma. Les classes sont écrites en entier :
// Tailwind ne génère que les classes qu'il trouve telles quelles.
const ETATS = {
  "en-stock": { libelle: "En stock", classesTexte: "text-razer", classesPuce: "bg-razer" },
  "bientot-epuise": { libelle: "Bientôt épuisé", classesTexte: "text-alerte", classesPuce: "bg-alerte" },
  epuise: { libelle: "Épuisé", classesTexte: "text-erreur", classesPuce: "bg-erreur" },
};

// Badge d'état du stock, d'après l'état calculé par l'API.
let BadgeStockView = {
  /**
   * @param {"en-stock"|"bientot-epuise"|"epuise"} etat
   */
  dom: function (etat) {
    return htmlToFragment(genericRenderer(template, ETATS[etat] ?? ETATS["en-stock"]));
  },
};

export { BadgeStockView };
