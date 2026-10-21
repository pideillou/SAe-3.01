<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CategorieModel;
use App\Model\ParametreModel;
use App\Model\ProduitModel;
use App\Model\PromotionModel;

/**
 * Catalogue de produits (DEC-b) : les produits, avec leur nom, leur prix, leur
 * catégorie et leur image principale. Le paramètre ?categorie=slug ne garde
 * que les produits d'une catégorie (DEC-a).
 */
final class CatalogueController
{
    /** Forme d'un slug : minuscules, chiffres et tirets, sans tiret aux bords. */
    private const FORMAT_SLUG = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

    /** Les modèles qui interrogent la base, fournis à la construction. */
    private ProduitModel $produits;
    private CategorieModel $categories;
    private ParametreModel $parametres;
    private PromotionModel $promotion;

    public function __construct(
        ProduitModel $produits,
        CategorieModel $categories,
        ParametreModel $parametres,
        PromotionModel $promotion
    ) {
        $this->produits   = $produits;
        $this->categories = $categories;
        $this->parametres = $parametres;
        $this->promotion  = $promotion;
    }

    /**
     * État du stock d'une variante : « epuise », « bientot-epuise » (stock
     * inférieur ou égal au seuil de configuration) ou « en-stock ».
     */
    private function etatStock(int $stock, int $seuil): string
    {
        if ($stock <= 0) {
            return 'epuise';
        }

        return $stock <= $seuil ? 'bientot-epuise' : 'en-stock';
    }

    /**
     * Fiche d'un produit (DEC-c) : GET /api/produit?slug=razer-cobra
     */
    public function detail(Request $requete): void
    {
        $slug = $requete->parametre('slug');

        // La valeur vient de l'adresse : on contrôle sa forme, puis son
        // existence. Un produit inconnu est une adresse inconnue (404).
        if ($slug === null || strlen($slug) > 140 || preg_match(self::FORMAT_SLUG, $slug) !== 1) {
            Response::erreur('Produit introuvable', 404);
        }

        $produit = $this->produits->trouverParSlug($slug);

        if ($produit === null) {
            Response::erreur('Produit introuvable', 404);
        }

        $images = [];

        foreach ($this->produits->listerImages((int) $produit['id']) as $image) {
            // Chemins relatifs au dossier public du front.
            $images[] = [
                'moyen' => $image['chemin_moyen'],
                'grand' => $image['chemin_grand'],
                'alt'   => $image['texte_alt'],
            ];
        }

        // Options : { nom, valeurs: [{ id, valeur }] }, dans l'ordre d'affichage.
        $options = [];

        foreach ($this->produits->listerOptions((int) $produit['id']) as $ligne) {
            $cle = (int) $ligne['option_id'];

            $options[$cle]['nom']        = $ligne['option_nom'];
            $options[$cle]['valeurs'][]  = [
                'id'     => (int) $ligne['valeur_id'],
                'valeur' => $ligne['valeur'],
            ];
        }

        // Variantes : chacune a son prix, son stock et son état de stock.
        $seuil     = (int) $this->parametres->valeur('seuil_bientot_epuise', '5');
        $variantes = [];

        // Promotion automatique (PRO-c) : le produit au plus gros stock est à -20 %.
        $enPromotion = $this->promotion->produitEnPromotion() === (int) $produit['id'];

        foreach ($this->produits->listerVariantes((int) $produit['id']) as $ligne) {
            $stock = (int) $ligne['stock'];
            $tarif = PromotionModel::appliquer($ligne['prix'], $enPromotion);

            $variantes[] = [
                'id'        => (int) $ligne['id'],
                'reference' => $ligne['reference'],
                'nom'       => $ligne['nom'],
                'prix'      => $tarif['prix'],
                'prixBarre' => $tarif['prixBarre'],
                'stock'     => $stock,
                'etat'      => $this->etatStock($stock, $seuil),
                'defaut'    => (int) $ligne['est_defaut'] === 1,
                'valeurs'   => $ligne['valeurs'] === null
                    ? []
                    : array_map('intval', explode(',', $ligne['valeurs'])),
                'image'     => $ligne['chemin_moyen'] === null ? null : [
                    'moyen' => $ligne['chemin_moyen'],
                    'grand' => $ligne['chemin_grand'],
                    'alt'   => $ligne['texte_alt'],
                ],
            ];
        }

        Response::json([
            'produit' => [
                'id'          => (int) $produit['id'],
                'nom'         => $produit['nom'],
                'slug'        => $produit['slug'],
                'accroche'    => $produit['accroche'],
                'description' => $produit['description'],
                // Prix en chaînes (« 189.99 ») : voir index(). Avec la promotion,
                // « prix » et « prixMax » sont les prix réduits, « prixBarre » et
                // « prixMaxBarre » les prix d'origine (null hors promotion).
                'prix'        => PromotionModel::appliquer($produit['prix'], $enPromotion)['prix'],
                'prixMax'     => PromotionModel::appliquer($produit['prix_max'] ?? $produit['prix'], $enPromotion)['prix'],
                'prixBarre'   => PromotionModel::appliquer($produit['prix'], $enPromotion)['prixBarre'],
                'prixMaxBarre' => PromotionModel::appliquer($produit['prix_max'] ?? $produit['prix'], $enPromotion)['prixBarre'],
                'promotion'   => $enPromotion ? PromotionModel::POURCENTAGE : null,
                'categorie'   => [
                    'nom'  => $produit['categorie_nom'],
                    'slug' => $produit['categorie_slug'],
                ],
                // Un point fort par ligne, ou aucun.
                'caracteristiques' => $produit['caracteristiques'] === null || $produit['caracteristiques'] === ''
                    ? []
                    : explode("\n", $produit['caracteristiques']),
                'images'      => $images,
                'options'     => array_values($options),
                'variantes'   => $variantes,
            ],
        ]);
    }

