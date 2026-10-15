import { genericRenderer, htmlToFragment, urlPublique } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateMiniature from "./miniature.html?raw";

// Galerie d'images d'un produit : une grande image et une rangée de miniatures.
// Le composant ne retient pas l'image affichée : il reçoit son indice, et
// signale le choix d'une miniature par actions.surImage.
let GalerieProduitView = {
  /**
   * @param {{images: Array<{moyen: string, grand: string, alt: string}>,
   *          index: number}} data
   * @param {{surImage: (index: number) => void}} actions
   */
  dom: function (data, actions) {
    let courante = data.images[data.index];

    let fragment = htmlToFragment(
      genericRenderer(template, { image: urlPublique(courante.grand), alt: courante.alt })
    );

    let miniatures = data.images.map((image, i) => {
      let miniature = htmlToFragment(
        genericRenderer(templateMiniature, {
          index: i,
          libelle: `Voir l'image ${i + 1} sur ${data.images.length}`,
          image: urlPublique(image.moyen),
        })
      );

      let bouton = miniature.querySelector("button");
      // Un template n'a pas de condition : la miniature choisie se règle ici.
      bouton.setAttribute("aria-current", String(i === data.index));
      bouton.addEventListener("click", () => actions.surImage(i));

      return miniature;
    });

    fragment.querySelector('slot[name="miniatures"]').replaceWith(...miniatures);
    return fragment;
  },
};

export { GalerieProduitView };
