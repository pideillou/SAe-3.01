import { PanierData } from "../../data/panier.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import logo from "../../assets/logo-razer.webp";
import iconeAdmin from "../../assets/admin.svg";
import iconeFermer from "../../assets/fermer.svg";
import iconeHistorique from "../../assets/historique.svg";
import iconeMenu from "../../assets/menu.svg";
import iconePanier from "../../assets/panier.svg";
import iconePanierVert from "../../assets/panier-vert.svg";
import iconeUtilisateur from "../../assets/utilisateur.svg";
import iconeUtilisateurVert from "../../assets/utilisateur-vert.svg";
import template from "./template.html?raw";
import templateLienMenu from "./lien-menu.html?raw";

// En-tête du site, d'après le Figma : logo, accès Admin, Espace personnel et
// Panier avec son compteur ; sur mobile, un bouton ouvre le menu plein écran.
// L'ouverture du menu est un état d'affichage, géré ici : la page n'en sait rien.
let HeaderView = {
  html: function () {
    return genericRenderer(template, {
      logo, iconeAdmin, iconeFermer, iconeHistorique, iconeMenu, iconePanier,
      iconePanierVert, iconeUtilisateur, iconeUtilisateurVert,
    });
  },

  dom: function () {
    let fragment = htmlToFragment(HeaderView.html());
    let racine = fragment.firstElementChild;

    let menu = racine.querySelector("[data-menu]");
    let ouvrir = racine.querySelector('[data-action="ouvrir-menu"]');
    let fermer = racine.querySelector('[data-action="fermer-menu"]');

    let afficherMenu = function (ouvert) {
      menu.hidden = !ouvert;
      ouvrir.setAttribute("aria-expanded", String(ouvert));
      // Le focus suit : sur le bouton de fermeture à l'ouverture, sur celui
      // d'ouverture à la fermeture.
      (ouvert ? fermer : ouvrir).focus();
    };

    ouvrir.addEventListener("click", () => afficherMenu(true));
    fermer.addEventListener("click", () => afficherMenu(false));
    menu.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        afficherMenu(false);
      }
    });

    // Compteur du panier (icône de l'en-tête et menu mobile) : il suit les
    // modifications du panier, y compris celles d'un autre onglet. Le layout est
    // reconstruit à chaque page : l'abonnement s'arrête quand cet en-tête a été
    // retiré de la page.
    let afficherCompteur = function () {
      if (!racine.isConnected) {
        arreter();
        return;
      }
      let nombre = String(PanierData.nombreArticles());
      for (let compteur of racine.querySelectorAll("[data-compteur-panier]")) {
        compteur.textContent = nombre;
      }
    };
    let arreter = PanierData.surChangement(afficherCompteur);

    for (let compteur of racine.querySelectorAll("[data-compteur-panier]")) {
      compteur.textContent = String(PanierData.nombreArticles());
    }

    return fragment;
  },

  /**
   * Remplit la liste des catégories du menu mobile.
   *
   * Les catégories arrivent après l'affichage de la page : le layout est
   * synchrone, et le menu n'est de toute façon visible qu'à l'ouverture.
   *
   * @param {Element} racine  l'élément <header> renvoyé par dom()
   * @param {{total: number, categories: Array<{nom, slug, nombre}>}} data
   */
  afficherCategories: function (racine, data) {
    let liste = racine.querySelector("[data-menu-categories]");

    let entrees = [
      { chemin: urlPublique(""), libelle: "Tous les produits", nombre: data.total },
      ...data.categories.map((categorie) => ({
        chemin: urlPublique(`categorie/${categorie.slug}`),
        libelle: categorie.nom,
        nombre: categorie.nombre,
      })),
    ];

    let liens = entrees.map((entree) => htmlToFragment(genericRenderer(templateLienMenu, entree)));

    // Ces liens naissent après le passage du routeur : le lien de la page
    // affichée est donc marqué ici.
    for (let lien of liens) {
      let a = lien.querySelector("a");
      if (a.pathname === window.location.pathname) {
        a.setAttribute("aria-current", "page");
      }
    }

    liste.replaceChildren(...liens);
  },
};

export { HeaderView };
