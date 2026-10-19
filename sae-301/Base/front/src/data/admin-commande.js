import { getRequest, postRequest } from "../lib/api-request.js";

let AdminCommandeData = {};

/**
 * Les commandes de tous les clients : GET /api/admin/commandes
 * Réservé aux administrateurs (401 sans connexion administrateur).
 *
 * Paramètres : tri (« date », « statut », « montant », « numero »), sens
 * (« asc », « desc ») et statut (filtre). Le serveur remplace toute valeur inconnue.
 *
 * { commandes: [ { numero, statut: "en cours", suivants: [ "disponible", "annulée" ],
 *                  total: "449.97", creeLe: "2026-10-16 14:30:00", email, articles: 3 }, … ],
 *   limite: 100, tri, sens, statut }
 */
AdminCommandeData.fetchAll = async function ({ tri, sens, statut }) {
  let parametres = new URLSearchParams({ tri, sens });
  if (statut !== "") {
    parametres.set("statut", statut);
  }

  return getRequest(`admin/commandes?${parametres}`);
};

/**
 * Le détail complet d'une commande : GET /api/admin/commande?numero=RZ-…
 *
 * { commande: { numero, statut, suivants, total, creeLe, email,
 *               lignes: [ { produitNom, produitSlug, nom, image, prixUnitaire, quantite }, … ],
 *               journal: [ { administrateur, ancien, nouveau, creeLe }, … ] } }   // du plus récent
 */
AdminCommandeData.fetchOne = async function (numero) {
  return getRequest(`admin/commande?numero=${encodeURIComponent(numero)}`);
};

/**
 * Changement de statut, d'une ou de plusieurs commandes :
 * POST /api/admin/commandes/statut  { numeros: [ … ], statut }
 *
 * { statut, modifiees: 2, resultats: [ { numero, ok: true } | { numero, ok: false, erreur }, … ] }
 *
 * Chaque commande est traitée à part : une commande refusée n'empêche pas les
 * autres. « annulée » remet le stock en rayon ; les autres statuts n'y touchent pas.
 */
AdminCommandeData.changerStatut = async function (numeros, statut) {
  return postRequest("admin/commandes/statut", { numeros, statut });
};

export { AdminCommandeData };
