import { AuthData } from "../../data/auth.js";
import { CommandeData } from "../../data/commande.js";
import { PanierData } from "../../data/panier.js";
import { naviguer, remplacer } from "../../lib/navigation.js";
import { synchroniserPanier } from "../../lib/panier-stock.js";
import { appliquerReduction } from "../../lib/promo.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { FilArianeView } from "../../ui/fil-ariane/index.js";
import { FormulaireCodePromoView } from "../../ui/formulaire-code-promo/index.js";
import { MessageView } from "../../ui/message/index.js";
import { RecapitulatifCommandeView } from "../../ui/recapitulatif-commande/index.js";
import template from "./template.html?raw";

/**
 * Page « Valider ma commande » (CMD-a), à l'adresse /commande : récapitulatif
 * complet du panier, puis un clic explicite sur « Confirmer ma commande ».
 *
 * Réservée aux clients connectés : un visiteur est envoyé vers la connexion,
 * qui le ramène ici ensuite. Le panier est d'abord confronté au stock réel
 * (STK-c) ; la commande, elle, est enregistrée par le serveur, qui relit prix
 * et stocks en base. Un code promotionnel (PRO-a) peut être saisi : le serveur
 * le vérifie, la page affiche la réduction, et le serveur la recalcule à
 * l'enregistrement de la commande. Le panier n'est vidé qu'une fois la commande enregistrée.
 */

let M = {
  email: "", // compte connecté
  lignes: [], // lignes du panier
  messages: [], // [{ type, texte }] affichés en haut de page
  envoiEnCours: false, // commande en cours d'enregistrement
  promo: null, // { code, pourcentage } : le code promotionnel appliqué, ou null
  saisieCode: "", // texte du champ « Code promo »
  erreurCode: "", // message sous le champ, ou ""
  verifCodeEnCours: false, // un code est en cours de vérification
};

let C = {};

C.charger = function () {
  M.lignes = PanierData.lignes();
};

C.init = async function () {
  definirMetadonnees({ titre: "Valider ma commande" });
  M.messages = [];
  M.envoiEnCours = false;
  M.promo = null;
  M.saisieCode = "";
  M.erreurCode = "";
  M.verifCodeEnCours = false;

  try {
    let etat = await AuthData.moi();

    if (!etat.connecte) {
      remplacer("connexion?retour=commande");
      return "";
    }

    M.email = etat.email;
  } catch (erreur) {
    M.email = "";
    M.lignes = [];
    M.messages = [{ type: "erreur", texte: `Impossible de vérifier votre connexion : ${erreur.message}` }];
    return V.init();
  }

  C.charger();
  M.messages = await C.synchroniser();
  return V.init();
};

/**
 * Remet le panier en accord avec le stock réel, et renvoie les messages qui
 * expliquent ce qui a changé.
 */
C.synchroniser = async function () {
  try {
    let messages = await synchroniserPanier();
    C.charger();
    return messages.map((texte) => ({ type: "erreur", texte }));
  } catch (erreur) {
    return [{ type: "erreur", texte: `Le stock n'a pas pu être vérifié : ${erreur.message}` }];
  }
};

/**
 * Vérifie le code saisi auprès du serveur. S'il est valide, sa réduction
 * s'affiche dans le récapitulatif.
 */
C.handler_appliquerCode = async function (code) {
  M.saisieCode = code;
  M.erreurCode = "";

  if (code === "") {
    M.erreurCode = "Saisissez un code promo.";
    V.rafraichir();
    V.racine.querySelector("#champ-code-promo")?.focus();
    return;
  }

  M.verifCodeEnCours = true;
  V.rafraichir();

  try {
    let { code: valide, pourcentage } = await CommandeData.verifierCode(code);

    M.promo = { code: valide, pourcentage };
    M.saisieCode = "";
  } catch (erreur) {
    if (erreur.statut === 401) {
      remplacer("connexion?retour=commande");
      return;
    }

    M.erreurCode = erreur.champs?.codePromo ?? erreur.message;
  }

  M.verifCodeEnCours = false;
  V.rafraichir();
  V.racine.querySelector("#champ-code-promo")?.focus();
};

