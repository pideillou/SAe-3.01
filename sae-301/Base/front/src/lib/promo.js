/**
 * Réduction d'un code promotionnel (PRO-a), en pourcentage du total.
 *
 * Même calcul que le serveur (CommandeModel::reduction), en centimes entiers et
 * arrondi au centime le plus proche (les demis vers le haut) : le montant affiché
 * est celui que le serveur enregistrera. Le serveur reste seul juge à la commande.
 *
 * @param {number} total       total des articles, en euros
 * @param {number} pourcentage 1 à 100
 * @returns {{sousTotal: number, montant: number, total: number}}  en euros
 */
export function appliquerReduction(total, pourcentage) {
  let centimes = Math.round(total * 100);
  let reduction = Math.floor((centimes * pourcentage + 50) / 100);

  return {
    sousTotal: centimes / 100,
    montant: reduction / 100,
    total: (centimes - reduction) / 100,
  };
}
