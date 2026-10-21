import { formaterDateHeure, formaterPrix, pluriel } from "../../lib/format.js";
import { statutDe } from "../../lib/statuts-commande.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";

// Une commande de l'historique : numéro, date, statut, articles avec leurs
// options, total, lien vers le détail et, si la page le permet, « Commander à
// nouveau ». Le composant ne modifie rien : il signale le clic par actions.
let CarteCommandeView = {
  /**
   * @param {{numero: string, statut: string, total: string, creeLe: string,
   *          articles: number,
   *          lignes: Array<{produitNom: string, nom: string, options: string,
   *                         quantite: number}>}} commande
   * @param {{surRecommander?: (numero: string) => void}} actions  sans
   *          surRecommander, le bouton « Commander à nouveau » n'est pas affiché
   */
  dom: function (commande, actions = {}) {
    let statut = statutDe(commande.statut);

    let fragment = htmlToFragment(
      genericRenderer(template, {
        chemin: urlPublique(`commande/${commande.numero}?historique`),
        numero: commande.numero,
        date: formaterDateHeure(commande.creeLe),
        statut: statut.libelle,
        classesStatut: statut.classes,
        articles: pluriel(commande.articles, "article"),
        total: formaterPrix(commande.total),
      })
    );

    let lignes = commande.lignes.map((ligne) => {
      // Sans options enregistrées (commande passée avant OPT-a), le nom de la
      // variante les contient.
      let options = ligne.options ?? "";
      let element = htmlToFragment(
        genericRenderer(templateLigne, {
          quantite: ligne.quantite,
          titre: options === "" ? ligne.nom : ligne.produitNom,
          options,
        })
      );

      if (options === "") {
        element.querySelector("[data-options]").remove();
      }

      return element;
    });

    fragment.querySelector('slot[name="lignes"]').replaceWith(...lignes);

    let bouton = fragment.querySelector('[data-action="recommander"]');
    if (actions.surRecommander === undefined) {
      bouton.remove();
    } else {
      bouton.addEventListener("click", () => actions.surRecommander(commande.numero));
    }

    return fragment;
  },
};

export { CarteCommandeView };
