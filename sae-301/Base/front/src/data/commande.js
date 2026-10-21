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

/**
 * L'historique du client connecté : GET /api/commandes?statut=&du=&au=&page=1
 *
 * filtre : { statut, du, au } ; une chaîne vide ne filtre pas. Les dates sont
 * au format AAAA-MM-JJ et incluses. Les commandes arrivent de la plus récente à
 * la plus ancienne, 10 par page.
 *
 * { commandes: [ { numero, statut, total, creeLe, articles,
 *                  lignes: [ { produitNom, nom, options, quantite }, … ] }, … ],
 *   total: 23,      // commandes correspondant au filtre, toutes pages confondues
 *   page: 1, pages: 3, parPage: 10 }
 *
 * 401 : visiteur non connecté. 422 : statut ou date invalide.
 */
CommandeData.fetchAll = async function (filtre, page = 1) {
  let parametres = new URLSearchParams();

  for (let cle of ["statut", "du", "au"]) {
    if (filtre[cle] !== "") {
      parametres.set(cle, filtre[cle]);
    }
  }

  parametres.set("page", String(page));

  return getRequest(`commandes?${parametres.toString()}`);
};

/**
 * Prépare le transfert d'une ancienne commande dans le panier :
 * POST /api/commande/recommander  { numero }
 *
 * Le serveur vérifie la disponibilité d'aujourd'hui et ne modifie rien.
 *
 * { numero,
 *   articles: [ { varianteId, quantite, produitSlug, produitNom, nom, options,
 *                 prix, stock, image: { moyen, alt } | null }, … ],   // à ajouter
 *   indisponibles: [ { nom, raison: "epuise" | "supprime" }, … ],
 *   ajustes: [ { nom, demandee, acceptee }, … ],       // quantité ramenée au stock
 *   prix: [ { nom, ancien, nouveau }, … ] }            // prix changé depuis
 *
 * 404 : commande inconnue ou d'un autre client. 401 : visiteur non connecté.
 */
CommandeData.recommander = async function (numero) {
  return postRequest("commande/recommander", { numero });
};

export { CommandeData };
