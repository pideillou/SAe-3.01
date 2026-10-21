import { formaterPrix } from "../../lib/format.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import template from "./template.html?raw";

// Une ligne de commande en lecture seule : image, nom, quantité x prix et total
// de la ligne. Aucune action : on ne modifie plus une commande validée.
let LigneCommandeView = {
  /**
   * @param {{nom: string, produitNom?: string, options?: string, image: string|null,
   *          prixUnitaire: string, quantite: number}} ligne
   */
  dom: function (ligne) {
    let totalLigne = (Math.round(Number(ligne.prixUnitaire) * 100) * ligne.quantite) / 100;

    // Les options à part sous le nom du produit ; sans elles (commande passée
    // avant OPT-a), le nom de la variante les contient.
    let options = ligne.options ?? "";

    let fragment = htmlToFragment(
      genericRenderer(template, {
        titre: options === "" ? ligne.nom : ligne.produitNom,
        options,
        image: ligne.image === null ? "" : urlPublique(ligne.image),
        quantite: ligne.quantite,
        prixUnitaire: formaterPrix(ligne.prixUnitaire),
        totalLigne: formaterPrix(totalLigne),
      })
    );

    // Un template n'a pas de condition : l'image absente se retire ici.
    if (ligne.image === null) {
      fragment.querySelector("[data-image]").remove();
    }

    if (options === "") {
      fragment.querySelector("[data-options]").remove();
    }

    return fragment;
  },
};

export { LigneCommandeView };
