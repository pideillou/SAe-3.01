/**
 * Règles de saisie du formulaire de code promotionnel, vérifiées côté
 * navigateur pour répondre tout de suite. Le serveur applique les mêmes règles
 * et reste seul juge (AdminCodePromoController).
 *
 * @param {{code: string, pourcentage: string}} valeurs  saisies brutes
 * @param {boolean} enEdition  le nom d'un code existant ne se vérifie pas : il ne change pas
 * @returns {Object<string, string>}  un message en français par champ fautif ({} si tout va bien)
 */
export function erreursCodePromo({ code, pourcentage }, enEdition) {
  let erreurs = {};

  if (!enEdition) {
    if (code === "") {
      erreurs.code = "Saisissez le code.";
    } else if (!/^[A-Za-z0-9_-]{2,30}$/.test(code)) {
      erreurs.code = "Le code doit faire 2 à 30 caractères : lettres sans accent, chiffres, tiret ou tiret bas.";
    }
  }

  if (!/^\d+$/.test(pourcentage) || Number(pourcentage) < 1 || Number(pourcentage) > 100) {
    erreurs.pourcentage = "Le pourcentage doit être un nombre entier de 1 à 100.";
  }

  return erreurs;
}
