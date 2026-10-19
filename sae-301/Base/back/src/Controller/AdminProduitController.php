<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CategorieModel;
use App\Model\ImageProduitModel;
use App\Model\ParametreModel;
use App\Model\ProduitAdminModel;
use App\Service\FichiersImages;
use App\Service\Slug;

/**
 * Gestion des produits par les administrateurs (GOF-a) : liste, détail,
 * création, modification et suppression d'un produit avec ses options, ses
 * variantes (prix, stock) et son seuil « Bientôt épuisé ». Les images ont leur
 * propre contrôleur (AdminImageController).
 */
final class AdminProduitController
{
    private const NOM_MIN         = 2;
    private const NOM_MAX         = 120;
    private const ACCROCHE_MAX    = 255;
    private const DESCRIPTION_MAX = 10000;
    private const POINT_FORT_MAX  = 200;
    private const POINTS_FORTS    = 6;
    private const OPTIONS_MAX     = 3;
    private const VALEURS_MAX     = 20;
    private const NOM_OPTION_MAX  = 60;
    private const VALEUR_MAX      = 80;
    private const VARIANTES_MAX   = 100;
    private const REFERENCE_MAX   = 30;
    private const PRIX_MAX        = 99999.99;
    private const STOCK_MAX       = 65535;
    private const SEUIL_MAX       = 1000;

    /** Clé du paramètre « Bientôt épuisé » dans la table parametre. */
    private const CLE_SEUIL = 'seuil_bientot_epuise';

    private ProduitAdminModel $produits;
    private CategorieModel $categories;
    private ImageProduitModel $images;
    private ParametreModel $parametres;
    private FichiersImages $fichiers;

    public function __construct(
        ProduitAdminModel $produits,
        CategorieModel $categories,
        ImageProduitModel $images,
        ParametreModel $parametres,
        FichiersImages $fichiers,
    ) {
        $this->produits   = $produits;
        $this->categories = $categories;
        $this->images     = $images;
        $this->parametres = $parametres;
        $this->fichiers   = $fichiers;
    }

    /**
     * GET /api/admin/produits : les produits et le seuil « Bientôt épuisé ».
     */
    public function index(): void
    {
        $this->exigerAdministrateur();

        $seuil   = $this->seuil();
        $produits = [];

        foreach ($this->produits->lister() as $ligne) {
            $stockMax = (int) $ligne['stock_max'];

            $produits[] = [
                'id'         => (int) $ligne['id'],
                'nom'        => $ligne['nom'],
                'slug'       => $ligne['slug'],
                'categorie'  => $ligne['categorie_nom'],
                'variantes'  => (int) $ligne['variantes'],
                'stockTotal' => (int) $ligne['stock_total'],
                'etat'       => $stockMax <= 0 ? 'epuise' : ($stockMax <= $seuil ? 'bientot-epuise' : 'en-stock'),
                'prixMin'    => $ligne['prix_min'],
                'prixMax'    => $ligne['prix_max'],
            ];
        }

        Response::json(['produits' => $produits, 'seuil' => $seuil]);
    }

    /**
     * GET /api/admin/produit?id=12 : un produit complet, avec ses images.
     */
    public function detail(Request $requete): void
    {
        $this->exigerAdministrateur();

        $id = (int) ($requete->parametre('id') ?? 0);

        $produit = $id > 0 ? $this->produits->trouverComplet($id) : null;

        if ($produit === null) {
            Response::erreur('Produit introuvable.', 404);
        }

        Response::json(['produit' => $this->formater($produit)]);
    }

    /**
     * POST /api/admin/produits : crée un produit (voir lireProduit pour le corps).
     */
    public function creer(Request $requete): void
    {
        $this->exigerAdministrateur();

        [$produit, $erreurs] = $this->lireProduit($requete->corps());

        $produit['slug'] = Slug::de($produit['nom']);

        if ($produit['slug'] === '' && !isset($erreurs['nom'])) {
            $erreurs['nom'] = 'Le nom doit contenir au moins une lettre ou un chiffre.';
        }

        if ($erreurs !== []) {
            self::refuser($erreurs);
        }

        $id = $this->produits->enregistrer(null, $produit);

        if (is_array($id)) {
            self::refuserDoublon($id['doublon']);
        }

        Response::json(['produit' => $this->formater($this->produits->trouverComplet($id))], 201);
    }

    /**
     * POST /api/admin/produits/modifier : { id, … } (même corps que la création).
     * L'adresse du produit (slug) ne change pas, pour garder les liens valables.
     */
    public function modifier(Request $requete): void
    {
        $this->exigerAdministrateur();

        $corps = $requete->corps();
        $id    = is_int($corps['id'] ?? null) ? $corps['id'] : 0;

        if ($id < 1 || $this->produits->trouverComplet($id) === null) {
            Response::erreur('Produit introuvable.', 404);
        }

        [$produit, $erreurs] = $this->lireProduit($corps);

        if ($erreurs !== []) {
            self::refuser($erreurs);
        }

        $resultat = $this->produits->enregistrer($id, $produit);

        if (is_array($resultat)) {
            self::refuserDoublon($resultat['doublon']);
        }

        Response::json(['produit' => $this->formater($this->produits->trouverComplet($id))]);
    }

