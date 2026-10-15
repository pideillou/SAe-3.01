/**
 * Métadonnées de la page affichée : titre de l'onglet, description et
 * balises Open Graph (aperçu d'un lien partagé).
 *
 * Le front est une application d'une seule page : le routeur ne recharge pas
 * le document, c'est donc à chaque page de mettre ses métadonnées à jour.
 * Appelée sans argument, la fonction remet celles du site.
 */
const NOM_SITE = "Razer Click & Collect";
const DESCRIPTION_SITE = "Claviers, souris et casques Razer à réserver en ligne et à retirer en magasin.";

function balise(attribut, nom, contenu) {
  let element = document.head.querySelector(`meta[${attribut}="${nom}"]`);

  if (contenu === null) {
    element?.remove();
    return;
  }

  if (element === null) {
    element = document.createElement("meta");
    element.setAttribute(attribut, nom);
    document.head.append(element);
  }

  element.setAttribute("content", contenu);
}

/**
 * @param {{titre?: string, description?: string, image?: string}} meta
 *   titre : titre de la page, suivi du nom du site ;
 *   description : résumé de la page ;
 *   image : adresse de l'image d'aperçu, relative au site ou absolue.
 */
export function definirMetadonnees({ titre, description, image } = {}) {
  let titreComplet = titre === undefined ? NOM_SITE : `${titre} | ${NOM_SITE}`;
  let resume = description ?? DESCRIPTION_SITE;

  document.title = titreComplet;

  balise("name", "description", resume);
  balise("property", "og:site_name", NOM_SITE);
  balise("property", "og:type", image === undefined ? "website" : "product");
  balise("property", "og:title", titreComplet);
  balise("property", "og:description", resume);
  balise("property", "og:url", window.location.href);
  balise("property", "og:image", image === undefined ? null : new URL(image, window.location.origin).href);
}
