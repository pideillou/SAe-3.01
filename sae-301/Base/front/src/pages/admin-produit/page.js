import { AdminAuthData } from "../../data/admin-auth.js";
import { AdminCategorieData } from "../../data/admin-categorie.js";
import { AdminProduitData } from "../../data/admin-produit.js";
import { naviguer, remplacer } from "../../lib/navigation.js";
import { definirMetadonnees } from "../../lib/seo.js";
import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { brouillonDepuis, brouillonVide, preparerProduit, varianteVide } from "../../lib/validation-produit.js";
import { FormulaireProduitView } from "../../ui/formulaire-produit/index.js";
import { GalerieAdminProduitView } from "../../ui/galerie-admin-produit/index.js";
import { MessageView } from "../../ui/message/index.js";
import { The404Page } from "../404/page.js";
import template from "./template.html?raw";

/**
 * Page d'un produit du back-office (GOF-a) : création (/admin/produits/nouveau)
 * et modification (/admin/produits/:id). Le formulaire couvre les informations,
 * les options, les variantes avec leur prix et leur stock ; la gestion des
 * images (téléversement, image principale, texte alternatif, suppression)
 * vient dessous une fois le produit créé.
 *
 * Le formulaire et les images se rafraîchissent séparément : ajouter une image
 * ne doit pas effacer ce qui est en cours de saisie dans le formulaire.
 */

// Message à montrer au prochain affichage (après la création d'un produit, qui
// envoie vers sa page de modification). Le module garde sa valeur d'une navigation à l'autre.
let messageEnAttente = null;

const TYPES_IMAGE = ["image/jpeg", "image/png", "image/webp"];

let M = {
  id: null, // identifiant du produit, ou null en création
  produit: null, // le produit enregistré (réponse de l'API), ou null
  brouillon: null, // ce que montre le formulaire
  categories: [], // pour la liste de choix
  erreurs: {}, // un message par champ du formulaire, indexé par chemin
  message: null, // { type, texte }, ou null
  envoiEnCours: false,
  // Images
  erreursImage: {}, // erreurs du formulaire d'ajout d'image
  erreursAlt: {}, // erreur du texte alternatif, par id d'image
  messageImage: null,
  imageASupprimer: null,
  envoiImage: false,
};

let C = {};

/**
 * @param {{id?: string}} params  paramètres de la route ; sans id, c'est une création
 */
C.init = async function (params) {
  M.id = params.id === undefined ? null : Number(params.id);
  M.produit = null;
  M.erreurs = {};
  M.envoiEnCours = false;
  M.erreursImage = {};
  M.erreursAlt = {};
  M.messageImage = null;
  M.imageASupprimer = null;
  M.envoiImage = false;
  M.message = messageEnAttente;
  messageEnAttente = null;

  if (M.id !== null && !Number.isInteger(M.id)) {
    return The404Page();
  }

  try {
    if (!(await AdminAuthData.moi()).connecte) {
      remplacer("admin/connexion");
      return "";
    }

    M.categories = (await AdminCategorieData.fetchAll()).categories;

    if (M.id !== null) {
      M.produit = (await AdminProduitData.fetchOne(M.id)).produit;
    }
  } catch (erreur) {
    if (erreur.statut === 401) {
      remplacer("admin/connexion");
      return "";
    }

    if (erreur.statut === 404) {
      return The404Page();
    }

    M.message = { type: "erreur", texte: `Impossible de charger la page : ${erreur.message}` };
  }

  M.brouillon = M.produit === null ? brouillonVide() : brouillonDepuis(M.produit);
  definirMetadonnees({ titre: `${M.produit === null ? "Nouveau produit" : M.produit.nom} - Back-office` });

  return V.init();
};

/**
 * Une erreur de l'API sur le formulaire : un 401 renvoie vers la connexion, une
 * erreur de saisie (422, 409) est montrée à côté des champs.
 * Renvoie true si la page doit s'arrêter là.
 */
C.traiterErreur = function (erreur, prefixe) {
  if (erreur.statut === 401) {
    remplacer("admin/connexion");
    return true;
  }

  M.erreurs = erreur.champs ?? {};
  M.message =
    Object.keys(M.erreurs).length > 0
      ? { type: "erreur", texte: erreur.message }
      : { type: "erreur", texte: `${prefixe} ${erreur.message}` };
  return false;
};

C.handler_envoi = async function (brouillon) {
  M.brouillon = brouillon;
  M.message = null;

  let { donnees, erreurs } = preparerProduit(brouillon);
  M.erreurs = erreurs;

  if (Object.keys(erreurs).length > 0) {
    M.message = { type: "erreur", texte: "Le formulaire contient des erreurs : corrigez les champs signalés." };
    V.rafraichir();
    return;
  }

  M.envoiEnCours = true;
  V.rafraichirFormulaire();

  try {
    if (M.id === null) {
      let { produit } = await AdminProduitData.creer(donnees);

      messageEnAttente = {
        type: "succes",
        texte: `Le produit « ${produit.nom} » a été créé. Vous pouvez maintenant ajouter ses images.`,
      };
      naviguer(`admin/produits/${produit.id}`);
      return;
    }

    let { produit } = await AdminProduitData.modifier(M.id, donnees);

    M.produit = produit;
    M.brouillon = brouillonDepuis(produit);
    M.erreurs = {};
    M.message = { type: "succes", texte: `Le produit « ${produit.nom} » a été enregistré.` };
  } catch (erreur) {
    if (C.traiterErreur(erreur, "Enregistrement impossible :")) {
      return;
    }
  }

  M.envoiEnCours = false;
  V.rafraichir();
};