    /**
     * POST /api/admin/produits/supprimer : { id }
     * Les commandes passées gardent leur copie du produit.
     */
    public function supprimer(Request $requete): void
    {
        $this->exigerAdministrateur();

        $id       = $requete->corps()['id'] ?? null;
        $fichiers = is_int($id) && $id > 0 ? $this->produits->supprimer($id) : null;

        if ($fichiers === null) {
            Response::erreur('Produit introuvable.', 404);
        }

        $this->fichiers->supprimer($fichiers);

        Response::json(['supprime' => true]);
    }

    /**
     * POST /api/admin/seuil : { valeur }, le seuil « Bientôt épuisé ».
     */
    public function definirSeuil(Request $requete): void
    {
        $this->exigerAdministrateur();

        $valeur = $requete->corps()['valeur'] ?? null;

        if (!is_int($valeur) || $valeur < 0 || $valeur > self::SEUIL_MAX) {
            self::refuser(['seuil' => sprintf('Le seuil doit être un nombre entier de 0 à %d.', self::SEUIL_MAX)]);
        }

        $this->parametres->definir(self::CLE_SEUIL, (string) $valeur);

        Response::json(['seuil' => $valeur]);
    }

    private function seuil(): int
    {
        return (int) $this->parametres->valeur(self::CLE_SEUIL, '5');
    }

    private function exigerAdministrateur(): void
    {
        if (!isset($_SESSION['admin_id'])) {
            Response::erreur('Authentification administrateur requise', 401);
        }
    }

    /**
     * Lit et valide le corps d'une création ou d'une modification.
     *
     * Les erreurs sont indexées par un chemin lisible par le front : « nom »,
     * « options.0.valeurs », « variantes.2.prix »…
     *
     * @return array{0: array, 1: array<string, string>}  produit nettoyé, erreurs
     */
    private function lireProduit(array $corps): array
    {
        $erreurs = [];

        $nom         = is_string($corps['nom'] ?? null) ? trim($corps['nom']) : '';
        $accroche    = is_string($corps['accroche'] ?? null) ? trim($corps['accroche']) : '';
        $description = is_string($corps['description'] ?? null) ? trim($corps['description']) : '';
        $categorieId = $corps['categorieId'] ?? null;

        if ($nom === '') {
            $erreurs['nom'] = 'Saisissez le nom du produit.';
        } elseif (mb_strlen($nom) < self::NOM_MIN || mb_strlen($nom) > self::NOM_MAX) {
            $erreurs['nom'] = sprintf('Le nom doit faire entre %d et %d caractères.', self::NOM_MIN, self::NOM_MAX);
        }

        if (mb_strlen($accroche) > self::ACCROCHE_MAX) {
            $erreurs['accroche'] = sprintf("L'accroche ne doit pas dépasser %d caractères.", self::ACCROCHE_MAX);
        }

        if ($description === '') {
            $erreurs['description'] = 'Saisissez la description du produit.';
        } elseif (mb_strlen($description) > self::DESCRIPTION_MAX) {
            $erreurs['description'] = sprintf('La description ne doit pas dépasser %d caractères.', self::DESCRIPTION_MAX);
        }

        if (!is_int($categorieId) || $this->categories->trouverParId($categorieId) === null) {
            $erreurs['categorieId'] = 'Choisissez une catégorie.';
        }

        // Points forts : une ligne chacun, les lignes vides sont ignorées.
        $points = [];

        foreach (is_array($corps['caracteristiques'] ?? null) ? $corps['caracteristiques'] : [] as $point) {
            $point = is_string($point) ? trim($point) : '';

            if ($point !== '') {
                $points[] = $point;
            }
        }

        if (count($points) > self::POINTS_FORTS) {
            $erreurs['caracteristiques'] = sprintf('Pas plus de %d points forts.', self::POINTS_FORTS);
        } elseif (array_filter($points, fn (string $p): bool => mb_strlen($p) > self::POINT_FORT_MAX) !== []) {
            $erreurs['caracteristiques'] = sprintf('Un point fort ne doit pas dépasser %d caractères.', self::POINT_FORT_MAX);
        }

        [$options, $erreursOptions] = $this->lireOptions($corps['options'] ?? []);
        [$variantes, $erreursVariantes] = $this->lireVariantes(
            $corps['variantes'] ?? [],
            $options,
            $nom,
        );

        return [
            [
                'categorie_id'     => is_int($categorieId) ? $categorieId : 0,
                'nom'              => $nom,
                'accroche'         => $accroche === '' ? null : $accroche,
                'description'      => $description,
                'caracteristiques' => $points === [] ? null : implode("\n", $points),
                'options'          => $options,
                'variantes'        => $variantes,
            ],
            $erreurs + $erreursOptions + $erreursVariantes,
        ];
    }

