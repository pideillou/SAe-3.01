import { getRequest } from "../lib/api-request.js";

let AdminCommandeData = {};

/**
 * Les commandes de tous les clients : GET /api/admin/commandes
 * Réservé aux administrateurs (401 sans connexion administrateur).
 *
 * { commandes: [ { numero, statut: "en cours", total: "449.97",
 *                  creeLe: "2026-10-16 14:30:00", email, articles: 3 }, … ],
 *   limite: 100 }        // les plus récentes d'abord, au plus « limite »
 */
AdminCommandeData.fetchAll = async function () {
  return getRequest("admin/commandes");
};

export { AdminCommandeData };
