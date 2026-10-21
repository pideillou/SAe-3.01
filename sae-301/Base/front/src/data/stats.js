import { getFichier, getRequest } from "../lib/api-request.js";

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

/**
 * Les statistiques du tableau de bord : GET /api/admin/statistiques, lues dans
 * la base à chaque appel (rien n'est mis en cache). Réservé aux administrateurs.
 *
 * { genereLe: "2026-10-21 14:55:03", seuil: 5,
 *   stocks: [ { produit, categorie, unites, variantes, etat } ],   // histogramme
 *   revenus: [ { date: "2026-10-15", commandes: 2, revenu: "379.98" }, … ],   // 7 jours
 *   commandes: { total: 12, parStatut: { "en cours": 3, disponible: 2, retirée: 6, annulée: 1 } },
 *   plusVendus: [ { produit, unites, chiffreAffaires: "759.96" } ],
 *   stocksFaibles: [ { produit, variante, stock, etat: "epuise" | "bientot-epuise" } ] }
 */
StatsData.fetchStatistiques = async function () {
  return getRequest("admin/statistiques");
};

/**
 * L'export des statistiques : GET /api/admin/statistiques/export, un fichier
 * CSV (Blob) des mêmes données.
 */
StatsData.exporter = async function () {
  return getFichier("admin/statistiques/export");
};

export { StatsData };
