import { formaterDateHeure, formaterPrix } from "../../lib/format.js";
import { statutDe } from "../../lib/statuts-commande.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";

const NOMS_DE_TRI = { date: "date", statut: "statut", montant: "montant", numero: "numéro" };

// Tableau des commandes du back-office : tri par colonne, sélection de lignes
// pour les actions en lot. Il ne modifie rien : il signale les clics, et la page
// décide (elle relit les commandes dans le nouvel ordre, mémorise la sélection).
let TableauCommandesView = {
  /**
   * @param {{commandes: Array<{numero, statut, total, creeLe, email, articles}>,
   *          tri: string,                  // colonne triée : « date », « statut », « montant »
   *          sens: "asc"|"desc",
   *          selection: Set<string>}} data  numéros des commandes cochées
   * @param {{surTri: (colonne: string) => void,
   *          surSelection: (numero: string, coche: boolean) => void,
   *          surToutSelectionner: (coche: boolean) => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(genericRenderer(template, { tri: NOMS_DE_TRI[data.tri] ?? data.tri }));

    // En-têtes triables : la colonne triée l'annonce (aria-sort) et montre le sens.
    for (let colonne of fragment.querySelectorAll("[data-tri]")) {
      let nom = colonne.dataset.tri;
      let actuelle = nom === data.tri;

      colonne.setAttribute("aria-sort", actuelle ? (data.sens === "asc" ? "ascending" : "descending") : "none");
      colonne.querySelector("[data-fleche]").textContent = actuelle ? (data.sens === "asc" ? "↑" : "↓") : "";
      colonne.querySelector("button").addEventListener("click", () => actions.surTri(nom));
    }

    let lignes = data.commandes.map((commande) => {
      let statut = statutDe(commande.statut);

      let ligne = htmlToFragment(
        genericRenderer(templateLigne, {
          numero: commande.numero,
          chemin: urlPublique(`admin/commandes/${commande.numero}`),
          date: formaterDateHeure(commande.creeLe),
          email: commande.email,
          articles: commande.articles,
          statut: statut.libelle,
          classesStatut: statut.classes,
          total: formaterPrix(commande.total),
        })
      );

      let case_ = ligne.querySelector('[data-role="selection"]');
      case_.checked = data.selection.has(commande.numero);
      case_.addEventListener("change", () => actions.surSelection(commande.numero, case_.checked));

      return ligne;
    });

    fragment.querySelector("[data-lignes]").replaceChildren(...lignes);

    let tout = fragment.querySelector('[data-role="tout"]');
    tout.checked = data.commandes.length > 0 && data.commandes.every((c) => data.selection.has(c.numero));
    tout.addEventListener("change", () => actions.surToutSelectionner(tout.checked));

    return fragment;
  },
};

export { TableauCommandesView };
