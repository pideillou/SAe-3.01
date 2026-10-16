/**
 * Changement de page depuis le code (après une connexion, une déconnexion…),
 * sans recharger le navigateur. Le routeur écoute « popstate » : on ajoute
 * l'adresse à l'historique puis on lui signale le changement.
 *
 * @param {string} chemin  chemin de route sans le chemin du projet : "connexion"
 */
export function naviguer(chemin) {
  window.history.pushState(null, "", import.meta.env.BASE_URL + chemin);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
