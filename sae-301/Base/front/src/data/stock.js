import { postRequest } from "../lib/api-request.js";

let StockData = {};

/**
 * Vérification d'un panier contre le stock réel : POST /api/panier/verifier
 *
 * Envoie [ { varianteId, quantite }, … ] et reçoit, pour chaque ligne :
 * { varianteId, statut: "ok" | "ajustee" | "epuisee" | "inconnue",
 *   quantiteDemandee, quantiteAcceptee,
 *   stock, etat, prix, nom, produitSlug, produitNom, image }
 * (les champs après quantiteAcceptee manquent pour le statut « inconnue »).
 *
 * « ajustee » : la quantité demandée dépasse le stock, quantiteAcceptee dit ce
 * que le serveur accepterait. « inconnue » : la variante n'existe plus.
 */
StockData.verifier = async function (lignes) {
  return postRequest("panier/verifier", { lignes });
};

export { StockData };
