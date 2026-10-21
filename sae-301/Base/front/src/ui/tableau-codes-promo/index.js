import { formaterPrix, pluriel } from "../../lib/format.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";

// Tableau des codes promotionnels du back-office, avec leurs statistiques
// d'utilisation. Il ne modifie rien : il signale les clics, et la page décide.
let TableauCodesPromoView = {
  /**
   * @param {Array<{id, code, pourcentage, actif, utilisations, annulees,
   *                reductionTotale, chiffreAffaires}>} codes
   * @param {{surModification: (code: object) => void,
   *          surBascule: (code: object) => void,
   *          surSuppression: (code: object) => void}} actions
   * @param {boolean} occupe  une action est en cours : le bouton d'état est bloqué
   */
  dom: function (codes, actions, occupe = false) {
    let fragment = htmlToFragment(template);

    let lignes = codes.map((code) => {
      let ligne = htmlToFragment(
        genericRenderer(templateLigne, {
          code: code.code,
          pourcentage: code.pourcentage,
          etat: code.actif ? "Actif" : "Désactivé",
          classesEtat: code.actif ? "text-razer" : "text-texte-secondaire",
          utilisations: pluriel(code.utilisations, "commande"),
          annulees: `${pluriel(code.annulees, "annulée")} non comptée${code.annulees > 1 ? "s" : ""}`,
          reductionTotale: formaterPrix(code.reductionTotale),
          chiffreAffaires: formaterPrix(code.chiffreAffaires),
          libelleBascule: code.actif ? "Désactiver" : "Activer",
        })
      );

      // Un template n'a pas de condition : la mention des commandes annulées
      // n'apparaît que s'il y en a.
      if (code.annulees === 0) {
        ligne.querySelector("[data-annulees]").remove();
      }

      ligne.querySelector('[data-action="modifier"]').addEventListener("click", () => actions.surModification(code));
      ligne.querySelector('[data-action="supprimer"]').addEventListener("click", () => actions.surSuppression(code));

      let basculer = ligne.querySelector('[data-action="basculer"]');
      basculer.disabled = occupe;
      basculer.addEventListener("click", () => actions.surBascule(code));

      return ligne;
    });

    fragment.querySelector("[data-lignes]").replaceChildren(...lignes);
    return fragment;
  },
};

export { TableauCodesPromoView };
