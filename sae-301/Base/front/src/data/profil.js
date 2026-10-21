import { getRequest, postRequest } from "../lib/api-request.js";

let ProfilData = {};

/**
 * Le profil du client connecté et l'aperçu de son activité : GET /api/profil
 *
 * { profil: { nom: "" | "Prénom Nom", email, creeLe },
 *   nombreCommandes: 7,
 *   commandesRecentes: [ … ] }   // les 3 dernières, au format de CommandeData.fetchAll
 *
 * 401 : visiteur non connecté.
 */
ProfilData.fetch = async function () {
  return getRequest("profil");
};

/**
 * Modifie le nom et l'e-mail : POST /api/profil
 * Un formulaire refusé donne une ErreurApi (422, ou 409 si l'adresse est déjà
 * prise) dont « champs » contient un message par champ.
 */
ProfilData.modifier = async function (nom, email) {
  return postRequest("profil", { nom, email });
};

/**
 * Change le mot de passe : POST /api/profil/mot-de-passe
 * Le serveur exige le mot de passe actuel (422, champs.actuel, s'il est faux).
 */
ProfilData.changerMotDePasse = async function (actuel, nouveau, confirmation) {
  return postRequest("profil/mot-de-passe", { actuel, nouveau, confirmation });
};

export { ProfilData };
