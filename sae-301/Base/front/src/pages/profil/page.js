import { ProfilData } from "../../data/profil.js";
import { naviguer } from "../../lib/navigation.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { htmlToFragment } from "../../lib/utils.js";
import { erreursChangementMotDePasse, erreursProfil } from "../../lib/validation-compte.js";
import { FormulaireMotDePasseView } from "../../ui/formulaire-mot-de-passe/index.js";
import { FormulaireProfilView } from "../../ui/formulaire-profil/index.js";
import { MessageView } from "../../ui/message/index.js";
import { NavigationEspaceView } from "../../ui/navigation-espace/index.js";
import template from "./template.html?raw";

/**
 * Page « Mon profil » (SUI-b), à l'adresse /espace-personnel/profil : modifier
 * son nom, son adresse e-mail et son mot de passe. Changer de mot de passe
 * exige le mot de passe actuel, vérifié par le serveur.
 *
 * Les mots de passe ne sont jamais gardés dans le modèle : ils ne sont lus que
 * dans le formulaire, au moment de l'envoi.
 */

const ETAT_VIDE = { erreurs: {}, message: null, envoiEnCours: false };

let M = {
  charge: false, // le profil a été lu
  message: null, // erreur générale de la page
  nom: "", // valeurs affichées dans le formulaire d'informations
  email: "",
  profil: { ...ETAT_VIDE }, // état du formulaire d'informations
  motDePasse: { ...ETAT_VIDE }, // état du formulaire de mot de passe
};

let C = {};

C.init = async function () {
  definirMetadonnees({ titre: "Mon profil" });
  M.charge = false;
  M.message = null;
  M.profil = { ...ETAT_VIDE };
  M.motDePasse = { ...ETAT_VIDE };

  try {
    let { profil } = await ProfilData.fetch();

    M.nom = profil.nom;
    M.email = profil.email;
    M.charge = true;
  } catch (erreur) {
    if (erreur.statut === 401) {
      naviguer("connexion?retour=espace-personnel/profil");
      return "";
    }

    M.message = { type: "erreur", texte: `Impossible de charger votre profil : ${erreur.message}` };
  }

  return V.init();
};

C.handler_profil = async function ({ nom, email }) {
  M.nom = nom;
  M.email = email;
  M.profil = { erreurs: erreursProfil({ nom, email }), message: null, envoiEnCours: false };

  if (Object.keys(M.profil.erreurs).length > 0) {
    V.rafraichir();
    return;
  }

  M.profil.envoiEnCours = true;
  V.rafraichir();

  try {
    let { profil } = await ProfilData.modifier(nom, email);

    M.nom = profil.nom;
    M.email = profil.email;
    M.profil = { erreurs: {}, message: { type: "succes", texte: "Vos informations ont été enregistrées." }, envoiEnCours: false };
  } catch (erreur) {
    let erreurs = erreur.champs ?? {};
    M.profil = {
      erreurs,
      message: Object.keys(erreurs).length > 0 ? null : { type: "erreur", texte: erreur.message },
      envoiEnCours: false,
    };
  }

  V.rafraichir();
};

C.handler_motDePasse = async function ({ actuel, nouveau, confirmation }) {
  M.motDePasse = { erreurs: erreursChangementMotDePasse({ actuel, nouveau, confirmation }), message: null, envoiEnCours: false };

  if (Object.keys(M.motDePasse.erreurs).length > 0) {
    V.rafraichir();
    return;
  }

  M.motDePasse.envoiEnCours = true;
  V.rafraichir();

  try {
    await ProfilData.changerMotDePasse(actuel, nouveau, confirmation);
    M.motDePasse = { erreurs: {}, message: { type: "succes", texte: "Votre mot de passe a été modifié." }, envoiEnCours: false };
  } catch (erreur) {
    let erreurs = erreur.champs ?? {};
    M.motDePasse = {
      erreurs,
      message: Object.keys(erreurs).length > 0 ? null : { type: "erreur", texte: erreur.message },
      envoiEnCours: false,
    };
  }

  V.rafraichir();
};

let V = {};

V.racine = null; // élément racine de la page affichée

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  return fragment;
};

V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;

  // La page est reconstruite : le focus va au premier champ en erreur.
  V.racine.querySelector('[aria-invalid="true"]')?.focus();
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  pageFragment.querySelector('slot[name="navigation"]').replaceWith(NavigationEspaceView.dom("profil"));
  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  if (!M.charge) {
    pageFragment.querySelector("[data-contenu]").remove();
    return pageFragment;
  }

  pageFragment.querySelector('slot[name="profil"]').replaceWith(
    FormulaireProfilView.dom({ nom: M.nom, email: M.email, ...M.profil }, { surEnvoi: C.handler_profil })
  );
  pageFragment.querySelector('slot[name="mot-de-passe"]').replaceWith(
    FormulaireMotDePasseView.dom(M.motDePasse, { surEnvoi: C.handler_motDePasse })
  );

  return pageFragment;
};

export function ProfilPage() {
  return C.init();
}
