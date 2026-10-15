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
 * @returns {DocumentFragment}
 */
export function RootLayout() {
  let layout = htmlToFragment(template);
  layout.querySelector('slot[name="header"]').replaceWith(HeaderView.dom());
  layout.querySelector('slot[name="pied-de-page"]').replaceWith(PiedDePageView.dom());
  return layout;
}
