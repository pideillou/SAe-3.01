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

/**
 * Comme naviguer(), mais la page courante est remplacée dans l'historique au lieu
 * d'en ajouter une. À utiliser pour une redirection que le visiteur n'a pas
 * choisie (page réservée sans connexion, connexion réussie, déconnexion) : le
 * bouton « précédent » ne le ramène pas sur une page qui le renverrait aussitôt
 * ailleurs, et il revient à la page d'où il venait.
 *
 * @param {string} chemin  chemin de route sans le chemin du projet : "admin"
 */
export function remplacer(chemin) {
  window.history.replaceState(null, "", import.meta.env.BASE_URL + chemin);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * La page où envoyer un visiteur qui vient de se connecter ou de s'inscrire :
 * celle qu'il voulait atteindre (adresse /connexion?retour=commande), sinon
 * l'espace personnel. Le paramètre vient de l'adresse, donc d'une source non
 * fiable : on n'accepte qu'un chemin interne simple (lettres, chiffres, tirets
 * et barres obliques), jamais une adresse complète vers un autre site.
 *
 * @returns {{chemin: string, retour: string|null}}  chemin de route, et le
 *          paramètre à conserver sur les liens connexion <-> inscription
 */
export function destinationApresConnexion() {
  let retour = new URLSearchParams(window.location.search).get("retour");
  let valide = retour !== null && /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/.test(retour);

  return { chemin: valide ? retour : "espace-personnel", retour: valide ? retour : null };
}
