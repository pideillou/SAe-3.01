import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import logo from "../../assets/logo-razer.webp";
import template from "./template.html?raw";

// Pied de page du site, sans données.
let PiedDePageView = {
  html: function () {
    return genericRenderer(template, { logo });
  },

  dom: function () {
    return htmlToFragment(PiedDePageView.html());
  },
};

export { PiedDePageView };
