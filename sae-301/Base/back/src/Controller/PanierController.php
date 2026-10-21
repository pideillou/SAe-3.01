<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\ParametreModel;
use App\Model\ProduitModel;

/**
 * Vérification du panier contre le stock réel (STK-c).
 *
 * Le panier vit dans le navigateur (CMD-b) : ses prix et ses stocks ne font pas
 * foi. Le front interroge cette route avant chaque ajout et à l'ouverture du
 * panier, pour savoir ce que le serveur accepterait vraiment.
 */
final class PanierController
{
    /** Nombre maximal de lignes acceptées en une requête. */
    private const LIGNES_MAX = 50;

    /** Quantité maximale demandée pour une ligne (bien au-dessus de tout stock). */
    private const QUANTITE_MAX = 999;

    private ProduitModel $produits;
    private ParametreModel $parametres;

    public function __construct(ProduitModel $produits, ParametreModel $parametres)
    {
        $this->produits   = $produits;
        $this->parametres = $parametres;
    }

    /**
     * POST /api/panier/verifier : { lignes: [ { varianteId, quantite } ] }
     *
     * Pour chaque ligne, le stock réel du moment et ce qui est accepté :
     * statut « ok », « ajustee » (quantité ramenée au stock), « epuisee » ou
     * « inconnue » (variante supprimée depuis l'ajout).
     */
    public function verifier(Request $requete): void
    {
        $lignes = $requete->corps()['lignes'] ?? null;

        if (!is_array($lignes) || count($lignes) > self::LIGNES_MAX) {
            Response::erreur('Le panier envoyé est invalide.', 422);
        }

        // Une quantité par variante : si une variante figure deux fois, on additionne.
        $demandes = [];

        foreach ($lignes as $ligne) {
            $id       = is_array($ligne) ? ($ligne['varianteId'] ?? null) : null;
            $quantite = is_array($ligne) ? ($ligne['quantite'] ?? null) : null;

            if (!is_int($id) || $id < 1 || !is_int($quantite) || $quantite < 1 || $quantite > self::QUANTITE_MAX) {
                Response::erreur('Le panier envoyé est invalide.', 422);
            }

            $demandes[$id] = min(($demandes[$id] ?? 0) + $quantite, self::QUANTITE_MAX);
        }

        $seuil   = (int) $this->parametres->valeur('seuil_bientot_epuise', '5');
        $reponse = [];

        foreach ($this->produits->verifierDisponibilite($demandes) as $ligne) {
            if (!$ligne['connue']) {
                $reponse[] = [
                    'varianteId'        => $ligne['id'],
                    'statut'            => 'inconnue',
                    'quantiteDemandee'  => $ligne['quantite_demandee'],
                    'quantiteAcceptee'  => 0,
                ];
                continue;
            }

            $statut = 'ok';

            if ($ligne['stock'] <= 0) {
                $statut = 'epuisee';
            } elseif ($ligne['quantite_acceptee'] < $ligne['quantite_demandee']) {
                $statut = 'ajustee';
            }

            $reponse[] = [
                'varianteId'       => $ligne['id'],
                'statut'           => $statut,
                'quantiteDemandee' => $ligne['quantite_demandee'],
                'quantiteAcceptee' => $ligne['quantite_acceptee'],
                'stock'            => $ligne['stock'],
                'etat'             => self::etatStock($ligne['stock'], $seuil),
                'prix'             => $ligne['prix'],
                'nom'              => $ligne['nom'],
                'options'          => $ligne['options'] ?? '',
                'produitSlug'      => $ligne['produit_slug'],
                'produitNom'       => $ligne['produit_nom'],
                'image'            => $ligne['image'] === null ? null : [
                    'moyen' => $ligne['image'],
                    'alt'   => $ligne['image_alt'],
                ],
            ];
        }

        Response::json(['lignes' => $reponse]);
    }

    private static function etatStock(int $stock, int $seuil): string
    {
        if ($stock <= 0) {
            return 'epuise';
        }

        return $stock <= $seuil ? 'bientot-epuise' : 'en-stock';
    }
}
