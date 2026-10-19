<?php

declare(strict_types=1);

namespace App\Service;

use RuntimeException;

/**
 * L'image envoyée est refusée (type, taille ou contenu) : le message, en
 * français, peut être montré tel quel à l'administrateur.
 */
final class ImageInvalideException extends RuntimeException
{
}
