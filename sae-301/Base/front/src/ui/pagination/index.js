import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Précédent / Suivant avec le numéro de la page. Les boutons inutilisables
// (première ou dernière page) sont désactivés ; la page choisie est signalée par
// actions.surPage.
let PaginationView = {
  /**
   * @param {{page: number, pages: number}} data
   * @param {{surPage: (page: number) => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(genericRenderer(template, { page: data.page, pages: data.pages }));

    let precedent = fragment.querySelector('[data-action="precedent"]');
    let suivant = fragment.querySelector('[data-action="suivant"]');

    precedent.disabled = data.page <= 1;
    suivant.disabled = data.page >= data.pages;

    precedent.addEventListener("click", () => actions.surPage(data.page - 1));
    suivant.addEventListener("click", () => actions.surPage(data.page + 1));

    return fragment;
  },
};

export { PaginationView };
