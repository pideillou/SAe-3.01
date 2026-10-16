import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import { MessageView } from "../message/index.js";
import template from "./template.html?raw";

// Trois variantes du même formulaire : la connexion (e-mail, mot de passe),
// l'inscription (avec confirmation du mot de passe) et la connexion des
// administrateurs (sans lien vers l'inscription : il n'y en a pas). Le composant ne valide
// rien et ne décide de rien : il transmet les valeurs saisies par
// actions.surEnvoi, et affiche les erreurs qu'on lui donne.
const VARIANTES = {
  connexion: {
    titre: "Connexion",
    sousTitre: "Connectez-vous pour finaliser votre commande.",
    bouton: "Se connecter",
    autocompleteMdp: "current-password",
    questionLien: "Pas encore de compte ?",
    libelleLien: "Créer un compte",
    cheminLien: "inscription",
    confirmation: false,
  },
  inscription: {
    titre: "Créer un compte",
    sousTitre: "Un compte est nécessaire pour finaliser une commande.",
    bouton: "Créer mon compte",
    autocompleteMdp: "new-password",
    questionLien: "Déjà un compte ?",
    libelleLien: "Se connecter",
    cheminLien: "connexion",
    confirmation: true,
  },
  admin: {
    titre: "Administration",
    sousTitre: "Espace réservé à l'équipe du magasin.",
    bouton: "Se connecter",
    autocompleteMdp: "current-password",
    questionLien: "",
    libelleLien: "",
    cheminLien: "",
    confirmation: false,
    lien: false,
  },
};

let FormulaireCompteView = {
  /**
   * @param {"connexion"|"inscription"|"admin"} variante
   * @param {{email: string,
   *          erreurs: Object<string, string>,   // un message par champ fautif
   *          message: {type, texte}|null,       // erreur générale
   *          retour: string|null,               // page à rejoindre après connexion
   *          envoiEnCours: boolean}} data
   * @param {{surEnvoi: (valeurs: {email, mdp, confirmation}) => void}} actions
   */
  dom: function (variante, data, actions) {
    let reglages = VARIANTES[variante];

    let fragment = htmlToFragment(
      genericRenderer(template, {
        ...reglages,
        email: data.email,
        // Le lien vers l'autre formulaire garde la page à rejoindre ensuite.
        cheminLien:
          urlPublique(reglages.cheminLien) +
          (data.retour === null || data.retour === undefined ? "" : `?retour=${encodeURIComponent(data.retour)}`),
      })
    );

    fragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(data.message));

    // Un template n'a pas de condition : ce qui ne concerne pas cette
    // variante est retiré ici.
    if (!reglages.confirmation) {
      fragment.querySelector("[data-confirmation]").remove();
      fragment.querySelector("[data-aide-mdp]").remove();
      fragment.querySelector("#champ-mdp").setAttribute("aria-describedby", "erreur-mdp");
    }

    if (reglages.lien === false) {
      fragment.querySelector("[data-lien]").remove();
    }

    // Erreurs par champ : le texte, l'état invalide du champ pour les lecteurs
    // d'écran et pour le style.
    for (let [champ, message] of Object.entries(data.erreurs)) {
      let zone = fragment.querySelector(`[data-erreur="${champ}"]`);
      let saisie = fragment.querySelector(`[name="${champ}"]`);

      if (zone !== null && saisie !== null) {
        zone.textContent = message;
        saisie.setAttribute("aria-invalid", "true");
      }
    }

    let formulaire = fragment.querySelector("form");
    let bouton = formulaire.querySelector('button[type="submit"]');
    bouton.disabled = data.envoiEnCours;

    formulaire.addEventListener("submit", (ev) => {
      // Sans cela, le navigateur enverrait le formulaire de manière classique,
      // en rechargeant la page.
      ev.preventDefault();
      actions.surEnvoi({
        email: formulaire.elements.email.value.trim(),
        mdp: formulaire.elements.mdp.value,
        confirmation: formulaire.elements.confirmation?.value ?? "",
      });
    });

    return fragment;
  },
};

export { FormulaireCompteView };
