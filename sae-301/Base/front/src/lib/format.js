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

/**
 * Découpe la description d'un produit, telle que la renvoie l'API : des blocs
 * séparés par une ligne vide, chacun étant un paragraphe seul ou un titre suivi
 * de son paragraphe (sur la ligne suivante).
 *
 * Renvoie l'introduction (premier bloc) et les blocs suivants :
 * { introduction: "…", blocs: [ { titre: "…" | null, texte: "…" }, … ] }
 */
export function decouperDescription(description) {
  let [introduction = "", ...blocs] = description
    .split("\n\n")
    .map((bloc) => bloc.trim())
    .filter((bloc) => bloc !== "");

  return {
    introduction,
    blocs: blocs.map((bloc) => {
      let [premiere, ...suite] = bloc.split("\n");
      return suite.length === 0
        ? { titre: null, texte: premiere }
        : { titre: premiere, texte: suite.join(" ") };
    }),
  };
}

const DATE_HEURE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

/**
 * "2026-10-16 14:30:00" (date MySQL) -> « 16 octobre 2026 à 14:30 »
 */
export function formaterDateHeure(dateMysql) {
  return DATE_HEURE.format(new Date(dateMysql.replace(" ", "T")));
}
