import { Router } from "./lib/router.js";
import { AdminLayout } from "./layouts/admin/layout.js";
import { RootLayout } from "./layouts/root/layout.js";
import { CataloguePage } from "./pages/catalogue/page.js";
import { AdminPage } from "./pages/admin/page.js";
import { AdminProduitNouveauPage, AdminProduitPage } from "./pages/admin-produit/page.js";
import { AdminProduitsPage } from "./pages/admin-produits/page.js";
import { AdminCategoriesPage } from "./pages/admin-categories/page.js";
import { AdminCommandePage } from "./pages/admin-commande/page.js";
import { AdminCommandesPage } from "./pages/admin-commandes/page.js";
import { AdminConnexionPage } from "./pages/admin-connexion/page.js";
import { CommandePage } from "./pages/commande/page.js";
import { ConfirmationCommandePage } from "./pages/confirmation-commande/page.js";
import { ConnexionPage } from "./pages/connexion/page.js";
import { EspacePersonnelPage } from "./pages/espace-personnel/page.js";
import { HistoriqueCommandesPage } from "./pages/historique-commandes/page.js";
import { ProfilPage } from "./pages/profil/page.js";
import { AdminStatistiquesPage } from "./pages/admin-statistiques/page.js";
import { InscriptionPage } from "./pages/inscription/page.js";
import { PanierPage } from "./pages/panier/page.js";
import { ProduitPage } from "./pages/produit/page.js";
import { The404Page } from "./pages/404/page.js";

// base : chemin du projet sur le serveur (BASE dans vite.config.js).
const router = new Router("app", { base: import.meta.env.BASE_URL });

router.addLayout("/", RootLayout);
router.addLayout("/admin", AdminLayout); // le préfixe le plus long l'emporte

router.addRoute("/", CataloguePage);
router.addRoute("/categorie/:slug", CataloguePage); // params.slug dans la page
router.addRoute("/produit/:slug", ProduitPage); // params.slug dans la page
router.addRoute("/panier", PanierPage);
router.addRoute("/commande", CommandePage);
router.addRoute("/commande/:numero", ConfirmationCommandePage); // params.numero
router.addRoute("/connexion", ConnexionPage);
router.addRoute("/inscription", InscriptionPage);
router.addRoute("/espace-personnel", EspacePersonnelPage);
router.addRoute("/espace-personnel/commandes", HistoriqueCommandesPage);
router.addRoute("/espace-personnel/profil", ProfilPage);
router.addRoute("/admin", AdminPage);
router.addRoute("/admin/produits", AdminProduitsPage);
// « nouveau » avant « :id » : la première route qui correspond l'emporte.
router.addRoute("/admin/produits/nouveau", AdminProduitNouveauPage);
router.addRoute("/admin/produits/:id", AdminProduitPage); // params.id
router.addRoute("/admin/categories", AdminCategoriesPage);
router.addRoute("/admin/commandes", AdminCommandesPage);
router.addRoute("/admin/statistiques", AdminStatistiquesPage);
router.addRoute("/admin/commandes/:numero", AdminCommandePage); // params.numero
// Sans layout : le visiteur n'est pas encore connecté, il n'a donc ni navigation
// d'administration ni l'en-tête du site à voir autour du formulaire.
router.addRoute("/admin/connexion", AdminConnexionPage, { useLayout: false });

// En dernier : toute adresse qui ne correspond à aucune route.
router.addRoute("*", The404Page);

// Démarrer le routeur
router.start();
