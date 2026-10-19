import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateOption from "./option.html?raw";
import templateVariante from "./variante.html?raw";

const OPTIONS_MAX = 3;

// Formulaire complet d'un produit : informations, options, variantes (prix et
// stocks). Il ne valide rien et ne décide de rien : il signale les actions
// (envoi, ajout ou retrait d'une option ou d'une variante) en transmettant le
// brouillon tel que l'administrateur l'a saisi, et affiche les erreurs données.
//
// Un seul comportement d'affichage lui appartient : quand les valeurs d'une
// option changent, les listes de choix des variantes se mettent à jour sur place
// (reconstruire la page ferait perdre un clic à l'utilisateur).
let FormulaireProduitView = {
  /**
   * @param {{brouillon: object,                       // voir lib/validation-produit.js
   *          categories: Array<{id, nom}>,
   *          erreurs: Object<string, string>,         // un message par champ, indexé par chemin
   *          enEdition: boolean,
   *          envoiEnCours: boolean}} data
   * @param {{surEnvoi: (brouillon: object) => void,
   *          surAjoutOption: (brouillon: object) => void,
   *          surSuppressionOption: (indice: number, brouillon: object) => void,
   *          surAjoutVariante: (brouillon: object) => void,
   *          surSuppressionVariante: (indice: number, brouillon: object) => void}} actions
   */
  dom: function (data, actions) {
    let b = data.brouillon;

    let fragment = htmlToFragment(
      genericRenderer(template, {
        nom: b.nom,
        accroche: b.accroche,
        description: b.description,
        points: b.points,
        bouton: data.enEdition ? "Enregistrer les modifications" : "Créer le produit",
        cheminListe: urlPublique("admin/produits"),
      })
    );
    let formulaire = fragment.querySelector("form");

    // Catégories : une liste de choix, la catégorie du brouillon sélectionnée.
    let selectCategorie = formulaire.querySelector('[data-champ="categorieId"]');
    for (let categorie of data.categories) {
      let option = document.createElement("option");
      option.value = String(categorie.id);
      option.textContent = categorie.nom;
      option.selected = String(categorie.id) === b.categorieId;
      selectCategorie.append(option);
    }

    // Options
    let zoneOptions = formulaire.querySelector("[data-options]");
    zoneOptions.replaceChildren(
      ...b.options.map((option, i) => {
        let element = htmlToFragment(
          genericRenderer(templateOption, { indice: i, numero: i + 1, nom: option.nom, valeurs: option.valeurs })
        );

        element.querySelector('[data-action="supprimer-option"]').addEventListener("click", () => {
          actions.surSuppressionOption(i, lire(formulaire));
        });
        // Valeurs ou nom d'option modifiés : les listes de choix des variantes suivent.
        element.querySelector('[data-role="valeurs"]').addEventListener("change", () => majChoix(formulaire));
        element.querySelector('[data-role="nom"]').addEventListener("change", () => majChoix(formulaire));

        return element;
      })
    );
    formulaire.querySelector('[data-action="ajouter-option"]').disabled = b.options.length >= OPTIONS_MAX;

    // Variantes : une ligne chacune, avec une liste de choix par option.
    formulaire.querySelector("[data-variantes]").replaceChildren(
      ...b.variantes.map((variante, i) => {
        let ligne = htmlToFragment(
          genericRenderer(templateVariante, {
            indice: i,
            numero: i + 1,
            reference: variante.reference,
            prix: variante.prix,
            stock: variante.stock,
          })
        );

        let defaut = ligne.querySelector('[data-role="defaut"]');
        defaut.checked = variante.defaut;

        // Une ligne porte son id (variante existante) : il suit la ligne, pas sa position.
        ligne.querySelector("[data-variante]").dataset.id = variante.id === null ? "" : String(variante.id);

        let supprimer = ligne.querySelector('[data-action="supprimer-variante"]');
        supprimer.disabled = b.variantes.length <= 1;
        supprimer.addEventListener("click", () => actions.surSuppressionVariante(i, lire(formulaire)));

        ligne.querySelector("[data-valeurs]").dataset.choix = JSON.stringify(variante.valeurs);

        return ligne;
      })
    );
    majChoix(formulaire);

    // Erreurs : à côté du champ concerné ; le reste, dans le cadre du haut.
    let generales = [];
    for (let [chemin, message] of Object.entries(data.erreurs)) {
      let zone = formulaire.querySelector(`[data-erreur="${chemin}"]`);

      if (zone === null) {
        generales.push(message);
        continue;
      }

      zone.textContent = message;
      for (let saisie of champsDe(formulaire, chemin)) {
        saisie.setAttribute("aria-invalid", "true");
      }
    }

    if (Object.keys(data.erreurs).length > 0) {
      let resume = formulaire.querySelector("[data-resume-erreurs]");
      resume.hidden = false;
      let liste = resume.querySelector("[data-erreurs-generales]");
      if (generales.length === 0) {
        liste.remove();
      } else {
        liste.replaceChildren(...generales.map((texte) => Object.assign(document.createElement("li"), { textContent: texte })));
      }
    }

    formulaire.querySelector('button[type="submit"]').disabled = data.envoiEnCours;
    formulaire.querySelector('[data-action="ajouter-option"]').addEventListener("click", () => actions.surAjoutOption(lire(formulaire)));
    formulaire.querySelector('[data-action="ajouter-variante"]').addEventListener("click", () => actions.surAjoutVariante(lire(formulaire)));
    formulaire.addEventListener("submit", (ev) => {
      ev.preventDefault();
      actions.surEnvoi(lire(formulaire));
    });

    return fragment;
  },

  /**
   * Relit le brouillon dans un formulaire affiché (utilisé par la page pour
   * garder la saisie quand elle se reconstruit).
   */
  lire: function (formulaire) {
    return lire(formulaire);
  },
};

