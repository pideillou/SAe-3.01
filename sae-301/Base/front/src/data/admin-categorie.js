import { getRequest, postRequest } from "../lib/api-request.js";

let AdminCategorieData = {};

/**
 * Les catégories, avec leur description et leur ordre : GET /api/admin/categories
 * Réservé aux administrateurs (401 sans connexion administrateur).
 *
 * { categories: [ { id, nom, slug, description: "…" | null, ordre, nombre }, … ],
 *   ordreSuivant: 4 }      // « nombre » : produits rattachés
 */
AdminCategorieData.fetchAll = async function () {
  return getRequest("admin/categories");
};

/**
 * Création : POST /api/admin/categories  { nom, description, ordre }
 * 201 : { categorie }. Un formulaire refusé donne une ErreurApi (422 ou 409)
 * dont « champs » contient un message par champ.
 */
AdminCategorieData.creer = async function (valeurs) {
  return postRequest("admin/categories", valeurs);
};

/**
 * Modification : POST /api/admin/categories/modifier  { id, nom, description, ordre }
 * L'adresse (slug) de la catégorie ne change pas.
 */
AdminCategorieData.modifier = async function (id, valeurs) {
  return postRequest("admin/categories/modifier", { id, ...valeurs });
};

/**
 * Suppression : POST /api/admin/categories/supprimer  { id }
 * 409 tant que la catégorie contient des produits (le message le précise).
 */
AdminCategorieData.supprimer = async function (id) {
  return postRequest("admin/categories/supprimer", { id });
};

export { AdminCategorieData };
