import { getRequest, postFormData, postRequest } from "../lib/api-request.js";

let AdminProduitData = {};

/**
 * Les produits et le seuil « Bientôt épuisé » : GET /api/admin/produits
 * Réservé aux administrateurs (401 sans connexion administrateur).
 *
 * { produits: [ { id, nom, slug, categorie, variantes, stockTotal,
 *                 etat: "en-stock" | "bientot-epuise" | "epuise",
 *                 prixMin, prixMax }, … ],
 *   seuil: 5 }
 */
AdminProduitData.fetchAll = async function () {
  return getRequest("admin/produits");
};

/**
 * Un produit complet : GET /api/admin/produit?id=12
 *
 * { produit: { id, nom, slug, categorieId, accroche, description,
 *              caracteristiques: [ "…", … ],
 *              options: [ { nom, valeurs: [ "Noir", "Blanc" ] }, … ],
 *              variantes: [ { id, reference, nom, prix: "99.90", stock, defaut,
 *                             valeurs: [ "Noir", "FR" ] }, … ],   // une valeur par option
 *              images: [ { id, varianteId | null, moyen, grand, alt, principale, ordre }, … ] } }
 */
AdminProduitData.fetchOne = async function (id) {
  return getRequest(`admin/produit?id=${encodeURIComponent(id)}`);
};

/**
 * Création : POST /api/admin/produits. Même corps que la modification, sans id.
 * Un formulaire refusé donne une ErreurApi (422 ou 409) dont « champs » est un
 * message par champ, indexé par chemin : « nom », « variantes.2.prix »…
 */
AdminProduitData.creer = async function (donnees) {
  return postRequest("admin/produits", donnees);
};

/**
 * Modification : POST /api/admin/produits/modifier
 * Le corps porte l'id du produit, et l'id des variantes déjà existantes (pour
 * les conserver : les paniers et les images s'y réfèrent).
 */
AdminProduitData.modifier = async function (id, donnees) {
  return postRequest("admin/produits/modifier", { id, ...donnees });
};

/**
 * Suppression : POST /api/admin/produits/supprimer  { id }
 */
AdminProduitData.supprimer = async function (id) {
  return postRequest("admin/produits/supprimer", { id });
};

/**
 * Seuil « Bientôt épuisé » : POST /api/admin/seuil  { valeur }
 */
AdminProduitData.definirSeuil = async function (valeur) {
  return postRequest("admin/seuil", { valeur });
};

/**
 * Téléversement d'une image : POST /api/admin/images (multipart)
 * Champs : produitId, varianteId (facultatif : image propre à une variante),
 * alt (texte alternatif) et le fichier « image » (JPEG, PNG ou WebP, 2 Mo au plus).
 */
AdminProduitData.ajouterImage = async function ({ produitId, varianteId, alt, fichier }) {
  let formulaire = new FormData();
  formulaire.append("produitId", String(produitId));
  if (varianteId !== null) {
    formulaire.append("varianteId", String(varianteId));
  }
  formulaire.append("alt", alt);
  formulaire.append("image", fichier);

  return postFormData("admin/images", formulaire);
};

AdminProduitData.definirImagePrincipale = async function (id) {
  return postRequest("admin/images/principale", { id });
};

AdminProduitData.modifierTexteImage = async function (id, alt) {
  return postRequest("admin/images/alt", { id, alt });
};

AdminProduitData.supprimerImage = async function (id) {
  return postRequest("admin/images/supprimer", { id });
};

export { AdminProduitData };
