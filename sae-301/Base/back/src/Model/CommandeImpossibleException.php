<?php

declare(strict_types=1);

namespace App\Model;

use RuntimeException;

/**
 * La commande ne peut pas être enregistrée parce que le stock ne le permet pas
 * (variante épuisée, supprimée, ou quantité supérieure au stock). Rien n'a été
 * modifié en base : la transaction est annulée avant de lever cette exception.
 */
final class CommandeImpossibleException extends RuntimeException
{
    /** @var array<int, array{varianteId: int, statut: string, nom: ?string, stock: int}> */
    private array $problemes;

    /**
     * @param array<int, array{varianteId: int, statut: string, nom: ?string, stock: int}> $problemes
     *        statut : « epuisee », « ajustee » (stock inférieur à la demande) ou « inconnue »
     */
    public function __construct(array $problemes)
    {
        parent::__construct('Le stock ne permet pas de valider la commande.');
        $this->problemes = $problemes;
    }

    public function problemes(): array
    {
        return $this->problemes;
    }
}
