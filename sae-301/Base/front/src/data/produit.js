import { getRequest } from "../lib/api-request.js";

let ProduitData = {};

/**
 * Tout le catalogue : GET /api/produits
 *
 * { total: 12,
 *   produits: [ { id, nom, slug, prix: "189.99",
 *                 categorie: { nom, slug },
 *                 image: { moyen, grand, alt } | null }, ... ] }
 *
 * Les produits arrivent rangés par catégorie. Les chemins d'image sont
 * relatifs au dossier public du front (voir urlPublique dans lib/utils.js).
 */
ProduitData.fetchAll = async function () {
  return getRequest("produits");
};

export { ProduitData };
