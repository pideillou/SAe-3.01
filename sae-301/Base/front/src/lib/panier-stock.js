import { PanierData } from "../data/panier.js";
import { StockData } from "../data/stock.js";
import { formaterPrix, pluriel } from "./format.js";

/**
 * Contraintes de stock du panier (STK-c) : le panier est conservé dans le
 * navigateur (CMD-b), le stock réel est dans la base. Ce module confronte les
 * deux, côté serveur, avant chaque ajout et à l'ouverture du panier.
 */

/**
 * Ajoute une variante au panier après avoir demandé au serveur si la quantité
 * résultante est disponible. Le serveur fait foi : le contrôle local de
 * PanierData.ajouter ne sert qu'à répondre sans attendre.
 *
 * @param {object} article  voir PanierData.articleDepuis
 * @returns {Promise<{ok: boolean, raison?: string}>}
 */
export async function ajouterAuPanier(article) {
  let existante = PanierData.lignes().find((ligne) => ligne.varianteId === article.varianteId);
  let dejaDansLePanier = existante === undefined ? 0 : existante.quantite;

  // Contrôle local, avant même d'interroger le serveur.
  if (article.stock <= 0) {
    return { ok: false, raison: `${article.nom} est épuisé.` };
  }

  let reponse;
  try {
    reponse = (await StockData.verifier([{ varianteId: article.varianteId, quantite: dejaDansLePanier + 1 }])).lignes[0];
  } catch (erreur) {
    return { ok: false, raison: `Impossible de vérifier le stock : ${erreur.message}` };
  }

  if (reponse.statut === "inconnue") {
    // Le produit a disparu du catalogue : s'il était déjà dans le panier, on l'en retire.
    PanierData.appliquerVerification([reponse]);
    return { ok: false, raison: `${article.nom} n'est plus disponible.` };
  }

  if (reponse.statut === "epuisee") {
    PanierData.appliquerVerification([reponse]);
    return { ok: false, raison: `${reponse.nom} est épuisé.` };
  }

  if (reponse.statut === "ajustee") {
    // Le stock réel est inférieur à la quantité souhaitée : le panier est remis
    // à jour avec ce que le serveur accepte.
    PanierData.appliquerVerification([reponse]);

    return {
      ok: false,
      raison:
        dejaDansLePanier === 0
          ? `Stock insuffisant : il ne reste que ${pluriel(reponse.stock, "exemplaire")} de ${reponse.nom}.`
          : `Stock insuffisant : il ne reste que ${pluriel(reponse.stock, "exemplaire")} de ${reponse.nom}, et votre panier en contient déjà ${dejaDansLePanier}.`,
    };
  }

  // Le stock et le prix du serveur remplacent ceux que le navigateur avait.
  return PanierData.ajouter({
    ...article,
    nom: reponse.nom,
    prix: reponse.prix,
    stock: reponse.stock,
  });
}

/**
 * Met tout le panier en conformité avec le stock réel : quantités ramenées au
 * stock, lignes épuisées ou supprimées retirées, prix mis à jour.
 *
 * @returns {Promise<string[]>}  un message en français par changement, à
 *          afficher au visiteur (tableau vide : rien n'a changé)
 */
export async function synchroniserPanier() {
  let lignes = PanierData.lignes();

  if (lignes.length === 0) {
    return [];
  }

  let reponse = await StockData.verifier(
    lignes.map((ligne) => ({ varianteId: ligne.varianteId, quantite: ligne.quantite }))
  );

  return PanierData.appliquerVerification(reponse.lignes).map(messageDeChangement);
}

function messageDeChangement(changement) {
  switch (changement.type) {
    case "retiree":
      return `${changement.nom} est épuisé : l'article a été retiré de votre panier.`;
    case "supprimee":
      return `${changement.nom} n'est plus disponible : l'article a été retiré de votre panier.`;
    case "ajustee":
      return `Il ne reste que ${pluriel(changement.quantite, "exemplaire")} de ${changement.nom} : la quantité de votre panier a été ajustée.`;
    case "prix":
      return `Le prix de ${changement.nom} est passé de ${formaterPrix(changement.ancien)} à ${formaterPrix(changement.nouveau)}.`;
  }
}
