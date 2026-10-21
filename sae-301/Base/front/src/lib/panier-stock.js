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

/**
 * Met dans le panier les articles d'une ancienne commande (SUI-a) d'après la
 * réponse du serveur, qui a déjà vérifié la disponibilité, et décrit au client
 * ce qui a été fait.
 *
 * @param {object} reponse  la réponse de CommandeData.recommander
 * @returns {Array<{type: "succes"|"erreur", texte: string}>}  le résultat d'abord,
 *          puis ce qui n'a pas pu être ajouté tel quel
 */
export function transfererDansLePanier(reponse) {
  let { ajoutes, limites } = PanierData.fusionner(reponse.articles);
  let messages = [];

  if (ajoutes > 0) {
    messages.push({
      type: "succes",
      texte: `${pluriel(ajoutes, "article")} de la commande ${reponse.numero} ${ajoutes > 1 ? "ont été ajoutés" : "a été ajouté"} à votre panier.`,
    });
  } else {
    messages.push({
      type: "erreur",
      texte: `Aucun article de la commande ${reponse.numero} n'a pu être ajouté à votre panier.`,
    });
  }

  for (let ligne of reponse.indisponibles) {
    messages.push({
      type: "erreur",
      texte:
        ligne.raison === "epuise"
          ? `${ligne.nom} est épuisé : il n'a pas été ajouté.`
          : `${ligne.nom} n'est plus vendu : il n'a pas été ajouté.`,
    });
  }

  for (let ligne of reponse.ajustes) {
    messages.push({
      type: "erreur",
      texte: `Il ne reste que ${pluriel(ligne.acceptee, "exemplaire")} de ${ligne.nom} : ${ligne.acceptee} ajouté(s) au lieu de ${ligne.demandee}.`,
    });
  }

  for (let ligne of reponse.prix) {
    messages.push({
      type: "erreur",
      texte: `Le prix de ${ligne.nom} est passé de ${formaterPrix(ligne.ancien)} à ${formaterPrix(ligne.nouveau)} depuis votre commande.`,
    });
  }

  // Le stock du panier a pu empêcher d'ajouter la quantité entière alors que le
  // serveur l'acceptait (articles déjà dans le panier).
  let dejaDit = new Set(reponse.ajustes.map((ligne) => ligne.nom));
  for (let nom of limites.filter((nom) => !dejaDit.has(nom))) {
    messages.push({
      type: "erreur",
      texte: `Votre panier contient déjà le maximum disponible de ${nom} : la quantité n'a pas été augmentée en entier.`,
    });
  }

  return messages;
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
