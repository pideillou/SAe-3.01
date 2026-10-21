import { formaterPrix } from "./format.js";

/**
 * Choix d'une variante parmi celles d'un produit.
 *
 * Une variante est une combinaison d'options réellement vendue : elle porte la
 * liste des identifiants de ses valeurs (« valeurs »), son prix et son stock.
 * Toutes les combinaisons théoriques n'existent pas : le BlackWidow V4 n'est
 * pas vendu en switchs jaunes avec une disposition française, par exemple.
 */

/**
 * La variante affichée par défaut : celle marquée « défaut », sinon la première.
 */
export function varianteInitiale(variantes) {
  return variantes.find((variante) => variante.defaut) ?? variantes[0] ?? null;
}

/**
 * La variante à afficher quand on choisit une valeur d'option.
 *
 * Parmi les variantes qui portent cette valeur, on garde celle qui conserve le
 * plus des autres choix en cours ; à égalité, la première en stock. Le visiteur
 * peut ainsi toujours atteindre une valeur, même si la combinaison exacte avec
 * ses autres choix n'existe pas.
 *
 * @param {Array}  variantes
 * @param {number} valeurId     la valeur choisie
 * @param {Array}  selection    identifiants des valeurs actuellement choisies
 * @returns la variante, ou null si aucune ne porte cette valeur
 */
export function varianteApresChoix(variantes, valeurId, selection) {
  let meilleure = null;
  let meilleurScore = -1;

  for (let variante of variantes) {
    if (!variante.valeurs.includes(valeurId)) {
      continue;
    }

    // Une valeur partagée avec le choix en cours compte 2, le stock 1 : le
    // stock ne départage que des variantes à égalité de valeurs conservées.
    let conservees = variante.valeurs.filter((id) => id !== valeurId && selection.includes(id)).length;
    let score = conservees * 2 + (variante.stock > 0 ? 1 : 0);

    if (score > meilleurScore) {
      meilleure = variante;
      meilleurScore = score;
    }
  }

  return meilleure;
}

/**
 * Vrai si au moins une variante portant cette valeur est en stock.
 */
export function valeurDisponible(variantes, valeurId) {
  return variantes.some((variante) => variante.valeurs.includes(valeurId) && variante.stock > 0);
}

/**
 * Les cartes d'une option : pour chaque valeur, la variante qu'on obtiendrait
 * en la choisissant (avec les autres choix conservés autant que possible), son
 * prix et son état. Sert à la fiche produit et à la modification des options
 * d'un article du panier.
 *
 * @param {object} produit   la fiche renvoyée par l'API
 * @param {object} option    une option du produit ({ nom, valeurs })
 * @param {object} variante  la variante actuellement choisie
 */
export function cartesOption(produit, option, variante) {
  return option.valeurs.map((valeur) => {
    let selectionnee = variante.valeurs.includes(valeur.id);
    let obtenue = selectionnee ? variante : varianteApresChoix(produit.variantes, valeur.id, variante.valeurs);

    let etat = "disponible";
    if (selectionnee) {
      etat = "selectionne";
    } else if (!valeurDisponible(produit.variantes, valeur.id)) {
      etat = "indisponible";
    }

    return {
      valeurId: valeur.id,
      libelle: valeur.valeur,
      prix: obtenue === null ? "" : formaterPrix(obtenue.prix),
      etat,
    };
  });
}

/**
 * Les options choisies d'une variante, en toutes lettres (« Switch : Vert,
 * Disposition : FR »). Seules les options à plusieurs valeurs sont décrites :
 * ce sont celles que le client choisit. Même format que celui enregistré par
 * le serveur avec la commande.
 */
export function descriptionOptions(produit, variante) {
  return produit.options
    .filter((option) => option.valeurs.length > 1)
    .map((option) => {
      let valeur = option.valeurs.find((v) => variante.valeurs.includes(v.id));
      return valeur === undefined ? null : `${option.nom} : ${valeur.valeur}`;
    })
    .filter((texte) => texte !== null)
    .join(", ");
}
