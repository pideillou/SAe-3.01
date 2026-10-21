import { getRequest, postRequest } from "../lib/api-request.js";

let AdminCodePromoData = {};

/**
 * Les codes promotionnels et leurs statistiques d'utilisation :
 * GET /api/admin/codes-promo. Réservé aux administrateurs (401 sinon).
 *
 * { codes: [ { id, code: "BIENVENUE10", pourcentage: 10, actif: true,
 *              creeLe, utilisations: 4, annulees: 1,
 *              reductionTotale: "76.00", chiffreAffaires: "684.00" }, … ],
 *   resume: { codes, actifs, utilisations, reductionTotale, chiffreAffaires } }
 *
 * « utilisations », « reductionTotale » et « chiffreAffaires » ne comptent pas
 * les commandes annulées (« annulees » les compte à part).
 */
AdminCodePromoData.fetchAll = async function () {
  return getRequest("admin/codes-promo");
};

/**
 * Création : POST /api/admin/codes-promo  { code, pourcentage, actif }
 * 201 : { code }. Un formulaire refusé donne une ErreurApi (422, ou 409 si le
 * code existe) dont « champs » contient un message par champ.
 */
AdminCodePromoData.creer = async function (valeurs) {
  return postRequest("admin/codes-promo", valeurs);
};

/**
 * Modification du pourcentage et de l'état :
 * POST /api/admin/codes-promo/modifier  { id, pourcentage, actif }
 * Le nom du code ne change pas.
 */
AdminCodePromoData.modifier = async function (id, pourcentage, actif) {
  return postRequest("admin/codes-promo/modifier", { id, pourcentage, actif });
};

/**
 * Suppression : POST /api/admin/codes-promo/supprimer  { id }
 * Les commandes passées avec ce code gardent leur réduction.
 */
AdminCodePromoData.supprimer = async function (id) {
  return postRequest("admin/codes-promo/supprimer", { id });
};

export { AdminCodePromoData };
