import { getRequest } from "../lib/api-request.js";

let CategorieData = {};

// Durée pendant laquelle la liste des catégories est réutilisée sans nouvelle
// requête : l'en-tête (menu) et la page catalogue la demandent à chaque
// affichage, et elle change rarement.
const DUREE_CACHE_MS = 60_000;

let cache = null; // { date, promesse }

/**
 * Les catégories du catalogue : GET /api/categories
 *
 * { total: 12,
 *   categories: [ { nom: "Claviers", slug: "claviers", nombre: 4 }, ... ] }
 *
 * Elles arrivent dans l'ordre d'affichage. « total » est le nombre de produits
 * de tout le catalogue.
 */
CategorieData.fetchAll = function () {
  if (cache !== null && Date.now() - cache.date < DUREE_CACHE_MS) {
    return cache.promesse;
  }

  let promesse = getRequest("categories");
  cache = { date: Date.now(), promesse };

  // Une erreur ne doit pas rester en cache : la requête suivante réessaie.
  promesse.catch(() => {
    if (cache !== null && cache.promesse === promesse) {
      cache = null;
    }
  });

  return promesse;
};

/**
 * Oublie la liste en cache (à appeler après une modification des catégories).
 */
CategorieData.invalider = function () {
  cache = null;
};

export { CategorieData };