    /**
     * @return array{0: array<int, array{nom: string, valeurs: string[]}>, 1: array<string, string>}
     */
    private function lireOptions(mixed $brut): array
    {
        $erreurs = [];
        $options = [];

        if (!is_array($brut) || count($brut) > self::OPTIONS_MAX) {
            return [[], ['options' => sprintf('Un produit a au plus %d options.', self::OPTIONS_MAX)]];
        }

        $nomsVus = [];

        foreach (array_values($brut) as $i => $option) {
            $nom     = is_array($option) && is_string($option['nom'] ?? null) ? trim($option['nom']) : '';
            $valeurs = [];

            if ($nom === '' || mb_strlen($nom) > self::NOM_OPTION_MAX) {
                $erreurs["options.$i.nom"] = sprintf("Le nom de l'option doit faire de 1 à %d caractères.", self::NOM_OPTION_MAX);
            } elseif (isset($nomsVus[mb_strtolower($nom)])) {
                $erreurs["options.$i.nom"] = 'Deux options ne peuvent pas porter le même nom.';
            }

            $nomsVus[mb_strtolower($nom)] = true;
            $vues = [];

            foreach (is_array($option['valeurs'] ?? null) ? $option['valeurs'] : [] as $valeur) {
                $valeur = is_string($valeur) ? trim($valeur) : '';

                if ($valeur === '') {
                    continue;
                }

                if (mb_strlen($valeur) > self::VALEUR_MAX) {
                    $erreurs["options.$i.valeurs"] = sprintf('Une valeur ne doit pas dépasser %d caractères.', self::VALEUR_MAX);
                } elseif (isset($vues[mb_strtolower($valeur)])) {
                    $erreurs["options.$i.valeurs"] = sprintf('La valeur « %s » est écrite deux fois.', $valeur);
                }

                $vues[mb_strtolower($valeur)] = true;
                $valeurs[] = $valeur;
            }

            if ($valeurs === []) {
                $erreurs["options.$i.valeurs"] = 'Indiquez au moins une valeur pour cette option.';
            } elseif (count($valeurs) > self::VALEURS_MAX) {
                $erreurs["options.$i.valeurs"] = sprintf('Pas plus de %d valeurs par option.', self::VALEURS_MAX);
            }

            $options[] = ['nom' => $nom, 'valeurs' => $valeurs];
        }

        return [$options, $erreurs];
    }