/**
 * Ajout et retrait d'options et de variantes : le brouillon reçu est modifié,
 * puis le formulaire est reconstruit.
 */
C.modifierBrouillon = function (brouillon, modification) {
  M.brouillon = brouillon;
  M.erreurs = {};
  M.message = null;
  modification(M.brouillon);
  V.rafraichirFormulaire();
};

C.handler_ajout_option = function (brouillon) {
  C.modifierBrouillon(brouillon, (b) => {
    b.options.push({ nom: "", valeurs: "" });
    for (let variante of b.variantes) {
      variante.valeurs.push("");
    }
  });
  V.racine.querySelector("#option-nom-" + (M.brouillon.options.length - 1))?.focus();
};

C.handler_suppression_option = function (indice, brouillon) {
  C.modifierBrouillon(brouillon, (b) => {
    b.options.splice(indice, 1);
    for (let variante of b.variantes) {
      variante.valeurs.splice(indice, 1);
    }
  });
};

C.handler_ajout_variante = function (brouillon) {
  C.modifierBrouillon(brouillon, (b) => b.variantes.push(varianteVide(false)));
  V.racine.querySelector("#variante-reference-" + (M.brouillon.variantes.length - 1))?.focus();
};

C.handler_suppression_variante = function (indice, brouillon) {
  C.modifierBrouillon(brouillon, (b) => {
    let retiree = b.variantes.splice(indice, 1)[0];

    // La variante par défaut retirée : la première restante prend le relais.
    if (retiree.defaut && b.variantes.length > 0) {
      b.variantes[0].defaut = true;
    }
  });
};

// --- Images ---------------------------------------------------------------

/**
 * Relit les images du produit après une opération, et reconstruit la zone.
 */
C.rechargerImages = async function () {
  M.produit = (await AdminProduitData.fetchOne(M.id)).produit;
};

/**
 * Une erreur de l'API sur les images. Renvoie true si la page doit s'arrêter là.
 */
C.traiterErreurImage = function (erreur, prefixe) {
  if (erreur.statut === 401) {
    remplacer("admin/connexion");
    return true;
  }

  M.erreursImage = erreur.champs ?? {};
  M.messageImage = { type: "erreur", texte: Object.keys(M.erreursImage).length > 0 ? erreur.message : `${prefixe} ${erreur.message}` };
  return false;
};

C.handler_ajout_image = async function ({ fichier, varianteId, alt }) {
  M.messageImage = null;
  M.erreursImage = {};

  if (fichier === null) {
    M.erreursImage.image = "Choisissez une image à envoyer.";
  } else if (!TYPES_IMAGE.includes(fichier.type)) {
    M.erreursImage.image = "Le fichier doit être une image JPEG, PNG ou WebP.";
  } else if (fichier.size > GalerieAdminProduitView.TAILLE_MAX) {
    M.erreursImage.image = "L'image est trop lourde (2 Mo au maximum).";
  }

  if (alt.length < 3 || alt.length > 255) {
    M.erreursImage.alt = "Décrivez l'image en 3 à 255 caractères (texte alternatif, lu par les lecteurs d'écran).";
  }

  if (Object.keys(M.erreursImage).length > 0) {
    V.rafraichirImages();
    return;
  }

  M.envoiImage = true;
  V.rafraichirImages();

  try {
    await AdminProduitData.ajouterImage({ produitId: M.id, varianteId, alt, fichier });
    await C.rechargerImages();
    M.messageImage = { type: "succes", texte: "L'image a été ajoutée." };
  } catch (erreur) {
    if (C.traiterErreurImage(erreur, "Envoi impossible :")) {
      return;
    }
  }

  M.envoiImage = false;
  V.rafraichirImages();
};

C.handler_principale = async function (id) {
  M.messageImage = null;
  M.erreursImage = {};
  M.erreursAlt = {};

  try {
    await AdminProduitData.definirImagePrincipale(id);
    await C.rechargerImages();
    M.messageImage = { type: "succes", texte: "L'image principale a été changée." };
  } catch (erreur) {
    if (C.traiterErreurImage(erreur, "Modification impossible :")) {
      return;
    }
  }

  V.rafraichirImages();
};

C.handler_texte_image = async function (id, alt) {
  M.messageImage = null;
  M.erreursImage = {};
  M.erreursAlt = {};

  if (alt.length < 3 || alt.length > 255) {
    M.erreursAlt[id] = "Le texte alternatif doit faire de 3 à 255 caractères.";
    V.rafraichirImages();
    return;
  }

  try {
    await AdminProduitData.modifierTexteImage(id, alt);
    await C.rechargerImages();
    M.messageImage = { type: "succes", texte: "Le texte alternatif a été enregistré." };
  } catch (erreur) {
    if (C.traiterErreurImage(erreur, "Modification impossible :")) {
      return;
    }
  }

  V.rafraichirImages();
};

