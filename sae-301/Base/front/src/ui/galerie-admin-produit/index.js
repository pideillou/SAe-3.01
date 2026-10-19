import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { ConfirmationSuppressionView } from "../confirmation-suppression/index.js";
import { MessageView } from "../message/index.js";
import template from "./template.html?raw";
import templateImage from "./image.html?raw";

// Taille maximale d'une image, en octets : celle que le serveur accepte aussi.
const TAILLE_MAX = 2 * 1024 * 1024;

// Gestion des images d'un produit : la galerie, l'image de chaque variante, et
// le formulaire d'ajout. Le composant ne modifie rien : il signale les actions de
// l'administrateur, et la page appelle l'API puis lui donne les images à jour.
let GalerieAdminProduitView = {
  /**
   * @param {{images: Array<{id, varianteId, moyen, alt, principale}>,
   *          variantes: Array<{id, nom}>,
   *          erreurs: Object<string, string>,    // erreurs du formulaire d'ajout
   *          erreursAlt: Object<number, string>, // erreur du texte alternatif, par id d'image
   *          message: {type, texte}|null,
   *          aSupprimer: object|null,            // l'image dont on demande confirmation
   *          envoiEnCours: boolean}} data
   * @param {{surAjout: (valeurs: {fichier: File|null, varianteId: number|null, alt: string}) => void,
   *          surPrincipale: (id: number) => void,
   *          surTexte: (id: number, alt: string) => void,
   *          surDemandeSuppression: (image: object) => void,
   *          surConfirmationSuppression: () => void,
   *          surAnnulationSuppression: () => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(template);
    let racine = fragment.firstElementChild;

    racine.querySelector('slot[name="message"]').replaceWith(MessageView.dom(data.message));

    let slotConfirmation = racine.querySelector('slot[name="confirmation"]');
    if (data.aSupprimer === null) {
      slotConfirmation.remove();
    } else {
      slotConfirmation.replaceWith(
        ConfirmationSuppressionView.dom(
          {
            titre: "Supprimer cette image ?",
            texte: `L'image « ${data.aSupprimer.alt} » et ses fichiers seront supprimés définitivement.`,
            envoiEnCours: data.envoiEnCours,
          },
          { surConfirmation: actions.surConfirmationSuppression, surAnnulation: actions.surAnnulationSuppression }
        )
      );
    }

    // Liste des images
    let nomsDeVariantes = Object.fromEntries(data.variantes.map((v) => [v.id, v.nom]));

    let elements = data.images.map((image, i) => {
      let element = htmlToFragment(
        genericRenderer(templateImage, {
          id: image.id,
          numero: i + 1,
          image: urlPublique(image.moyen),
          alt: image.alt,
          variante: nomsDeVariantes[image.varianteId] ?? "",
        })
      );

      // Un template n'a pas de condition : les badges et boutons se règlent ici.
      if (!image.principale) {
        element.querySelector("[data-badge-principale]").remove();
      }
      if (image.varianteId === null) {
        element.querySelector("[data-badge-variante]").remove();
      }
      // Seule une image de la galerie peut être principale, et une seule à la fois.
      if (image.varianteId !== null || image.principale) {
        element.querySelector('[data-action="principale"]').remove();
      }

      let erreurAlt = data.erreursAlt[image.id];
      if (erreurAlt !== undefined) {
        element.querySelector('[data-role="erreur-alt"]').textContent = erreurAlt;
        element.querySelector('[data-role="alt"]').setAttribute("aria-invalid", "true");
      }

      let saisieAlt = element.querySelector('[data-role="alt"]');
      element.querySelector('[data-action="enregistrer-alt"]').addEventListener("click", () => actions.surTexte(image.id, saisieAlt.value.trim()));
      element.querySelector('[data-action="principale"]')?.addEventListener("click", () => actions.surPrincipale(image.id));
      element.querySelector('[data-action="supprimer"]').addEventListener("click", () => actions.surDemandeSuppression(image));

      return element;
    });

    if (elements.length === 0) {
      racine.querySelector("[data-liste]").remove();
    } else {
      racine.querySelector("[data-aucune-image]").remove();
      racine.querySelector("[data-liste]").replaceChildren(...elements);
    }

    // Formulaire d'ajout
    let formulaire = racine.querySelector("[data-ajout]");
    let choix = formulaire.querySelector('[data-champ="varianteId"]');
    for (let variante of data.variantes) {
      let option = document.createElement("option");
      option.value = String(variante.id);
      option.textContent = `Image de la variante : ${variante.nom}`;
      choix.append(option);
    }

    for (let [champ, message] of Object.entries(data.erreurs)) {
      let zone = formulaire.querySelector(`[data-erreur="${champ}"]`);
      let saisie = formulaire.querySelector(`[data-champ="${champ}"]`);

      if (zone !== null && saisie !== null) {
        zone.textContent = message;
        saisie.setAttribute("aria-invalid", "true");
      }
    }

    formulaire.querySelector('button[type="submit"]').disabled = data.envoiEnCours;
    formulaire.addEventListener("submit", (ev) => {
      ev.preventDefault();
      actions.surAjout({
        fichier: formulaire.querySelector('[data-champ="image"]').files[0] ?? null,
        varianteId: choix.value === "" ? null : Number(choix.value),
        alt: formulaire.querySelector('[data-champ="alt"]').value.trim(),
      });
    });

    return fragment;
  },

  TAILLE_MAX,
};

export { GalerieAdminProduitView };
