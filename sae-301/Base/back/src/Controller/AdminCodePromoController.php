<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CodePromoModel;

/**
 * Gestion des codes promotionnels par les administrateurs (PRO-b) : liste avec
 * statistiques d'utilisation, création, modification du pourcentage et de
 * l'état, suppression.
 *
 * Le nom d'un code ne se modifie pas : les commandes déjà passées y sont
 * rattachées par ce nom. Pour en changer, on crée un nouveau code et on
 * désactive l'ancien.
 */
final class AdminCodePromoController
{
    private CodePromoModel $codes;

    public function __construct(CodePromoModel $codes)
    {
        $this->codes = $codes;
    }

    /**
     * GET /api/admin/codes-promo
     *
     * { codes: [ { id, code, pourcentage, actif, creeLe, utilisations, annulees,
     *              reductionTotale, chiffreAffaires } ],
     *   resume: { codes, actifs, utilisations, reductionTotale, chiffreAffaires } }
     */
    public function index(): void
    {
        $this->exigerAdministrateur();

        $codes = $this->codes->listerPourAdmin();

        $reduction = 0;
        $chiffre   = 0;
        foreach ($codes as $code) {
            $reduction += (int) round((float) $code['reductionTotale'] * 100);
            $chiffre   += (int) round((float) $code['chiffreAffaires'] * 100);
        }

        Response::json([
            'codes'  => $codes,
            'resume' => [
                'codes'           => count($codes),
                'actifs'          => count(array_filter($codes, static fn (array $c): bool => $c['actif'])),
                'utilisations'    => array_sum(array_column($codes, 'utilisations')),
                'reductionTotale' => number_format($reduction / 100, 2, '.', ''),
                'chiffreAffaires' => number_format($chiffre / 100, 2, '.', ''),
            ],
        ]);
    }

    /**
     * POST /api/admin/codes-promo : { code, pourcentage, actif }
     * 201 avec le code ; 422 si le formulaire est invalide ; 409 si le code existe.
     */
    public function creer(Request $requete): void
    {
        $this->exigerAdministrateur();

        $corps  = $requete->corps();
        $saisie = is_string($corps['code'] ?? null) ? trim($corps['code']) : '';
        $code   = CodePromoModel::normaliser($saisie);
        $erreurs = [];

        if ($saisie === '') {
            $erreurs['code'] = 'Saisissez le code.';
        } elseif ($code === null) {
            $erreurs['code'] = 'Le code doit faire 2 à 30 caractères : lettres sans accent, chiffres, tiret ou tiret bas.';
        }

        [$pourcentage, $actif, $autres] = $this->lireReduction($corps);
        $erreurs += $autres;

        if ($erreurs !== []) {
            self::refuser($erreurs);
        }

        $id = $this->codes->creer($code, $pourcentage, $actif);

        if ($id === null) {
            Response::json([
                'erreur' => 'Ce code existe déjà.',
                'champs' => ['code' => 'Ce code existe déjà.'],
            ], 409);
        }

        Response::json(['code' => $this->codes->trouverParId($id)], 201);
    }

    /**
     * POST /api/admin/codes-promo/modifier : { id, pourcentage, actif }
     */
    public function modifier(Request $requete): void
    {
        $this->exigerAdministrateur();

        $corps = $requete->corps();
        $id    = self::identifiant($corps);

        if ($this->codes->trouverParId($id) === null) {
            Response::erreur('Code promo introuvable.', 404);
        }

        [$pourcentage, $actif, $erreurs] = $this->lireReduction($corps);

        if ($erreurs !== []) {
            self::refuser($erreurs);
        }

        $this->codes->modifier($id, $pourcentage, $actif);

        Response::json(['code' => $this->codes->trouverParId($id)]);
    }

    /**
     * POST /api/admin/codes-promo/supprimer : { id }
     */
    public function supprimer(Request $requete): void
    {
        $this->exigerAdministrateur();

        $id = self::identifiant($requete->corps());

        if ($this->codes->trouverParId($id) === null) {
            Response::erreur('Code promo introuvable.', 404);
        }

        $this->codes->supprimer($id);

        Response::json(['supprime' => true]);
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
     * Lit le pourcentage et l'état du formulaire.
     *
     * @return array{0: int, 1: bool, 2: array<string, string>}  pourcentage, actif, erreurs par champ
     */
    private function lireReduction(array $corps): array
    {
        $pourcentage = $corps['pourcentage'] ?? null;
        $erreurs     = [];

        if (!is_int($pourcentage) || $pourcentage < 1 || $pourcentage > 100) {
            $erreurs['pourcentage'] = 'Le pourcentage doit être un nombre entier de 1 à 100.';
            $pourcentage = 0;
        }

        // Un code sans « actif » précisé est actif.
        $actif = $corps['actif'] ?? true;

        if (!is_bool($actif)) {
            $erreurs['actif'] = 'L\'état du code est invalide.';
            $actif = true;
        }

        return [$pourcentage, $actif, $erreurs];
    }

    private static function identifiant(array $corps): int
    {
        $id = $corps['id'] ?? null;

        if (!is_int($id) || $id < 1) {
            Response::erreur('Code promo introuvable.', 404);
        }

        return $id;
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
}
