/**
 * Lecture et validation du formulaire de produit côté navigateur, pour répondre
 * tout de suite. Le serveur applique les mêmes règles et reste seul juge
 * (AdminProduitController) : les chemins d'erreur sont les siens.
 *
 * Brouillon (ce que montre le formulaire, tout en texte) :
 *   { nom, categorieId, accroche, description, points,        // points : un par ligne
 *     options:   [ { nom, valeurs } ],                        // valeurs : une par ligne
 *     variantes: [ { id, reference, valeurs: [..], prix, stock, defaut } ] }
 */
const PRIX_MAX = 99999.99;
const STOCK_MAX = 65535;

const lignes = (texte) =>
  texte
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne !== "");

/**
 * @returns {{donnees: object, erreurs: Object<string, string>}}  le corps à envoyer à
 *          l'API, et un message en français par champ fautif ({} si tout va bien)
 */
export function preparerProduit(brouillon) {
  let erreurs = {};

  let nom = brouillon.nom.trim();
  let description = brouillon.description.trim();
  let accroche = brouillon.accroche.trim();
  let points = lignes(brouillon.points);

  if (nom === "") {
    erreurs.nom = "Saisissez le nom du produit.";
  } else if (nom.length < 2 || nom.length > 120) {
    erreurs.nom = "Le nom doit faire entre 2 et 120 caractères.";
  }

  if (brouillon.categorieId === "") {
    erreurs.categorieId = "Choisissez une catégorie.";
  }

  if (accroche.length > 255) {
    erreurs.accroche = "L'accroche ne doit pas dépasser 255 caractères.";
  }

  if (description === "") {
    erreurs.description = "Saisissez la description du produit.";
  } else if (description.length > 10000) {
    erreurs.description = "La description ne doit pas dépasser 10000 caractères.";
  }

  if (points.length > 6) {
    erreurs.caracteristiques = "Pas plus de 6 points forts.";
  } else if (points.some((point) => point.length > 200)) {
    erreurs.caracteristiques = "Un point fort ne doit pas dépasser 200 caractères.";
  }

  // Options : un nom, des valeurs sans doublon (la casse ne compte pas).
  let options = brouillon.options.map((option, i) => {
    let valeurs = lignes(option.valeurs);
    let nomOption = option.nom.trim();

    if (nomOption === "" || nomOption.length > 60) {
      erreurs[`options.${i}.nom`] = "Le nom de l'option doit faire de 1 à 60 caractères.";
    }

    let vues = new Set();
    for (let valeur of valeurs) {
      if (valeur.length > 80) {
        erreurs[`options.${i}.valeurs`] = "Une valeur ne doit pas dépasser 80 caractères.";
      } else if (vues.has(valeur.toLowerCase())) {
        erreurs[`options.${i}.valeurs`] = `La valeur « ${valeur} » est écrite deux fois.`;
      }
      vues.add(valeur.toLowerCase());
    }

    if (valeurs.length === 0) {
      erreurs[`options.${i}.valeurs`] = "Indiquez au moins une valeur pour cette option.";
    } else if (valeurs.length > 20) {
      erreurs[`options.${i}.valeurs`] = "Pas plus de 20 valeurs par option.";
    }

    return { nom: nomOption, valeurs };
  });

  if (new Set(options.map((o) => o.nom.toLowerCase())).size < options.length) {
    erreurs.options = "Deux options ne peuvent pas porter le même nom.";
  }

  // Variantes : référence, prix, stock et une valeur par option.
  if (brouillon.variantes.length === 0) {
    erreurs.variantes = "Ajoutez au moins une variante.";
  } else if (options.length === 0 && brouillon.variantes.length > 1) {
    erreurs.variantes = "Sans option, un produit a une seule variante.";
  }

  let references = new Set();
  let combinaisons = new Set();

  let variantes = brouillon.variantes.map((variante, i) => {
    let reference = variante.reference.trim();
    let prix = variante.prix.trim().replace(",", ".");
    let stock = variante.stock.trim();

    if (reference === "" || reference.length > 30) {
      erreurs[`variantes.${i}.reference`] = "La référence doit faire de 1 à 30 caractères.";
    } else if (references.has(reference.toLowerCase())) {
      erreurs[`variantes.${i}.reference`] = "Cette référence est déjà utilisée par une autre variante.";
    }
    references.add(reference.toLowerCase());

    if (!/^\d{1,5}(\.\d{1,2})?$/.test(prix) || Number(prix) > PRIX_MAX) {
      erreurs[`variantes.${i}.prix`] = "Le prix doit être un montant de 0 à 99 999,99 €, avec au plus 2 décimales.";
    }

    if (!/^\d+$/.test(stock) || Number(stock) > STOCK_MAX) {
      erreurs[`variantes.${i}.stock`] = `Le stock doit être un nombre entier de 0 à ${STOCK_MAX}.`;
    }

    let valeurs = options.map((option, k) => variante.valeurs[k] ?? "");
    let manquante = options.findIndex((option, k) => !option.valeurs.includes(valeurs[k]));

    if (manquante !== -1) {
      erreurs[`variantes.${i}.valeurs`] = `Choisissez une valeur pour « ${options[manquante].nom} ».`;
    } else if (options.length > 0) {
      let signature = valeurs.join("\u0000").toLowerCase();
      if (combinaisons.has(signature)) {
        erreurs[`variantes.${i}.valeurs`] = "Une autre variante a déjà exactement cette combinaison d'options.";
      }
      combinaisons.add(signature);
    }

    return {
      id: variante.id,
      reference,
      prix,
      stock: /^\d+$/.test(stock) ? Number(stock) : 0,
      defaut: variante.defaut,
      valeurs,
    };
  });

  return {
    donnees: {
      nom,
      categorieId: brouillon.categorieId === "" ? null : Number(brouillon.categorieId),
      accroche,
      description,
      caracteristiques: points,
      options,
      variantes,
    },
    erreurs,
  };
}

/**
 * Le brouillon d'un produit existant, d'après la réponse de l'API.
 */
export function brouillonDepuis(produit) {
  return {
    nom: produit.nom,
    categorieId: String(produit.categorieId),
    accroche: produit.accroche,
    description: produit.description,
    points: produit.caracteristiques.join("\n"),
    options: produit.options.map((option) => ({ nom: option.nom, valeurs: option.valeurs.join("\n") })),
    variantes: produit.variantes.map((variante) => ({
      id: variante.id,
      reference: variante.reference,
      valeurs: [...variante.valeurs],
      prix: variante.prix,
      stock: String(variante.stock),
      defaut: variante.defaut,
    })),
  };
}

/**
 * Le brouillon d'un nouveau produit : une variante vide, par défaut.
 */
export function brouillonVide() {
  return {
    nom: "",
    categorieId: "",
    accroche: "",
    description: "",
    points: "",
    options: [],
    variantes: [varianteVide(true)],
  };
}

export function varianteVide(defaut = false) {
  return { id: null, reference: "", valeurs: [], prix: "", stock: "0", defaut };
}
