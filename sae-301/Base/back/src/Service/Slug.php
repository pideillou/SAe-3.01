<?php

declare(strict_types=1);

namespace App\Service;

/**
 * Fabrique l'adresse d'une page (slug) à partir d'un nom.
 */
final class Slug
{
    /**
     * « Écrans & Moniteurs » -> « ecrans-moniteurs » : minuscules, sans accents,
     * les autres caractères remplacés par des tirets. Vide si le nom ne contient
     * ni lettre ni chiffre.
     */
    public static function de(string $nom): string
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
}
