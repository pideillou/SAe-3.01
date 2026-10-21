import { formaterDateHeure, formaterPrix, pluriel } from "../../lib/format.js";
import { statutDe } from "../../lib/statuts-commande.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";

// Une commande de l'historique : numéro, date, statut, articles avec leurs
// options, total et lien vers le détail. En lecture seule, sans action.
let CarteCommandeView = {
  /**
   * @param {{numero: string, statut: string, total: string, creeLe: string,
   *          articles: number,
   *          lignes: Array<{produitNom: string, nom: string, options: string,
   *                         quantite: number}>}} commande
   */
  dom: function (commande) {
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
    return fragment;
  },
};

export { CarteCommandeView };
