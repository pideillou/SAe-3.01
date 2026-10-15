# Sécurité

## Authentification et sessions
- Les comptes en dur de AuthController (alice, admin) sont un exemple du starter : à remplacer par des comptes en base de données.
- Mots de passe hashés avec password_hash (algorithme bcrypt) et vérifiés avec password_verify. Jamais en clair, ni dans la base, ni dans les logs.
- Identifiant de session régénéré à la connexion (session_regenerate_id(true), déjà fait dans le starter). Les paramètres de session et de cookie se règlent uniquement dans back/index.php, avant session_start(). Session détruite à la déconnexion.
- Authentification des administrateurs séparée de celle des clients. Aucune page /admin accessible sans authentification administrateur. Compte administrateur de test en base. Proposer la conception à PIDEILLOU avant de l'implémenter.
- Modifier le mot de passe exige le mot de passe actuel.

## Droits et validation
- Contrôler les droits côté serveur, dans le contrôleur, pour chaque route réservée. Masquer un bouton ou une page du front ne suffit pas.
- Valider toutes les entrées côté serveur, même si elles le sont déjà côté client.
- Ne jamais faire confiance au panier conservé dans le navigateur pour les prix et les stocks : les recalculer côté serveur à la validation de la commande.
- Requêtes SQL préparées. Données affichées dans le HTML uniquement par les placeholders échappés des templates.
- Téléversement d'images (GOF-a) : vérifier le type et la taille du fichier avant de l'accepter.

## Identifiants et secrets
- Les identifiants de la base ne sont écrits que dans back/config/config.php, par PIDEILLOU. Ne pas les copier ailleurs, ne pas les afficher dans une réponse, ne pas les mettre dans un commit.
- Le fichier config.php n'est pas exclu par le .gitignore du starter. Avant tout commit qui le touche, prévenir PIDEILLOU pour qu'il vérifie qu'aucun identifiant réel n'est versionné.
- En production, « debug » de config.php doit valoir false.
