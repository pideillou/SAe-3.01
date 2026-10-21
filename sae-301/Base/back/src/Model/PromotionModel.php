<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * La promotion automatique (PRO-c) : le produit dont le stock total est le plus
 * élevé est en promotion, tous les prix de ses variantes baissent de 20 %.
 *
 * Rien n'est enregistré : le produit en promotion est recalculé à chaque
 * consultation d'après les stocks du moment. Quand les stocks changent
 * (commande, annulation, réapprovisionnement), la promotion peut passer à un
 * autre produit. En cas d'égalité, le produit le plus ancien (identifiant le
 * plus petit) l'emporte. Si tout est épuisé, il n'y a pas de promotion.
 *
 * Elle se combine avec un code promotionnel (PRO-a) : le code s'applique au
 * total déjà réduit.
 */
final class PromotionModel
{
    /** Réduction de la promotion automatique, en pourcentage. */
    public const POURCENTAGE = 20;

    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * L'identifiant du produit en promotion, ou null s'il n'y en a pas.
     */
    public function produitEnPromotion(): ?int
    {
        $id = $this->pdo->query(
            'SELECT produit_id
               FROM variante
           GROUP BY produit_id
             HAVING SUM(stock) > 0
           ORDER BY SUM(stock) DESC, produit_id
              LIMIT 1'
        )->fetchColumn();

        return $id === false ? null : (int) $id;
    }

    /**
     * Le prix après la promotion, en euros avec deux décimales (« 151.99 »).
     * Calculé en centimes entiers, la réduction étant arrondie au centime le
     * plus proche (les demis vers le haut) : comme celle des codes promotionnels.
     */
    public static function prixPromotionnel(string $prix): string
    {
        $centimes  = (int) round(((float) $prix) * 100);
        $reduction = CommandeModel::reduction($centimes, self::POURCENTAGE);

        return number_format(($centimes - $reduction) / 100, 2, '.', '');
    }

    /**
     * Applique la promotion à un prix si le produit est celui en promotion.
     *
     * @return array{prix: string, prixBarre: string|null}  prix à payer, et prix
     *         d'origine à barrer (null hors promotion)
     */
    public static function appliquer(string $prix, bool $enPromotion): array
    {
        return $enPromotion
            ? ['prix' => self::prixPromotionnel($prix), 'prixBarre' => number_format((float) $prix, 2, '.', '')]
            : ['prix' => $prix, 'prixBarre' => null];
    }
}
