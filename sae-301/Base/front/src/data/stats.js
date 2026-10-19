import { getRequest } from "../lib/api-request.js";

let StatsData = {};

/**
 * Indicateurs du tableau de bord : GET /api/admin/stats, réservé aux
 * administrateurs (401 sans connexion administrateur).
 *
 * { produits: 12, variantes: 57, unites: 327,
 *   commandes: { total: 4, enCours: 3 },
 *   parCategorie: [ { categorie: "Claviers", nombre: 4 }, ... ] }
 */
StatsData.fetch = async function () {
  return getRequest("admin/stats");
};

export { StatsData };