    public function index(Request $requete): void
    {
        $slug      = $requete->parametre('categorie');
        $categorie = null;

        if ($slug !== null) {
            // La valeur vient de l'adresse : on contrôle sa forme, puis son
            // existence. Une catégorie inconnue est une adresse inconnue (404).
            if (strlen($slug) > 80 || preg_match(self::FORMAT_SLUG, $slug) !== 1) {
                Response::erreur('Catégorie introuvable', 404);
            }

            $categorie = $this->categories->trouverParSlug($slug);

            if ($categorie === null) {
                Response::erreur('Catégorie introuvable', 404);
            }
        }

        $produits    = [];
        $seuil       = (int) $this->parametres->valeur('seuil_bientot_epuise', '5');
        $enPromotion = $this->promotion->produitEnPromotion();

        foreach ($this->produits->lister($categorie === null ? null : (int) $categorie['id']) as $ligne) {
            $tarif = PromotionModel::appliquer($ligne['prix'], (int) $ligne['id'] === $enPromotion);

            $produits[] = [
                'id'        => (int) $ligne['id'],
                'nom'       => $ligne['nom'],
                'slug'      => $ligne['slug'],
                // Le prix reste une chaîne (« 189.99 ») : un DECIMAL converti en
                // nombre à virgule flottante pourrait perdre des centimes.
                'prix'      => $tarif['prix'],
                // Promotion automatique (PRO-c) : prix d'origine à barrer et
                // pourcentage de la réduction, ou null pour un produit normal.
                'prixBarre' => $tarif['prixBarre'],
                'promotion' => $tarif['prixBarre'] === null ? null : PromotionModel::POURCENTAGE,
                // État de stock du produit (STK-b) d'après sa variante la mieux
                // fournie : « en-stock », « bientot-epuise » ou « epuise ».
                'etat'      => $this->etatStock((int) $ligne['stock_max'], $seuil),
                'categorie' => [
                    'nom'  => $ligne['categorie_nom'],
                    'slug' => $ligne['categorie_slug'],
                ],
                // Chemins relatifs au dossier public du front.
                'image'     => $ligne['chemin_moyen'] === null ? null : [
                    'moyen' => $ligne['chemin_moyen'],
                    'grand' => $ligne['chemin_grand'],
                    'alt'   => $ligne['texte_alt'],
                ],
            ];
        }

        Response::json([
            'produits'  => $produits,
            'total'     => count($produits),
            // La catégorie demandée, ou null pour tout le catalogue.
            'categorie' => $categorie === null ? null : [
                'nom'  => $categorie['nom'],
                'slug' => $categorie['slug'],
            ],
        ]);
    }
}
