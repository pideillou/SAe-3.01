import { Router } from "./lib/router.js";
import { RootLayout } from "./layouts/root/layout.js";
import { CataloguePage } from "./pages/catalogue/page.js";
import { AdminPage } from "./pages/admin/page.js";
import { AdminConnexionPage } from "./pages/admin-connexion/page.js";
import { ConnexionPage } from "./pages/connexion/page.js";
import { EspacePersonnelPage } from "./pages/espace-personnel/page.js";
import { InscriptionPage } from "./pages/inscription/page.js";
import { PanierPage } from "./pages/panier/page.js";
import { ProduitPage } from "./pages/produit/page.js";
import { The404Page } from "./pages/404/page.js";

// base : chemin du projet sur le serveur (BASE dans vite.config.js).
const router = new Router("app", { base: import.meta.env.BASE_URL });

router.addLayout("/", RootLayout);

router.addRoute("/", CataloguePage);
router.addRoute("/categorie/:slug", CataloguePage); // params.slug dans la page
router.addRoute("/produit/:slug", ProduitPage); // params.slug dans la page
router.addRoute("/panier", PanierPage);
router.addRoute("/connexion", ConnexionPage);
router.addRoute("/inscription", InscriptionPage);
router.addRoute("/espace-personnel", EspacePersonnelPage);
router.addRoute("/admin", AdminPage);
router.addRoute("/admin/connexion", AdminConnexionPage);

// En dernier : toute adresse qui ne correspond à aucune route.
router.addRoute("*", The404Page);

// Démarrer le routeur
router.start();
