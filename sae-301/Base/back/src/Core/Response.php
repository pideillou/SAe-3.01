<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Émission de la réponse HTTP.
 *
 * Cette API ne renvoie que du JSON : aucune page HTML n'est produite ici.
 * Le front est constitué de fichiers statiques servis depuis front/.
 */
final class Response
{
    /**
     * Envoie une réponse JSON et termine le script.
     *
     * ATTENTION — cette méthode ne rend jamais la main. Le exit final arrête
     * PHP sur-le-champ : le code écrit APRÈS un appel à Response::json() ne
     * s'exécutera pas, et aucune erreur ne vous le signalera.
     *
     *     setcookie('tri', $tri);
     *     Response::json(['tri' => $tri]);
     *     setcookie('parPage', $parPage);   // ← jamais atteint
     *
     * Posez donc vos cookies avant d'envoyer la réponse, jamais après.
     */
    public static function json(array $donnees, int $statut = 200): void
    {
        http_response_code($statut);
        header('Content-Type: application/json; charset=utf-8');
        self::entetesDeSecurite();

        echo json_encode(
            $donnees,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
        );

        exit;
    }

    /**
     * En-têtes de sécurité des réponses de l'API : le navigateur ne doit pas
     * deviner le type d'un contenu (nosniff), ni envoyer l'adresse complète de la
     * page appelante à un autre site, ni afficher l'API dans un cadre.
     */
    public static function entetesDeSecurite(): void
    {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: same-origin');
    }

    /**
     * Envoie une erreur au format JSON.
     */
    public static function erreur(string $message, int $statut = 400): void
    {
        self::json(['erreur' => $message], $statut);
    }
}
