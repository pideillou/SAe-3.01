import { AdminAuthData } from "../../data/admin-auth.js";
import { naviguer } from "../../lib/navigation.js";
import { htmlToFragment, urlPublique } from "../../lib/utils.js";
import { NavigationAdminView } from "../../ui/navigation-admin/index.js";
import template from "./template.html?raw";

// Les sections du back-office. Chaque nouvelle section d'administration (produits,
// catégories, commandes…) ajoute une ligne ici, une fois sa page écrite.
const SECTIONS = [
  { libelle: "Tableau de bord", chemin: "/admin" },
  { libelle: "Produits", chemin: "/admin/produits" },
  { libelle: "Catégories", chemin: "/admin/categories" },
  { libelle: "Commandes", chemin: "/admin/commandes" },
];

/**
 * Layout du back-office : une colonne de navigation à gauche (en haut sur
 * mobile), distincte de l'en-tête du site, puis la page affichée. La page, elle,
 * décide de l'accès : c'est le serveur qui refuse sans session administrateur.
 *
 * @returns {DocumentFragment}
 */
export function AdminLayout() {
  let layout = htmlToFragment(template);

  layout.querySelector('slot[name="navigation"]').replaceWith(
    NavigationAdminView.dom([...SECTIONS, { libelle: "Voir le site", chemin: "/" }])
  );

  let session = layout.querySelector("[data-session]");

  // L'adresse du compte arrive après l'affichage : le layout n'attend pas.
  AdminAuthData.moi()
    .then((etat) => {
      if (etat.connecte) {
        session.querySelector("[data-email]").textContent = etat.email;
        session.hidden = false;
      }
    })
    .catch(() => {
      // Le bloc de session reste caché : la page affiche elle-même l'erreur.
    });

  session.querySelector('[data-action="deconnexion"]').addEventListener("click", async () => {
    try {
      await AdminAuthData.logout();
    } finally {
      naviguer("admin/connexion");
    }
  });

  return layout;
}
