import { CategorieData } from "../../data/categorie.js";
import { htmlToFragment } from "../../lib/utils.js";
import { HeaderView } from "../../ui/header/index.js";
import { PiedDePageView } from "../../ui/pied-de-page/index.js";
import template from "./template.html?raw";

/**
 * Layout principal : l'en-tête, la page affichée, puis le pied de page.
 *
 * Les slots nommés « header » et « pied-de-page » sont remplacés ici. Le slot
 * sans nom est laissé au routeur, qui y place la page.
 *
 * Le menu mobile de l'en-tête liste les catégories : elles sont demandées ici,
 * et le menu se remplit quand elles arrivent. Le layout, lui, n'attend pas.
 *
 * @returns {DocumentFragment}
 */
export function RootLayout() {
  let layout = htmlToFragment(template);

  let header = HeaderView.dom();
  let racineHeader = header.firstElementChild;

  CategorieData.fetchAll()
    .then((categories) => HeaderView.afficherCategories(racineHeader, categories))
    .catch(() => {
      // Le menu reste sans catégories : la page affiche elle-même l'erreur.
    });

  layout.querySelector('slot[name="header"]').replaceWith(header);
  layout.querySelector('slot[name="pied-de-page"]').replaceWith(PiedDePageView.dom());
  return layout;
}
