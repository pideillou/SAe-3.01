/**
 * Les statuts d'une commande, tels qu'ils sont enregistrés en base, avec leur
 * libellé et leur couleur. Les classes sont écrites en entier : Tailwind ne
 * génère que celles qu'il trouve telles quelles.
 */
export const STATUTS_COMMANDE = {
  "en cours": { libelle: "En cours", classes: "text-alerte" },
  disponible: { libelle: "Disponible", classes: "text-razer" },
  retirée: { libelle: "Retirée", classes: "text-texte-secondaire" },
  annulée: { libelle: "Annulée", classes: "text-erreur" },
};

export function statutDe(statut) {
  return STATUTS_COMMANDE[statut] ?? { libelle: statut, classes: "" };
}

/**
 * Le libellé du bouton qui fait passer une commande à ce statut.
 */
export const ACTIONS_COMMANDE = {
  disponible: "Marquer comme disponible",
  retirée: "Marquer comme retirée",
  annulée: "Annuler la commande",
};
