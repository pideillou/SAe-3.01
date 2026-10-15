import { definirMetadonnees } from "../../lib/seo.js";
import template from "./template.html?raw";

// Page statique : elle renvoie son template tel quel.
export function The404Page() {
  definirMetadonnees({ titre: "Page introuvable" });
  return template;
}
