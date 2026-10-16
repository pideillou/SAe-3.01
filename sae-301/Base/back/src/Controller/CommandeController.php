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
