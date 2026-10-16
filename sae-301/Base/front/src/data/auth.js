import { getRequest, postRequest } from "../lib/api-request.js";

let AuthData = {};

/**
 * Inscription : POST /api/inscription
 * Crée le compte et ouvre la session. Un formulaire refusé donne une ErreurApi
 * (statut 422 ou 409) dont « champs » contient un message par champ.
 */
AuthData.inscription = async function (email, mdp, confirmation) {
  return postRequest("inscription", { email, mdp, confirmation });
};

/**
 * Connexion : POST /api/login
 * En cas de succès, le serveur ouvre une session ; le cookie PHPSESSID qu'il
 * renvoie accompagnera ensuite chaque requête.
 */
AuthData.login = async function (email, mdp) {
  return postRequest("login", { email, mdp });
};

/**
 * Déconnexion : POST /api/logout
 */
AuthData.logout = async function () {
  return postRequest("logout");
};

/**
 * État de la session : GET /api/moi
 * { connecte: false } ou { connecte: true, email: "…" }
 */
AuthData.moi = async function () {
  return getRequest("moi");
};

export { AuthData };