C.handler_demande_suppression_image = function (image) {
  M.imageASupprimer = image;
  M.messageImage = null;
  V.rafraichirImages();
  V.zoneImages.querySelector('[data-action="annuler"]')?.focus();
};

C.handler_annulation_suppression_image = function () {
  M.imageASupprimer = null;
  V.rafraichirImages();
};

C.handler_confirmation_suppression_image = async function () {
  let image = M.imageASupprimer;

  M.envoiImage = true;
  V.rafraichirImages();

  try {
    await AdminProduitData.supprimerImage(image.id);
    await C.rechargerImages();
    M.messageImage = { type: "succes", texte: "L'image a été supprimée." };
  } catch (erreur) {
    if (C.traiterErreurImage(erreur, "Suppression impossible :")) {
      return;
    }
  }

  M.imageASupprimer = null;
  M.envoiImage = false;
  V.rafraichirImages();
};

let V = {};

V.racine = null; // élément racine de la page affichée
V.zoneFormulaire = null; // conteneur du formulaire
V.zoneImages = null; // conteneur de la gestion des images

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  V.zoneFormulaire = V.racine.querySelector("[data-zone-formulaire]");
  V.zoneImages = V.racine.querySelector("[data-zone-images]");
  return fragment;
};

/**
 * Reconstruit toute la page (formulaire et images) à partir du modèle.
 */
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
  V.zoneFormulaire = V.racine.querySelector("[data-zone-formulaire]");
  V.zoneImages = V.racine.querySelector("[data-zone-images]");

  // Le focus va au premier champ en erreur, pour que le clavier et les lecteurs
  // d'écran retrouvent l'endroit à corriger.
  V.racine.querySelector('[aria-invalid="true"]')?.focus();
};

/**
 * Reconstruit seulement le formulaire : les images et leur saisie restent.
 */
V.rafraichirFormulaire = function () {
  V.zoneFormulaire.replaceChildren(V.formulaire());
  V.racine.querySelector('[aria-invalid="true"]')?.focus();
};

/**
 * Reconstruit seulement la gestion des images : la saisie du formulaire du
 * produit n'est pas touchée.
 */
V.rafraichirImages = function () {
  V.zoneImages.replaceChildren(V.images());
  V.zoneImages.querySelector('[aria-invalid="true"]')?.focus();
};

V.formulaire = function () {
  return FormulaireProduitView.dom(
    {
      brouillon: M.brouillon,
      categories: M.categories,
      erreurs: M.erreurs,
      enEdition: M.id !== null,
      envoiEnCours: M.envoiEnCours,
    },
    {
      surEnvoi: C.handler_envoi,
      surAjoutOption: C.handler_ajout_option,
      surSuppressionOption: C.handler_suppression_option,
      surAjoutVariante: C.handler_ajout_variante,
      surSuppressionVariante: C.handler_suppression_variante,
    }
  );
};

V.images = function () {
  if (M.produit === null) {
    return htmlToFragment(
      '<p class="border border-bordure bg-surface p-5 text-sm text-texte-secondaire">Enregistrez d\'abord le produit : vous pourrez ensuite lui ajouter des images.</p>'
    );
  }

  return GalerieAdminProduitView.dom(
    {
      images: M.produit.images,
      variantes: M.produit.variantes.map((variante) => ({ id: variante.id, nom: variante.nom })),
      erreurs: M.erreursImage,
      erreursAlt: M.erreursAlt,
      message: M.messageImage,
      aSupprimer: M.imageASupprimer,
      envoiEnCours: M.envoiImage,
    },
    {
      surAjout: C.handler_ajout_image,
      surPrincipale: C.handler_principale,
      surTexte: C.handler_texte_image,
      surDemandeSuppression: C.handler_demande_suppression_image,
      surConfirmationSuppression: C.handler_confirmation_suppression_image,
      surAnnulationSuppression: C.handler_annulation_suppression_image,
    }
  );
};

V.createPageFragment = function () {
  let produit = M.produit;

  let pageFragment = htmlToFragment(
    genericRenderer(template, {
      cheminListe: urlPublique("admin/produits"),
      titre: produit === null ? "Nouveau produit" : produit.nom,
      slug: produit === null ? "" : produit.slug,
      cheminFiche: produit === null ? "" : urlPublique(`produit/${produit.slug}`),
    })
  );

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  if (produit === null) {
    pageFragment.querySelector("[data-adresse]").remove();
  }

  pageFragment.querySelector("[data-zone-formulaire]").replaceChildren(V.formulaire());
  pageFragment.querySelector("[data-zone-images]").replaceChildren(V.images());

  return pageFragment;
};

export function AdminProduitNouveauPage() {
  return C.init({});
}

export function AdminProduitPage(params = {}) {
  return C.init(params);
}
