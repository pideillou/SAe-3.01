import { getRequest } from "../lib/api-request.js";

let ProduitData = {};

/**
 * Les produits du catalogue : GET /api/produits
 * Avec un slug de catégorie : GET /api/produits?categorie=claviers
 *
 * { total: 4,
 *   categorie: { nom, slug } | null,   // la catégorie demandée
 *   produits: [ { id, nom, slug, prix: "189.99",
 *                 prixBarre: "239.99" | null, promotion: 20 | null,   // promotion automatique (PRO-c)
 *                 etat: "en-stock" | "bientot-epuise" | "epuise",   // variante la mieux fournie
 *                 categorie: { nom, slug },
 *                 image: { moyen, grand, alt } | null }, ... ] }
 *
 * Les produits arrivent rangés par catégorie. Les chemins d'image sont
 * relatifs au dossier public du front (voir urlPublique dans lib/utils.js).
 * Une catégorie inconnue donne une ErreurApi de statut 404.
 */
ProduitData.fetchAll = async function (categorie) {
  if (categorie === undefined) {
    return getRequest("produits");
  }

  return getRequest(`produits?categorie=${encodeURIComponent(categorie)}`);
};

/**
 * La fiche d'un produit : GET /api/produit?slug=razer-cobra
 *
 * { produit: { id, nom, slug, accroche, description,
 *              caracteristiques: [ "…", … ],        // points forts
 *              prix: "49.99", prixMax: "79.99",
 *              prixBarre: null, prixMaxBarre: null, promotion: null,   // -20 % : prix d'origine et pourcentage
 *              categorie: { nom, slug },
 *              images: [ { moyen, grand, alt }, ... ],
 *              options: [ { nom, valeurs: [ { id, valeur }, … ] }, … ],
 *              variantes: [ { id, reference, nom, prix, prixBarre, stock,
 *                             etat: "en-stock" | "bientot-epuise" | "epuise",
 *                             defaut, valeurs: [ id, … ], image } , … ] } }
 *
 * « prix » est celui de la variante la moins chère, « prixMax » celui de la
 * plus chère. Le produit au plus gros stock est en promotion automatique : tous
 * les prix sont alors réduits de 20 %, « prixBarre » (et « prixMaxBarre ») portent
 * les prix d'origine, et « promotion » le pourcentage (tous null hors promotion). La première image est la principale. Un produit inconnu donne
 * une ErreurApi de statut 404.
 */
ProduitData.fetchOne = async function (slug) {
  return getRequest(`produit?slug=${encodeURIComponent(slug)}`);
};

export { ProduitData };
