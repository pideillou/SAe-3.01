<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Response;
use App\Model\CommandeModel;
use App\Model\ParametreModel;
use App\Model\ProduitModel;

/**
 * Indicateurs et statistiques du back-office (produits, stocks, commandes),
 * réservés aux administrateurs.
 *
 * Les statistiques (PIL-a) sont recalculées à chaque appel, directement dans la
 * base : rien n'est mis en cache, ni côté serveur ni côté navigateur.
 */
final class StatsController
{
    /** Le modèle qui interroge la base, fourni à la construction. */
    private ProduitModel $produits;

    private CommandeModel $commandes;

    private ParametreModel $parametres;

    /** Nombre de produits dans le classement des plus vendus. */
    private const PLUS_VENDUS = 5;

    public function __construct(ProduitModel $produits, CommandeModel $commandes, ParametreModel $parametres)
    {
        $this->produits   = $produits;
        $this->commandes  = $commandes;
        $this->parametres = $parametres;
    }

    public function index(): void
    {
        self::exigerAdministrateur();

        Response::json($this->produits->statistiques() + ['commandes' => $this->commandes->statistiques()]);
    }

    /**
     * GET /api/admin/statistiques : le tableau de bord statistique (PIL-a).
     *
     * { genereLe, seuil,
     *   stocks: [ { produit, categorie, unites, variantes, etat } ],
     *   revenus: [ { date, commandes, revenu } ],        // 7 jours, du plus ancien au plus récent
     *   commandes: { total, parStatut: { "en cours": 0, … } },
     *   plusVendus: [ { produit, unites, chiffreAffaires } ],
     *   stocksFaibles: [ { produit, variante, stock, etat } ] }
     */
    public function statistiques(): void
    {
        self::exigerAdministrateur();

        header('Cache-Control: no-store');
        Response::json($this->collecter());
    }

    /**
     * GET /api/admin/statistiques/export : les mêmes statistiques en CSV
     * (séparateur « ; », encodage UTF-8 avec BOM : Excel et LibreOffice le lisent
     * correctement en français).
     */
    public function exporter(): void
    {
        self::exigerAdministrateur();

        $stats = $this->collecter();

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="statistiques-razer-' . preg_replace('/\D/', '', substr($stats['genereLe'], 0, 10)) . '-' . preg_replace('/\D/', '', substr($stats['genereLe'], 11)) . '.csv"');
        header('Cache-Control: no-store');

        $sortie = fopen('php://output', 'w');
        fwrite($sortie, "\xEF\xBB\xBF");

        $ecrire = static function (array $ligne) use ($sortie): void {
            fputcsv($sortie, $ligne, ';', '"', '');
        };

        $ecrire(['Statistiques Razer click & collect']);
        $ecrire(['Généré le', $stats['genereLe']]);
        $ecrire([]);

        $ecrire(['Stocks par produit']);
        $ecrire(['Produit', 'Catégorie', 'Unités en stock', 'Variantes']);
        foreach ($stats['stocks'] as $l) {
            $ecrire([$l['produit'], $l['categorie'], $l['unites'], $l['variantes']]);
        }
        $ecrire([]);

        $ecrire(['Revenus des 7 derniers jours (commandes annulées exclues)']);
        $ecrire(['Date', 'Commandes', 'Revenu (EUR)']);
        foreach ($stats['revenus'] as $l) {
            $ecrire([$l['date'], $l['commandes'], $l['revenu']]);
        }
        $ecrire([]);

        $ecrire(['Commandes par statut']);
        $ecrire(['Statut', 'Nombre']);
        foreach ($stats['commandes']['parStatut'] as $statut => $nombre) {
            $ecrire([$statut, $nombre]);
        }
        $ecrire(['Total', $stats['commandes']['total']]);
        $ecrire([]);

        $ecrire(['Produits les plus vendus (commandes annulées exclues)']);
        $ecrire(['Rang', 'Produit', 'Unités vendues', 'Chiffre d\'affaires (EUR)']);
        foreach ($stats['plusVendus'] as $rang => $l) {
            $ecrire([$rang + 1, $l['produit'], $l['unites'], $l['chiffreAffaires']]);
        }
        $ecrire([]);

        $ecrire(['Stocks faibles (seuil : ' . $stats['seuil'] . ' unités ou moins)']);
        $ecrire(['Produit', 'Variante', 'Stock', 'État']);
        foreach ($stats['stocksFaibles'] as $l) {
            $ecrire([$l['produit'], $l['variante'], $l['stock'], $l['etat'] === 'epuise' ? 'Épuisé' : 'Bientôt épuisé']);
        }

        fclose($sortie);
        exit;
    }

    /**
     * Toutes les statistiques, lues dans la base à l'instant de l'appel.
     */
    private function collecter(): array
    {
        $seuil = (int) $this->parametres->valeur('seuil_bientot_epuise', '5');

        $stocks = array_map(static function (array $l) use ($seuil): array {
            $l['etat'] = $l['unites'] <= 0 ? 'epuise' : ($l['unites'] <= $seuil ? 'bientot-epuise' : 'en-stock');
            return $l;
        }, $this->produits->stocksParProduit());

        $faibles = array_map(static function (array $l): array {
            $l['etat'] = $l['stock'] <= 0 ? 'epuise' : 'bientot-epuise';
            return $l;
        }, $this->produits->stocksFaibles($seuil));

        $parStatut = $this->commandes->compterParStatut();

        return [
            'genereLe'      => $this->commandes->maintenant(),
            'seuil'         => $seuil,
            'stocks'        => $stocks,
            'revenus'       => $this->commandes->revenusDesSeptDerniersJours(),
            'commandes'     => ['total' => array_sum($parStatut), 'parStatut' => $parStatut],
            'plusVendus'    => $this->commandes->produitsLesPlusVendus(self::PLUS_VENDUS),
            'stocksFaibles' => $faibles,
        ];
    }

    /**
     * Seule une session ouverte par AdminAuthController compte : être client
     * connecté ne suffit pas. Vérifié ici, côté serveur.
     */
    private static function exigerAdministrateur(): void
    {
        if (!isset($_SESSION['admin_id'])) {
            Response::erreur('Authentification administrateur requise', 401);
        }
    }
}
