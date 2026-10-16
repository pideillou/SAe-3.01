/**
 * Règles de saisie des formulaires de compte, vérifiées côté navigateur pour
 * répondre tout de suite. Le serveur applique les mêmes règles et reste seul
 * juge (AuthController) : ce contrôle ne protège rien, il évite un aller-retour.
 *
 * Chaque fonction renvoie un message en français, ou null si la saisie convient.
 */
const MDP_MIN = 8;

export function erreurEmail(email) {
  if (email === "") {
    return "Saisissez votre adresse e-mail.";
  }

  // Forme minimale « quelque chose@domaine.extension » ; le serveur vérifie le reste.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Cette adresse e-mail n'est pas valide.";
  }

  return null;
}

export function erreurMotDePasse(mdp) {
  if (mdp === "") {
    return "Choisissez un mot de passe.";
  }

  if (mdp.length < MDP_MIN) {
    return `Le mot de passe doit contenir au moins ${MDP_MIN} caractères.`;
  }

  return null;
}

export function erreurConfirmation(mdp, confirmation) {
  return mdp === confirmation ? null : "Les deux mots de passe ne sont pas identiques.";
}

/**
 * Les erreurs de l'inscription, un message par champ fautif ({} si tout va bien).
 */
export function erreursInscription({ email, mdp, confirmation }) {
  let erreurs = {
    email: erreurEmail(email),
    mdp: erreurMotDePasse(mdp),
    confirmation: erreurMotDePasse(mdp) === null ? erreurConfirmation(mdp, confirmation) : null,
  };

  return Object.fromEntries(Object.entries(erreurs).filter(([, message]) => message !== null));
}

/**
 * Les erreurs de la connexion : seuls les champs vides sont signalés ici ; la
 * validité du mot de passe est l'affaire du serveur (et ne doit pas révéler
 * les règles à quelqu'un qui devine).
 */
export function erreursConnexion({ email, mdp }) {
  let erreurs = {
    email: email === "" ? "Saisissez votre adresse e-mail." : null,
    mdp: mdp === "" ? "Saisissez votre mot de passe." : null,
  };

  return Object.fromEntries(Object.entries(erreurs).filter(([, message]) => message !== null));
}
