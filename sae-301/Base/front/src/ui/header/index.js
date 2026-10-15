import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import logo from "../../assets/logo-razer.webp";
import iconeAdmin from "../../assets/admin.svg";
import template from "./template.html?raw";

// En-tête du site : logo Razer et accès à l'administration. Les liens Espace
// personnel et Panier du Figma arriveront avec les user stories concernées.
let HeaderView = {
  html: function () {
    return genericRenderer(template, { logo, iconeAdmin });
  },

  dom: function () {
    return htmlToFragment(HeaderView.html());
  },
};

export { HeaderView };