    /**
     * @param array<int, array{nom: string, valeurs: string[]}> $options
     * @return array{0: array, 1: array<string, string>}
     */
    private function lireVariantes(mixed $brut, array $options, string $nomProduit): array
    {
        $erreurs = [];

        if (!is_array($brut) || $brut === [] || count($brut) > self::VARIANTES_MAX) {
            return [[], ['variantes' => sprintf('Un produit a de 1 à %d variantes.', self::VARIANTES_MAX)]];
        }

        if ($options === [] && count($brut) !== 1) {
            return [[], ['variantes' => 'Sans option, un produit a une seule variante.']];
        }

        $variantes   = [];
        $references  = [];
        $combinaisons = [];
        $defaut      = null;

        foreach (array_values($brut) as $i => $variante) {
            $variante = is_array($variante) ? $variante : [];

            $reference = is_string($variante['reference'] ?? null) ? trim($variante['reference']) : '';
            $prix      = self::lirePrix($variante['prix'] ?? null);
            $stock     = $variante['stock'] ?? null;

            if ($reference === '' || mb_strlen($reference) > self::REFERENCE_MAX) {
                $erreurs["variantes.$i.reference"] = sprintf('La référence doit faire de 1 à %d caractères.', self::REFERENCE_MAX);
            } elseif (isset($references[mb_strtolower($reference)])) {
                $erreurs["variantes.$i.reference"] = 'Cette référence est déjà utilisée par une autre variante.';
            }

            $references[mb_strtolower($reference)] = true;

            if ($prix === null) {
                $erreurs["variantes.$i.prix"] = sprintf('Le prix doit être un montant de 0 à %s €, avec au plus 2 décimales.', number_format(self::PRIX_MAX, 2, ',', ' '));
            }

            if (!is_int($stock) || $stock < 0 || $stock > self::STOCK_MAX) {
                $erreurs["variantes.$i.stock"] = sprintf('Le stock doit être un nombre entier de 0 à %d.', self::STOCK_MAX);
                $stock = 0;
            }

            // Une valeur par option, choisie parmi celles de l'option.
            $valeurs = [];
            $cle     = [];

            foreach ($options as $position => $option) {
                $valeur  = is_array($variante['valeurs'] ?? null) ? ($variante['valeurs'][$position] ?? null) : null;
                $valeur  = is_string($valeur) ? trim($valeur) : '';
                $reconnue = null;

                foreach ($option['valeurs'] as $candidate) {
                    if (mb_strtolower($candidate) === mb_strtolower($valeur)) {
                        $reconnue = $candidate;
                    }
                }

                if ($reconnue === null) {
                    $erreurs["variantes.$i.valeurs"] = sprintf('Choisissez une valeur pour « %s ».', $option['nom']);
                } else {
                    $valeurs[] = $reconnue;
                    $cle[]     = mb_strtolower($reconnue);
                }
            }

            if (count($valeurs) === count($options)) {
                $signature = implode("\0", $cle);

                if (isset($combinaisons[$signature])) {
                    $erreurs["variantes.$i.valeurs"] = 'Une autre variante a déjà exactement cette combinaison d\'options.';
                }

                $combinaisons[$signature] = true;
            }

            $nom = is_string($variante['nom'] ?? null) ? trim($variante['nom']) : '';
            $nom = $nom !== '' ? $nom : implode(' - ', array_merge([$nomProduit], $valeurs));

            if (mb_strlen($nom) > 160) {
                $erreurs["variantes.$i.nom"] = 'Le nom de la variante ne doit pas dépasser 160 caractères.';
            }

            if (($variante['defaut'] ?? false) === true && $defaut === null) {
                $defaut = $i;
            }

            $variantes[] = [
                'id'        => is_int($variante['id'] ?? null) ? $variante['id'] : null,
                'reference' => $reference,
                'nom'       => $nom,
                'prix'      => $prix ?? '0.00',
                'stock'     => $stock,
                'defaut'    => false,
                'valeurs'   => $valeurs,
            ];
        }

        // Exactement une variante par défaut : la première cochée, sinon la première.
        $variantes[$defaut ?? 0]['defaut'] = true;

        return [$variantes, $erreurs];
    }

    /**
     * « 189,99 », "189.99" ou 189.99 -> "189.99" ; null si le montant est invalide.
     */
    private static function lirePrix(mixed $brut): ?string
    {
        if (is_int($brut) || is_float($brut)) {
            $brut = (string) $brut;
        }

        if (!is_string($brut)) {
            return null;
        }

        $brut = str_replace(',', '.', trim($brut));

        if (preg_match('/^\d{1,5}(\.\d{1,2})?$/', $brut) !== 1 || (float) $brut > self::PRIX_MAX) {
            return null;
        }

        return number_format((float) $brut, 2, '.', '');
    }

    /**
     * Le produit au format de l'API, avec ses images.
     */
    private function formater(array $produit): array
    {
        $images = [];

        foreach ($this->images->listerPourProduit((int) $produit['id']) as $image) {
            $images[] = self::formaterImage($image);
        }

        return [
            'id'               => (int) $produit['id'],
            'nom'              => $produit['nom'],
            'slug'             => $produit['slug'],
            'categorieId'      => (int) $produit['categorie_id'],
            'accroche'         => $produit['accroche'] ?? '',
            'description'      => $produit['description'],
            'caracteristiques' => $produit['caracteristiques'] === null || $produit['caracteristiques'] === ''
                ? []
                : explode("\n", $produit['caracteristiques']),
            'options'          => $produit['options'],
            'variantes'        => $produit['variantes'],
            'images'           => $images,
        ];
    }

    /**
     * Une image au format de l'API (partagé avec AdminImageController).
     */
    public static function formaterImage(array $image): array
    {
        return [
            'id'          => (int) $image['id'],
            'varianteId'  => $image['variante_id'] === null ? null : (int) $image['variante_id'],
            'moyen'       => $image['chemin_moyen'],
            'grand'       => $image['chemin_grand'],
            'alt'         => $image['texte_alt'],
            'principale'  => (int) $image['est_principale'] === 1,
            'ordre'       => (int) $image['ordre'],
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
     * Réponse 409 : un nom, une adresse ou une référence déjà pris.
     */
    private static function refuserDoublon(string $doublon): void
    {
        if (str_starts_with($doublon, 'reference:')) {
            $reference = substr($doublon, strlen('reference:'));
            $message   = sprintf('La référence « %s » est déjà utilisée par un autre produit.', $reference);

            Response::json(['erreur' => $message, 'champs' => ['variantes' => $message]], 409);
        }

        $message = $doublon === 'slug'
            ? 'Un produit a déjà un nom très proche (même adresse de page).'
            : 'Un produit porte déjà ce nom.';

        Response::json(['erreur' => $message, 'champs' => ['nom' => $message]], 409);
    }
}
