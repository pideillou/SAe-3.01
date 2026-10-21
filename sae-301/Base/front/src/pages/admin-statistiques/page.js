import { AdminAuthData } from "../../data/admin-auth.js";
import { StatsData } from "../../data/stats.js";
import { formaterDateHeure } from "../../lib/format.js";
import { naviguer } from "../../lib/navigation.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { AlerteStocksView } from "../../ui/alerte-stocks/index.js";
import { CommandesParStatutView } from "../../ui/commandes-par-statut/index.js";
import { HistogrammeStocksView } from "../../ui/histogramme-stocks/index.js";
import { MessageView } from "../../ui/message/index.js";
import { ProduitsVendusView } from "../../ui/produits-vendus/index.js";
import { RevenusSeptJoursView } from "../../ui/revenus-sept-jours/index.js";
import template from "./template.html?raw";

/**
 * Page « Statistiques » du back-office (PIL-a), à l'adresse /admin/statistiques :
 * alerte de stocks faibles, revenus des 7 derniers jours, commandes par statut,
 * produits les plus vendus et histogramme des stocks.
 *
 * Les chiffres sont lus dans la base à chaque ouverture de la page et à chaque
 * clic sur « Actualiser » : aucune copie n'est gardée. Le bouton d'export
 * télécharge les mêmes statistiques en CSV.
 *
 * La page ne protège rien : c'est le serveur qui décide de l'accès (session
 * administrateur) ; sans session, la page envoie vers /admin/connexion.
 */

let M = {
  stats: null, // les statistiques du serveur, ou null
  message: null, // { type, texte }, ou null
  occupe: false, // un chargement ou un export est en cours
};

let C = {};

/**
 * Lit les statistiques. En cas d'échec la page garde celles qu'elle avait et
 * affiche pourquoi.
 *
 * @returns {Promise<boolean>}  faux si le visiteur a été renvoyé vers la connexion
 */
C.charger = async function () {
  try {
    M.stats = await StatsData.fetchStatistiques();
  } catch (erreur) {
    if (erreur.statut === 401) {
      naviguer("admin/connexion");
      return false;
    }

    M.message = { type: "erreur", texte: `Impossible de charger les statistiques : ${erreur.message}` };
  }

  return true;
};

C.init = async function () {
  definirMetadonnees({ titre: "Statistiques" });
  M.stats = null;
  M.message = null;
  M.occupe = false;

  try {
    if (!(await AdminAuthData.moi()).connecte) {
      naviguer("admin/connexion");
      return "";
    }
  } catch (erreur) {
    M.message = { type: "erreur", texte: `Impossible de vérifier votre connexion : ${erreur.message}` };
    return V.init();
  }

  if (!(await C.charger())) {
    return "";
  }

  return V.init();
};

C.handler_actualiser = async function () {
  M.message = null;
  M.occupe = true;
  V.rafraichir();

  let reste = await C.charger();
  M.occupe = false;

  if (reste) {
    V.rafraichir();
  }
};

C.handler_exporter = async function () {
  M.message = null;
  M.occupe = true;
  V.rafraichir();

  try {
    let fichier = await StatsData.exporter();

    // Le navigateur enregistre le fichier comme un téléchargement ordinaire.
    let adresse = URL.createObjectURL(fichier);
    let lien = document.createElement("a");
    lien.href = adresse;
    lien.download = `statistiques-razer-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(lien);
    lien.click();
    lien.remove();
    URL.revokeObjectURL(adresse);

    M.message = { type: "succes", texte: "Les statistiques ont été exportées au format CSV." };
  } catch (erreur) {
    if (erreur.statut === 401) {
      naviguer("admin/connexion");
      return;
    }

    M.message = { type: "erreur", texte: `Export impossible : ${erreur.message}` };
  }

  M.occupe = false;
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
};

V.createPageFragment = function () {
  let stats = M.stats;

  let pageFragment = htmlToFragment(
    genericRenderer(template, {
      genereLe: stats === null ? "" : `Données lues dans la base le ${formaterDateHeure(stats.genereLe)}.`,
    })
  );

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let actualiser = pageFragment.querySelector('[data-action="actualiser"]');
  let exporter = pageFragment.querySelector('[data-action="exporter"]');
  actualiser.disabled = M.occupe;
  exporter.disabled = M.occupe || stats === null;
  actualiser.addEventListener("click", C.handler_actualiser);
  exporter.addEventListener("click", C.handler_exporter);

  // Sans statistiques (chargement impossible), il n'y a rien à montrer d'autre que le message.
  if (stats === null) {
    pageFragment.querySelector("[data-contenu]").remove();
    pageFragment.querySelector("[data-genere]").remove();
    return pageFragment;
  }

  pageFragment.querySelector('slot[name="alerte"]').replaceWith(AlerteStocksView.dom(stats.stocksFaibles, stats.seuil));
  pageFragment.querySelector('slot[name="revenus"]').replaceWith(RevenusSeptJoursView.dom(stats.revenus));
  pageFragment.querySelector('slot[name="commandes"]').replaceWith(CommandesParStatutView.dom(stats.commandes));
  pageFragment.querySelector('slot[name="vendus"]').replaceWith(ProduitsVendusView.dom(stats.plusVendus));
  pageFragment.querySelector('slot[name="stocks"]').replaceWith(HistogrammeStocksView.dom(stats.stocks, stats.seuil));

  return pageFragment;
};

export function AdminStatistiquesPage() {
  return C.init();
}
