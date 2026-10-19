<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CategorieModel;

/**
 * Gestion des catégories par les administrateurs (GOF-c) : liste, création,
 * modification et suppression.
 *
 * Règle pour les produits d'une catégorie supprimée : la suppression est
 * BLOQUÉE tant que la catégorie contient des produits. L'administrateur doit
 * d'abord les déplacer ou les retirer.
 */
final class AdminCategorieController
{
    private const NOM_MIN         = 2;
    private const NOM_MAX         = 60;
    private const DESCRIPTION_MAX = 1000;
    private const ORDRE_MAX       = 255;

    private CategorieModel $categories;

    public function __construct(CategorieModel $categories)
    {
        $this->categories = $categories;
    }

    /**
     * GET /api/admin/categories
     */
    public function index(): void
    {
        $this->exigerAdministrateur();

        $categories = [];

        foreach ($this->categories->listerPourAdmin() as $ligne) {
            $categories[] = self::formater($ligne, (int) $ligne['nombre']);
        }

        Response::json(['categories' => $categories, 'ordreSuivant' => $this->categories->ordreMaximal() + 1]);
    }

    /**
     * POST /api/admin/categories : { nom, description, ordre }
     */
    public function creer(Request $requete): void
    {
        $this->exigerAdministrateur();

        [$nom, $description, $ordre, $erreurs] = $this->lireFormulaire($requete->corps());

        $slug = self::slugDe($nom);

        if ($slug === '' && !isset($erreurs['nom'])) {
            $erreurs['nom'] = 'Le nom doit contenir au moins une lettre ou un chiffre.';
        }

        if ($erreurs !== []) {
            self::refuser($erreurs);
        }

        $id = $this->categories->creer($nom, $slug, $description, $ordre);

        if (is_string($id)) {
            self::refuserDoublon($id);
        }

        $categorie = $this->categories->trouverParId($id);

        Response::json(['categorie' => self::formater($categorie, 0)], 201);
    }

    /**
     * POST /api/admin/categories/modifier : { id, nom, description, ordre }
     */
    public function modifier(Request $requete): void
    {
        $this->exigerAdministrateur();

        $corps = $requete->corps();
        $id    = self::identifiant($corps);

        if ($this->categories->trouverParId($id) === null) {
            Response::erreur('Catégorie introuvable.', 404);
        }

        [$nom, $description, $ordre, $erreurs] = $this->lireFormulaire($corps);

        if ($nom !== '' && !isset($erreurs['nom']) && self::slugDe($nom) === '') {
            $erreurs['nom'] = 'Le nom doit contenir au moins une lettre ou un chiffre.';
        }

        if ($erreurs !== []) {
            self::refuser($erreurs);
        }

        $resultat = $this->categories->modifier($id, $nom, $description, $ordre);

        if (is_string($resultat)) {
            self::refuserDoublon($resultat);
        }

        $categorie = $this->categories->trouverParId($id);

        Response::json(['categorie' => self::formater($categorie, $this->categories->compterProduits($id))]);
    }