C.handler_retirerCode = function () {
  M.promo = null;
  M.erreurCode = "";
  V.rafraichir();
  V.racine.querySelector("#champ-code-promo")?.focus();
};

C.handler_confirmer = async function () {
  M.envoiEnCours = true;
  M.messages = [];
  V.rafraichir();

  try {
    let { commande } = await CommandeData.creer(
      M.lignes.map((ligne) => ({ varianteId: ligne.varianteId, quantite: ligne.quantite })),
      M.promo === null ? null : M.promo.code
    );

    // La commande est enregistrée : seulement maintenant, le panier est vidé.
    PanierData.vider();
    naviguer(`commande/${commande.numero}`);
    return;
  } catch (erreur) {
    if (erreur.statut === 401) {
      remplacer("connexion?retour=commande");
      return;
    }

    M.messages = [{ type: "erreur", texte: erreur.message }];

    // Le code a été refusé par le serveur (désactivé entre-temps) : la commande
    // n'est pas enregistrée, le visiteur la revalide sans réduction ou avec un autre code.
    if (erreur.statut === 422 && erreur.champs?.codePromo !== undefined) {
      M.promo = null;
      M.erreurCode = erreur.champs.codePromo;
    }

    if (erreur.statut === 409) {
      // Le stock a changé : le panier est corrigé, et le visiteur revoit le
      // récapitulatif à jour avant de confirmer à nouveau.
      M.messages.push(...(await C.synchroniser()));
    }
  }

  M.envoiEnCours = false;
  V.rafraichir();
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
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(
    genericRenderer(template, {
      cheminCatalogue: urlPublique(""),
      cheminPanier: urlPublique("panier"),
      email: M.email,
    })
  );

  pageFragment.querySelector('slot[name="fil-ariane"]').replaceWith(
    FilArianeView.dom([
      { libelle: "Catalogue", chemin: urlPublique("") },
      { libelle: "Panier", chemin: urlPublique("panier") },
      { libelle: "Validation" },
    ])
  );
  pageFragment
    .querySelector('slot[name="message"]')
    .replaceWith(...M.messages.map((message) => MessageView.dom(message)));

  if (M.lignes.length === 0 || M.email === "") {
    pageFragment.querySelector("[data-contenu]").remove();
    if (M.email === "") {
      pageFragment.querySelector("[data-vide]").remove();
    }
    return pageFragment;
  }

  pageFragment.querySelector("[data-vide]").remove();

  // Avec un code appliqué : sous-total, réduction et total à payer.
  let sousTotal = PanierData.total();
  let calcul = M.promo === null ? null : appliquerReduction(sousTotal, M.promo.pourcentage);
  let total = calcul === null ? sousTotal : calcul.total;
  let reduction =
    calcul === null
      ? null
      : { code: M.promo.code, pourcentage: M.promo.pourcentage, montant: calcul.montant, sousTotal: calcul.sousTotal };

  pageFragment.querySelector('slot[name="recapitulatif"]').replaceWith(
    RecapitulatifCommandeView.dom(
      M.lignes.map((ligne) => ({
        nom: ligne.nom,
        produitNom: ligne.produitNom,
        options: ligne.options,
        image: ligne.image === null ? null : ligne.image.moyen,
        prixUnitaire: ligne.prix,
        quantite: ligne.quantite,
      })),
      total,
      reduction
    )
  );

  pageFragment.querySelector('slot[name="code-promo"]').replaceWith(
    FormulaireCodePromoView.dom(
      { saisie: M.saisieCode, erreur: M.erreurCode, applique: M.promo, envoiEnCours: M.verifCodeEnCours },
      { surApplication: C.handler_appliquerCode, surRetrait: C.handler_retirerCode }
    )
  );

  let bouton = pageFragment.querySelector('[data-action="confirmer"]');
  bouton.disabled = M.envoiEnCours;
  bouton.addEventListener("click", C.handler_confirmer);

  return pageFragment;
};

export function CommandePage() {
  return C.init();
}
