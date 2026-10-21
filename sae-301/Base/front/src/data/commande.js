import { getRequest, postRequest } from "../lib/api-request.js";

let CommandeData = {};

/**
 * Validation de la commande : POST /api/commande  (client connecté)
 *
 * Envoie [ { varianteId, quantite }, … ]. Seuls ces deux champs comptent : le
 * serveur relit prix, noms et stocks en base.
 *
 * 201 : { commande } (voir fetchOne).
 * 409 : le stock ne permet pas la commande, rien n'est enregistré. L'ErreurApi
 * porte alors le message du serveur ; le panier doit être revérifié.
 * 401 : visiteur non connecté.
 */
CommandeData.creer = async function (lignes) {
  return postRequest("commande", { lignes });
};

/**
 * Une commande du client connecté : GET /api/commande?numero=RZ-20261016-K7M2QX
 *
 * { commande: { numero, statut: "en cours", total: "379.98",
 *               creeLe: "2026-10-16 14:30:00", email,
 *               lignes: [ { produitNom, produitSlug, nom, options, image,
 *                           prixUnitaire, quantite }, … ] } }
 *
 * Une commande inconnue (ou celle d'un autre client) donne une ErreurApi 404,
 * un visiteur non connecté une 401.
 */
CommandeData.fetchOne = async function (numero) {
  return getRequest(`commande?numero=${encodeURIComponent(numero)}`);
};

export { CommandeData };