    /**
     * POST /api/admin/categories/supprimer : { id }
     * 409 tant que la catégorie contient des produits.
     */
    public function supprimer(Request $requete): void
    {
        $this->exigerAdministrateur();

        $id        = self::identifiant($requete->corps());
        $categorie = $this->categories->trouverParId($id);

        if ($categorie === null) {
            Response::erreur('Catégorie introuvable.', 404);
        }

        $resultat = $this->categories->supprimer($id);

        if ($resultat === 'produits') {
            $nombre = $this->categories->compterProduits($id);

            Response::erreur(
                sprintf(
                    'La catégorie « %s » contient encore %d produit%s : déplacez-%s ou retirez-%s avant de la supprimer.',
                    $categorie['nom'],
                    $nombre,
                    $nombre > 1 ? 's' : '',
                    $nombre > 1 ? 'les' : 'le',
                    $nombre > 1 ? 'les' : 'le',
                ),
                409,
            );
        }

        if ($resultat === 'inconnue') {
            Response::erreur('Catégorie introuvable.', 404);
        }

        Response::json(['supprimee' => true]);
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

    /**
     * Lit et valide le formulaire d'une catégorie.
     *
     * @return array{0: string, 1: ?string, 2: int, 3: array<string, string>}
     *         nom, description (null si vide), ordre, erreurs par champ
     */
    private function lireFormulaire(array $corps): array
    {
        $nom         = is_string($corps['nom'] ?? null) ? trim($corps['nom']) : '';
        $description = is_string($corps['description'] ?? null) ? trim($corps['description']) : '';
        $ordre       = $corps['ordre'] ?? null;
        $erreurs     = [];

        if ($nom === '') {
            $erreurs['nom'] = 'Saisissez le nom de la catégorie.';
        } elseif (mb_strlen($nom) < self::NOM_MIN || mb_strlen($nom) > self::NOM_MAX) {
            $erreurs['nom'] = sprintf('Le nom doit faire entre %d et %d caractères.', self::NOM_MIN, self::NOM_MAX);
        }

        if (mb_strlen($description) > self::DESCRIPTION_MAX) {
            $erreurs['description'] = sprintf('La description ne doit pas dépasser %d caractères.', self::DESCRIPTION_MAX);
        }

        if ($ordre === null || $ordre === '') {
            $ordre = $this->categories->ordreMaximal() + 1;
        }

        if (!is_int($ordre) || $ordre < 0 || $ordre > self::ORDRE_MAX) {
            $erreurs['ordre'] = sprintf("L'ordre d'affichage doit être un nombre entier de 0 à %d.", self::ORDRE_MAX);
            $ordre = 0;
        }

        return [$nom, $description === '' ? null : $description, $ordre, $erreurs];
    }

    private static function identifiant(array $corps): int
    {
        $id = $corps['id'] ?? null;

        if (!is_int($id) || $id < 1) {
            Response::erreur('Catégorie introuvable.', 404);
        }

        return $id;
    }

    /**
     * « Écrans & Moniteurs » -> « ecrans-moniteurs » : minuscules, sans accents,
     * les autres caractères remplacés par des tirets.
     */
    private static function slugDe(string $nom): string
    {
        $slug = strtr(
            mb_strtolower($nom),
            [
                'à' => 'a', 'â' => 'a', 'ä' => 'a', 'á' => 'a', 'ã' => 'a', 'å' => 'a', 'ç' => 'c',
                'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'í' => 'i', 'ì' => 'i', 'î' => 'i',
                'ï' => 'i', 'ñ' => 'n', 'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'ö' => 'o', 'õ' => 'o',
                'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ý' => 'y', 'ÿ' => 'y', 'œ' => 'oe', 'æ' => 'ae',
            ]
        );

        return trim((string) preg_replace('/[^a-z0-9]+/', '-', $slug), '-');
    }

    private static function formater(array $ligne, int $nombre): array
    {
        return [
            'id'          => (int) $ligne['id'],
            'nom'         => $ligne['nom'],
            'slug'        => $ligne['slug'],
            'description' => $ligne['description'],
            'ordre'       => (int) $ligne['ordre'],
            'nombre'      => $nombre,
        ];
    }

    /**
     * Réponse 422 : un message par champ fautif. Ne rend pas la main.
     *
     * @param array<string, string> $champs
     */
    private static function refuser(array $champs): void
    {
        Response::json(['erreur' => 'Le formulaire contient des erreurs.', 'champs' => $champs], 422);
    }

    /**
     * Réponse 409 : une autre catégorie porte déjà ce nom (ou une adresse
     * identique, quand les noms ne diffèrent que par la casse ou les accents).
     */
    private static function refuserDoublon(string $champ): void
    {
        $message = $champ === 'slug'
            ? 'Une catégorie a déjà un nom très proche (même adresse de page).'
            : 'Une catégorie porte déjà ce nom.';

        Response::json(['erreur' => $message, 'champs' => ['nom' => $message]], 409);
    }
}