/**
 * Les saisies qui portent une erreur de ce chemin : « nom » -> le champ du nom ;
 * « options.1.valeurs » -> la zone de valeurs de la 2e option ;
 * « variantes.2.prix » -> le prix de la 3e variante. Les listes de choix d'une
 * variante sont marquées pour « variantes.N.valeurs ».
 */
function champsDe(formulaire, chemin) {
  let morceaux = chemin.split(".");

  if (morceaux.length === 1) {
    return formulaire.querySelectorAll(`[data-champ="${chemin}"]`);
  }

  let [groupe, indice, role] = morceaux;
  let ligne = formulaire.querySelectorAll(groupe === "options" ? "[data-option]" : "[data-variante]")[Number(indice)];

  if (ligne === undefined) {
    return [];
  }

  return role === "valeurs" && groupe === "variantes"
    ? ligne.querySelectorAll("select")
    : ligne.querySelectorAll(`[data-role="${role}"]`);
}

/**
 * Remplit les listes de choix de chaque variante d'après les valeurs actuelles
 * des options. Une valeur déjà choisie est conservée si elle existe toujours.
 */
function majChoix(formulaire) {
  let valeursParOption = [...formulaire.querySelectorAll("[data-option]")].map((option) =>
    option
      .querySelector('[data-role="valeurs"]')
      .value.split("\n")
      .map((v) => v.trim())
      .filter((v) => v !== "")
  );

  for (let cellule of formulaire.querySelectorAll("[data-valeurs]")) {
    // Choix déjà faits : ceux des listes actuelles, sinon ceux du brouillon.
    let actuels = [...cellule.querySelectorAll("select")].map((s) => s.value);
    let initiaux = cellule.dataset.choix ? JSON.parse(cellule.dataset.choix) : [];
    let indiceLigne = [...formulaire.querySelectorAll("[data-variante]")].indexOf(cellule.closest("[data-variante]"));

    cellule.replaceChildren(
      ...valeursParOption.map((valeurs, k) => {
        let nomOption = formulaire.querySelectorAll("[data-option]")[k].querySelector('[data-role="nom"]').value.trim();
        let souhaitee = actuels[k] ?? initiaux[k] ?? "";

        let etiquette = document.createElement("label");
        etiquette.className = "flex flex-col gap-1 text-note text-texte-secondaire";
        etiquette.textContent = nomOption === "" ? `Option ${k + 1}` : nomOption;

        let select = document.createElement("select");
        select.dataset.role = "valeur";
        select.id = `variante-valeur-${indiceLigne}-${k}`;
        select.className =
          "h-11 w-56 max-w-full border border-bordure bg-fond px-2 text-sm text-texte transition-colors hover:border-texte-secondaire aria-invalid:border-erreur";

        for (let valeur of valeurs) {
          let option = document.createElement("option");
          option.value = valeur;
          option.textContent = valeur;
          option.selected = valeur === souhaitee;
          select.append(option);
        }

        // Valeur disparue (ou jamais choisie) : la liste commence à la première.
        if (!valeurs.includes(souhaitee) && valeurs.length > 0) {
          select.selectedIndex = 0;
        }

        etiquette.append(select);
        return etiquette;
      })
    );

    if (valeursParOption.length === 0) {
      let texte = document.createElement("span");
      texte.className = "text-sm text-texte-secondaire";
      texte.textContent = "Aucune option";
      cellule.append(texte);
    }
  }
}

/**
 * Le brouillon actuel du formulaire (voir lib/validation-produit.js).
 */
function lire(formulaire) {
  let texte = (champ) => formulaire.querySelector(`[data-champ="${champ}"]`).value;

  let options = [...formulaire.querySelectorAll("[data-option]")].map((option) => ({
    nom: option.querySelector('[data-role="nom"]').value,
    valeurs: option.querySelector('[data-role="valeurs"]').value,
  }));

  let variantes = [...formulaire.querySelectorAll("[data-variante]")].map((ligne) => ({
    id: ligne.dataset.id === "" ? null : Number(ligne.dataset.id),
    reference: ligne.querySelector('[data-role="reference"]').value,
    valeurs: [...ligne.querySelectorAll('select[data-role="valeur"]')].map((s) => s.value),
    prix: ligne.querySelector('[data-role="prix"]').value,
    stock: ligne.querySelector('[data-role="stock"]').value,
    defaut: ligne.querySelector('[data-role="defaut"]').checked,
  }));

  return {
    nom: texte("nom"),
    categorieId: texte("categorieId"),
    accroche: texte("accroche"),
    description: texte("description"),
    points: texte("caracteristiques"),
    options,
    variantes,
  };
}

export { FormulaireProduitView };
