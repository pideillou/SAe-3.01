import { getRequest, postRequest } from "../lib/api-request.js";

let AdminAuthData = {};

/**
 * Connexion administrateur : POST /api/admin/login
 * Séparée de celle des clients : autre route, autre compte, autre clé de session.
 */
AdminAuthData.login = async function (email, mdp) {
  return postRequest("admin/login", { email, mdp });
};

/**
 * Déconnexion : POST /api/admin/logout
 */
AdminAuthData.logout = async function () {
  return postRequest("admin/logout");
};

/**
 * État de la session administrateur : GET /api/admin/moi
 * { connecte: false } ou { connecte: true, email: "…" }
 */
AdminAuthData.moi = async function () {
  return getRequest("admin/moi");
};

export { AdminAuthData };
