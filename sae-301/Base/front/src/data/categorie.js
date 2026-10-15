import { getRequest } from "../lib/api-request.js";

let CategorieData = {};

/**
 * Les catégories du catalogue : GET /api/categories
 *
 * { total: 12,
 *   categories: [ { nom: "Claviers", slug: "claviers", nombre: 4 }, ... ] }
 *
 * Elles arrivent dans l'ordre d'affichage. « total » est le nombre de produits
 * de tout le catalogue.
 */
CategorieData.fetchAll = async function () {
  return getRequest("categories");
};

export { CategorieData };
