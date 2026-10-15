/**
 * Petites fonctions de mise en forme, sans dépendance.
 */

const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/**
 * "189.99" -> « 189,99 € » (virgule décimale et espace insécable français)
 *
 * L'API envoie les prix sous forme de chaîne, pour ne perdre aucun centime.
 */
export function formaterPrix(prix) {
  return EUROS.format(Number(prix));
}

/**
 * 1 -> « 1 produit », 4 -> « 4 produits »
 */
export function pluriel(nombre, singulier, plurielForme = singulier + "s") {
  return `${nombre} ${nombre > 1 ? plurielForme : singulier}`;
}
