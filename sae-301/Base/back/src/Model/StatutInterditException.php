<?php

declare(strict_types=1);

namespace App\Model;

use RuntimeException;

/**
 * Le changement de statut demandé n'est pas permis (commande inconnue, déjà
 * retirée ou annulée, saut d'étape). Rien n'a été modifié ; le message, en
 * français, peut être montré tel quel à l'administrateur.
 */
final class StatutInterditException extends RuntimeException
{
}
