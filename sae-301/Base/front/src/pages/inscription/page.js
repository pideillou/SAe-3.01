import { AuthData } from "../../data/auth.js";
import { destinationApresConnexion, naviguer } from "../../lib/navigation.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { htmlToFragment } from "../../lib/utils.js";
import { erreursInscription } from "../../lib/validation-compte.js";
import { FormulaireCompteView } from "../../ui/formulaire-compte/index.js";
import template from "./template.html?raw";

/**
 * Page « Créer un compte » (CMD-c), à l'adresse /inscription. Le compte est créé
 * puis ouvert aussitôt : le visiteur est connecté à la fin de l'inscription.
 *
 * Le mot de passe n'est jamais conservé dans le modèle : il n'est lu que dans le
 * formulaire, au moment de l'envoi.
 */

let M = {
  email: "", // dernier e-mail saisi, pour pré-remplir le formulaire
  erreurs: {}, // un message par champ fautif
  message: null, // { type, texte } : erreur générale, ou null
  envoiEnCours: false,
};

let C = {};

C.handler_envoi = async function ({ email, mdp, confirmation }) {
  M.email = email;
  M.message = null;
  M.erreurs = erreursInscription({ email, mdp, confirmation });

  if (Object.keys(M.erreurs).length > 0) {
    V.rafraichir();
    return;
  }

  M.envoiEnCours = true;
  V.rafraichir();

  try {
    await AuthData.inscription(email, mdp, confirmation);
    M.envoiEnCours = false;
    naviguer(destinationApresConnexion().chemin);
    return;
  } catch (erreur) {
    M.erreurs = erreur.champs ?? {};
    // Sans message par champ (identifiants refusés, serveur en panne), l'erreur
    // est affichée en tête de formulaire.
    M.message = Object.keys(M.erreurs).length > 0 ? null : { type: "erreur", texte: erreur.message };
  }

  M.envoiEnCours = false;
  V.rafraichir();
};

C.init = async function () {
  definirMetadonnees({ titre: "Créer un compte" });
  M.erreurs = {};
  M.message = null;
  M.envoiEnCours = false;

  // Déjà connecté : inutile de créer un compte. La navigation lancée ici
  // remplace celle de cette page, qui n'est jamais affichée.
  try {
    if ((await AuthData.moi()).connecte) {
      naviguer(destinationApresConnexion().chemin);
      return "";
    }
  } catch (erreur) {
    // Serveur injoignable : le formulaire s'affiche, l'envoi signalera le problème.
  }

  return V.init();
};

let V = {};

V.racine = null; // élément racine de la page affichée

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  return fragment;
};

/**
 * Reconstruit toute la page à partir du modèle, et remplace l'ancienne.
 */
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;

  // La page est reconstruite : le focus va au premier champ en erreur, pour que
  // le clavier et les lecteurs d'écran retrouvent l'endroit à corriger.
  V.racine.querySelector('[aria-invalid="true"]')?.focus();
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  pageFragment.querySelector('slot[name="formulaire"]').replaceWith(
    FormulaireCompteView.dom(
      "inscription",
      {
        email: M.email,
        erreurs: M.erreurs,
        message: M.message,
        envoiEnCours: M.envoiEnCours,
        retour: destinationApresConnexion().retour,
      },
      { surEnvoi: C.handler_envoi }
    )
  );

  return pageFragment;
};

export function InscriptionPage() {
  return C.init();
}
