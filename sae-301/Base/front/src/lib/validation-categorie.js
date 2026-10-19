/**
 * Règles de saisie du formulaire de catégorie, vérifiées côté navigateur pour
 * répondre tout de suite. Le serveur applique les mêmes règles et reste seul
 * juge (AdminCategorieController).
 *
 * @param {{nom: string, description: string, ordre: string}} valeurs  saisies brutes
 * @returns {Object<string, string>}  un message en français par champ fautif ({} si tout va bien)
 */
export function erreursCategorie({ nom, description, ordre }) {
  let erreurs = {};

  if (nom === "") {
    erreurs.nom = "Saisissez le nom de la catégorie.";
  } else if (nom.length < 2 || nom.length > 60) {
    erreurs.nom = "Le nom doit faire entre 2 et 60 caractères.";
  } else if (!/[a-z0-9À-ÿ]/i.test(nom)) {
    erreurs.nom = "Le nom doit contenir au moins une lettre ou un chiffre.";
  }

  if (description.length > 1000) {
    erreurs.description = "La description ne doit pas dépasser 1000 caractères.";
  }

  // Un ordre vide est permis : le serveur prend alors le suivant.
  if (ordre !== "" && !(/^\d+$/.test(ordre) && Number(ordre) <= 255)) {
    erreurs.ordre = "L'ordre d'affichage doit être un nombre entier de 0 à 255.";
  }

  return erreurs;
}
