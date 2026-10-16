import { pluriel } from "../lib/format.js";

/**
 * Le panier du visiteur (CMD-b), conservé dans le stockage local du navigateur
 * (localStorage) : il survit au rechargement de la page et à la fermeture du
 * navigateur.
 *
 * Une ligne du panier correspond à une variante du catalogue (un produit avec
 * ses options). Elle garde de quoi s'afficher sans appeler l'API :
 *
 * { varianteId, produitSlug, produitNom, nom, prix: "189.99", stock,
 *   image: { moyen, alt } | null, quantite }
 *
 * Ces valeurs sont celles vues par le visiteur au moment de l'ajout. Elles ne
 * font pas foi : à la validation de la commande (CMD-a), le serveur recalcule
 * les prix et vérifie les stocks.
 */
const CLE = `${import.meta.env.BASE_URL}panier`;
const EVENEMENT = "panier:change";

let PanierData = {};

/**
 * localStorage est partagé par tous les sites d'un même domaine (mmi.unilim.fr)
 * et peut être indisponible (navigation privée, stockage bloqué) : la clé
 * contient le chemin du projet et chaque accès est protégé.
 */
function lireStockage() {
  try {
    let lignes = JSON.parse(window.localStorage.getItem(CLE));
    return Array.isArray(lignes) ? lignes : [];
  } catch (erreur) {
    return [];
  }
}

function ecrireStockage(lignes) {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(lignes));
  } catch (erreur) {
    // Stockage plein ou bloqué : le panier reste valable jusqu'au prochain
    // rechargement de la page.
  }
}

/**
 * Une ligne lue dans le stockage peut avoir été modifiée à la main ou venir
 * d'une version plus ancienne : on ne garde que les lignes complètes, avec une
 * quantité entière comprise entre 1 et le stock connu.
 */
function ligneValide(ligne) {
  return (
    ligne !== null &&
    typeof ligne === "object" &&
    Number.isInteger(ligne.varianteId) &&
    typeof ligne.produitSlug === "string" &&
    typeof ligne.produitNom === "string" &&
    typeof ligne.nom === "string" &&
    typeof ligne.prix === "string" &&
    Number.isFinite(Number(ligne.prix)) &&
    Number.isInteger(ligne.stock) &&
    ligne.stock > 0 &&
    Number.isInteger(ligne.quantite) &&
    ligne.quantite > 0
  );
}

// Copie en mémoire, relue dans le stockage à chaque accès pour suivre les
// modifications faites dans un autre onglet.
function lignes() {
  return lireStockage()
    .filter(ligneValide)
    .map((ligne) => ({ ...ligne, quantite: Math.min(ligne.quantite, ligne.stock) }));
}

function enregistrer(nouvelles) {
  ecrireStockage(nouvelles);
  window.dispatchEvent(new CustomEvent(EVENEMENT));
}

/**
 * Les lignes du panier, dans l'ordre d'ajout.
 */
PanierData.lignes = function () {
  return lignes();
};

/**
 * Nombre d'articles (somme des quantités), affiché à côté de l'icône panier.
 */
PanierData.nombreArticles = function () {
  return lignes().reduce((somme, ligne) => somme + ligne.quantite, 0);
};

/**
 * Prix d'une ligne et total du panier, en euros sous forme de chaîne. Le calcul
 * se fait en centimes entiers pour éviter les erreurs d'arrondi des flottants
 * (0,1 + 0,2).
 */
PanierData.totalLigne = function (ligne) {
  return (Math.round(Number(ligne.prix) * 100) * ligne.quantite) / 100;
};

PanierData.total = function () {
  return lignes().reduce((somme, ligne) => somme + Math.round(Number(ligne.prix) * 100) * ligne.quantite, 0) / 100;
};

/**
 * L'article à mettre au panier pour une variante d'une fiche produit (réponse
 * de ProduitData.fetchOne). L'image de la variante, si elle en a une, remplace
 * l'image principale du produit.
 */
PanierData.articleDepuis = function (produit, variante) {
  let image = variante.image ?? produit.images[0] ?? null;

  return {
    varianteId: variante.id,
    produitSlug: produit.slug,
    produitNom: produit.nom,
    nom: variante.nom,
    prix: variante.prix,
    stock: variante.stock,
    image: image === null ? null : { moyen: image.moyen, alt: image.alt },
  };
};

/**
 * Ajoute une variante au panier (ou augmente sa quantité).
 *
 * @param {object} article  { varianteId, produitSlug, produitNom, nom, prix,
 *                            stock, image }
 * @param {number} quantite
 * @returns {{ok: boolean, raison?: string}}  raison : message en français
 *          quand l'ajout est refusé
 */
PanierData.ajouter = function (article, quantite = 1) {
  if (article.stock <= 0) {
    return { ok: false, raison: `${article.nom} est épuisé.` };
  }

  let courantes = lignes();
  let existante = courantes.find((ligne) => ligne.varianteId === article.varianteId);
  let dejaDansLePanier = existante === undefined ? 0 : existante.quantite;

  if (dejaDansLePanier + quantite > article.stock) {
    return {
      ok: false,
      raison:
        dejaDansLePanier === 0
          ? `Stock insuffisant : ${article.stock} disponible(s) seulement.`
          : `Vous avez déjà ${pluriel(dejaDansLePanier, "article")} de ce modèle dans votre panier, et il n'y en a que ${article.stock} en stock.`,
    };
  }

  if (existante === undefined) {
    courantes.push({ ...article, quantite });
  } else {
    existante.quantite += quantite;
    existante.stock = article.stock; // on garde la valeur la plus récente
  }

  enregistrer(courantes);
  return { ok: true };
};

/**
 * Fixe la quantité d'une ligne. Une quantité hors limites est ramenée dans
 * l'intervalle 1 à stock.
 *
 * @returns {{ok: boolean, quantite?: number, raison?: string}}
 */
PanierData.changerQuantite = function (varianteId, quantite) {
  let courantes = lignes();
  let ligne = courantes.find((l) => l.varianteId === varianteId);

  if (ligne === undefined) {
    return { ok: false, raison: "Cet article n'est plus dans votre panier." };
  }

  if (!Number.isInteger(quantite) || quantite < 1) {
    return { ok: false, raison: "La quantité doit être un nombre entier d'au moins 1." };
  }

  if (quantite > ligne.stock) {
    ligne.quantite = ligne.stock;
    enregistrer(courantes);
    return { ok: false, quantite: ligne.stock, raison: `Stock insuffisant : ${ligne.stock} disponible(s) seulement.` };
  }

  ligne.quantite = quantite;
  enregistrer(courantes);
  return { ok: true, quantite };
};

PanierData.supprimer = function (varianteId) {
  enregistrer(lignes().filter((ligne) => ligne.varianteId !== varianteId));
};

PanierData.vider = function () {
  enregistrer([]);
};

/**
 * Appelle fn à chaque changement du panier, dans cet onglet comme dans les
 * autres onglets ouverts sur le site. Renvoie la fonction qui annule l'abonnement.
 */
PanierData.surChangement = function (fn) {
  let surStockage = (ev) => {
    if (ev.key === CLE || ev.key === null) {
      fn();
    }
  };

  window.addEventListener(EVENEMENT, fn);
  window.addEventListener("storage", surStockage);

  return function () {
    window.removeEventListener(EVENEMENT, fn);
    window.removeEventListener("storage", surStockage);
  };
};

export { PanierData };
