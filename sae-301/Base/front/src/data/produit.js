import { getRequest } from "../lib/api-request.js";

let ProduitData = {};

/**
 * Les produits du catalogue : GET /api/produits
 * Avec un slug de catégorie : GET /api/produits?categorie=claviers
 *
 * { total: 4,
 *   categorie: { nom, slug } | null,   // la catégorie demandée
 *   produits: [ { id, nom, slug, prix: "189.99",
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

export { ProduitData };
