<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CommandeImpossibleException;
use App\Model\CommandeModel;

/**
 * Commandes des clients (CMD-a) : validation du panier et consultation d'une
 * commande. Réservé aux clients connectés.
 */
final class CommandeController
{
    /** Nombre maximal de lignes acceptées dans une commande. */
    private const LIGNES_MAX = 50;

    /** Quantité maximale demandée pour une ligne (bien au-dessus de tout stock). */
    private const QUANTITE_MAX = 999;

    /** Forme d'un numéro de commande : RZ-20261016-K7M2QX. */
    /** Nombre de commandes par page de l'historique. */
    private const PAR_PAGE = 10;

    private const FORMAT_NUMERO = '/^RZ-\d{8}-[A-Z2-9]{6}$/';

    private CommandeModel $commandes;

    public function __construct(CommandeModel $commandes)
    {
        $this->commandes = $commandes;
    }

    /**
     * POST /api/commande : { lignes: [ { varianteId, quantite } ] }
     *
     * Seuls les identifiants de variante et les quantités du panier sont
     * utilisés : prix, noms et stocks sont relus en base.
     * 201 avec la commande ; 409 si le stock ne permet pas de la valider.
     */
    public function creer(Request $requete): void
    {
        $utilisateurId = $this->utilisateurConnecte();

        $lignes = $requete->corps()['lignes'] ?? null;

        if (!is_array($lignes) || count($lignes) > self::LIGNES_MAX) {
            Response::erreur('Le panier envoyé est invalide.', 422);
        }

        if ($lignes === []) {
            Response::erreur('Votre panier est vide.', 422);
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

        try {
            $commande = $this->commandes->creer($utilisateurId, $demandes);
        } catch (CommandeImpossibleException $e) {
            Response::json([
                'erreur'    => 'Votre commande n\'a pas été enregistrée : le stock a changé. Vérifiez votre panier.',
                'problemes' => $e->problemes(),
            ], 409);
        }

        Response::json(['commande' => self::formater($commande)], 201);
    }

    /**
     * GET /api/commande?numero=RZ-20261016-K7M2QX
     * Une commande qui n'est pas celle de l'utilisateur connecté est introuvable.
     */
    public function detail(Request $requete): void
    {
        $utilisateurId = $this->utilisateurConnecte();
        $numero        = $requete->parametre('numero');

        if ($numero === null || preg_match(self::FORMAT_NUMERO, $numero) !== 1) {
            Response::erreur('Commande introuvable', 404);
        }

        $commande = $this->commandes->trouverParNumero($numero, $utilisateurId);

        if ($commande === null) {
            Response::erreur('Commande introuvable', 404);
        }

        Response::json(['commande' => self::formater($commande)]);
    }

    /**
     * GET /api/commandes?statut=&du=&au=&page=1 : l'historique du client
     * connecté, de la plus récente à la plus ancienne, par pages de 10.
     * statut : en cours, disponible, retirée ou annulée ; du et au : dates
     * AAAA-MM-JJ, incluses. Une valeur invalide donne une réponse 422.
     */
    public function historique(Request $requete): void
    {
        $utilisateurId = $this->utilisateurConnecte();

        $statut = $requete->parametre('statut');
        $statut = $statut === '' ? null : $statut;

        if ($statut !== null && !in_array($statut, CommandeModel::STATUTS, true)) {
            Response::erreur('Ce statut n\'existe pas.', 422);
        }

        $du = self::dateOuNull($requete->parametre('du'), 'de début');
        $au = self::dateOuNull($requete->parametre('au'), 'de fin');

        if ($du !== null && $au !== null && $du > $au) {
            Response::erreur('La date de début doit précéder la date de fin.', 422);
        }

        $page = $requete->parametre('page', '1');
        $page = ctype_digit((string) $page) && (int) $page >= 1 ? (int) $page : 1;

        $resultat = $this->commandes->listerPourClient($utilisateurId, $statut, $du, $au, self::PAR_PAGE, ($page - 1) * self::PAR_PAGE);

        $pages = max(1, (int) ceil($resultat['total'] / self::PAR_PAGE));

        // Une page au-delà de la dernière (filtre resserré entre-temps) : la dernière.
        if ($page > $pages) {
            $page     = $pages;
            $resultat = $this->commandes->listerPourClient($utilisateurId, $statut, $du, $au, self::PAR_PAGE, ($page - 1) * self::PAR_PAGE);
        }

        $commandes = [];

        foreach ($resultat['commandes'] as $commande) {
            $lignes = [];

            foreach ($commande['lignes'] as $ligne) {
                $lignes[] = [
                    'produitNom' => $ligne['produit_nom'],
                    'nom'        => $ligne['variante_nom'],
                    'options'    => $ligne['options'] ?? '',
                    'quantite'   => (int) $ligne['quantite'],
                ];
            }

            $commandes[] = [
                'numero'   => $commande['numero'],
                'statut'   => $commande['statut'],
                'total'    => $commande['total'],
                'creeLe'   => $commande['cree_le'],
                'articles' => array_sum(array_column($lignes, 'quantite')),
                'lignes'   => $lignes,
            ];
        }

        Response::json([
            'commandes' => $commandes,
            'total'     => $resultat['total'],
            'page'      => $page,
            'pages'     => $pages,
            'parPage'   => self::PAR_PAGE,
        ]);
    }

    /**
     * Une date AAAA-MM-JJ valide, ou null si le paramètre est absent ou vide.
     * Une date impossible (31 février) donne une réponse 422.
     */
    private static function dateOuNull(?string $valeur, string $nom): ?string
    {
        if ($valeur === null || $valeur === '') {
            return null;
        }

        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $valeur);

        if ($date === false || $date->format('Y-m-d') !== $valeur) {
            Response::erreur("La date $nom n'est pas valide.", 422);
        }

        return $valeur;
    }

    /**
     * L'identifiant du client connecté, ou une réponse 401. L'état de la session
     * est vérifié ici, côté serveur : masquer un bouton dans le front ne suffit pas.
     */
    private function utilisateurConnecte(): int
    {
        if (!isset($_SESSION['utilisateur_id'])) {
            Response::erreur('Connectez-vous pour passer commande.', 401);
        }

        return (int) $_SESSION['utilisateur_id'];
    }

    private static function formater(array $commande): array
    {
        $lignes = [];

        foreach ($commande['lignes'] as $ligne) {
            $lignes[] = [
                'produitNom'   => $ligne['produit_nom'],
                'produitSlug'  => $ligne['produit_slug'],
                'nom'          => $ligne['variante_nom'],
                'options'      => $ligne['options'] ?? '',
                'image'        => $ligne['image'],
                'prixUnitaire' => $ligne['prix_unitaire'],
                'quantite'     => (int) $ligne['quantite'],
            ];
        }

        return [
            'numero'  => $commande['numero'],
            'statut'  => $commande['statut'],
            'total'   => $commande['total'],
            'creeLe'  => $commande['cree_le'],
            'email'   => $commande['email'],
            'lignes'  => $lignes,
        ];
    }
}
