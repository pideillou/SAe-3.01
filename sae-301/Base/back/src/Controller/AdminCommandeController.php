<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CommandeModel;
use App\Model\StatutInterditException;

/**
 * Gestion des commandes par les administrateurs (PIL-b) : liste triée et
 * filtrée, détail complet, changement de statut (seul ou en lot) et annulation.
 * Réservé aux administrateurs.
 */
final class AdminCommandeController
{
    /** Nombre de commandes renvoyées dans la liste. */
    private const LIMITE = 100;

    /** Nombre maximal de commandes traitées en une action en lot. */
    private const LOT_MAX = 50;

    /** Statuts qu'on peut demander : « en cours » est l'état de départ, jamais une destination. */
    private const STATUTS_DEMANDES = ['disponible', 'retirée', 'annulée'];

    private const STATUTS = ['en cours', 'disponible', 'retirée', 'annulée'];
    private const TRIS    = ['date', 'statut', 'montant', 'numero'];

    /** Forme d'un numéro de commande : RZ-20261016-K7M2QX. */
    private const FORMAT_NUMERO = '/^RZ-\d{8}-[A-Z2-9]{6}$/';

    private CommandeModel $commandes;

    public function __construct(CommandeModel $commandes)
    {
        $this->commandes = $commandes;
    }

    /**
     * GET /api/admin/commandes?tri=date&sens=desc&statut=en cours
     * Un tri, un sens ou un statut inconnu est remplacé par la valeur par défaut.
     */
    public function index(Request $requete): void
    {
        $this->exigerAdministrateur();

        $tri    = $requete->parametre('tri', 'date');
        $sens   = $requete->parametre('sens', 'desc');
        $statut = $requete->parametre('statut');

        $tri    = in_array($tri, self::TRIS, true) ? $tri : 'date';
        $sens   = $sens === 'asc' ? 'asc' : 'desc';
        $statut = in_array($statut, self::STATUTS, true) ? $statut : null;

        $commandes = [];

        foreach ($this->commandes->listerPourAdmin($tri, $sens, $statut, self::LIMITE) as $ligne) {
            $commandes[] = [
                'numero'   => $ligne['numero'],
                'statut'   => $ligne['statut'],
                'suivants' => CommandeModel::statutsSuivants($ligne['statut']),
                'total'    => $ligne['total'],
                'creeLe'   => $ligne['cree_le'],
                'email'    => $ligne['email'],
                'articles' => (int) $ligne['articles'],
            ];
        }

        Response::json([
            'commandes' => $commandes,
            'limite'    => self::LIMITE,
            'tri'       => $tri,
            'sens'      => $sens,
            'statut'    => $statut,
        ]);
    }

    /**
     * GET /api/admin/commande?numero=RZ-20261016-K7M2QX
     */
    public function detail(Request $requete): void
    {
        $this->exigerAdministrateur();

        $numero   = $requete->parametre('numero');
        $commande = $numero !== null && preg_match(self::FORMAT_NUMERO, $numero) === 1
            ? $this->commandes->trouverPourAdmin($numero)
            : null;

        if ($commande === null) {
            Response::erreur('Commande introuvable.', 404);
        }

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

        $journal = [];

        foreach ($commande['journal'] as $entree) {
            $journal[] = [
                'administrateur' => $entree['administrateur_email'],
                'ancien'         => $entree['ancien_statut'],
                'nouveau'        => $entree['nouveau_statut'],
                'creeLe'         => $entree['cree_le'],
            ];
        }

        Response::json([
            'commande' => [
                'numero'   => $commande['numero'],
                'statut'   => $commande['statut'],
                'suivants' => CommandeModel::statutsSuivants($commande['statut']),
                'total'    => $commande['total'],
                'creeLe'   => $commande['cree_le'],
                'email'    => $commande['email'],
                'lignes'   => $lignes,
                'journal'  => $journal,
            ],
        ]);
    }

    /**
     * POST /api/admin/commandes/statut : { numeros: [ "RZ-…" ], statut }
     *
     * Applique le même changement à une ou plusieurs commandes (action en lot).
     * Chaque commande est traitée dans sa propre transaction : une commande
     * refusée n'empêche pas les autres. Le stock n'est remis en rayon que pour
     * « annulée ». La réponse dit, commande par commande, ce qui s'est passé.
     */
    public function changerStatut(Request $requete): void
    {
        $this->exigerAdministrateur();

        $corps   = $requete->corps();
        $statut  = $corps['statut'] ?? null;
        $numeros = $corps['numeros'] ?? null;

        if (!is_string($statut) || !in_array($statut, self::STATUTS_DEMANDES, true)) {
            Response::erreur('Statut demandé invalide.', 422);
        }

        if (!is_array($numeros) || $numeros === [] || count($numeros) > self::LOT_MAX) {
            Response::erreur(sprintf('Choisissez de 1 à %d commandes.', self::LOT_MAX), 422);
        }

        foreach ($numeros as $numero) {
            if (!is_string($numero) || preg_match(self::FORMAT_NUMERO, $numero) !== 1) {
                Response::erreur('Un numéro de commande est invalide.', 422);
            }
        }

        $administrateurId    = (int) $_SESSION['admin_id'];
        $administrateurEmail = (string) ($_SESSION['admin_email'] ?? '');
        $resultats           = [];
        $modifiees           = 0;

        foreach (array_values(array_unique($numeros)) as $numero) {
            try {
                $this->commandes->changerStatut($numero, $statut, $administrateurId, $administrateurEmail);
                $resultats[] = ['numero' => $numero, 'ok' => true];
                $modifiees++;
            } catch (StatutInterditException $e) {
                $resultats[] = ['numero' => $numero, 'ok' => false, 'erreur' => $e->getMessage()];
            }
        }

        Response::json(['statut' => $statut, 'modifiees' => $modifiees, 'resultats' => $resultats]);
    }

    /**
     * Seule une session ouverte par AdminAuthController compte : être client
     * connecté ne suffit pas. Contrôle fait ici, côté serveur.
     */
    private function exigerAdministrateur(): void
    {
        if (!isset($_SESSION['admin_id'])) {
            Response::erreur('Authentification administrateur requise', 401);
        }
    }
}
