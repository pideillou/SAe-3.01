# SAé 3.01 : site click & collect Razer

## Projet
Projet individuel de PIDEILLOU (BUT2 MMI, IUT du Limousin, parcours Développement web et dispositifs interactifs). Site click & collect pour l'enseigne Razer : le client choisit des produits, remplit un panier et valide une commande. Le paiement et la mise à disposition du panier ne sont pas traités. L'expérience doit différer de la boutique en ligne existante de Razer et respecter sa charte graphique. Rendu le vendredi 23 octobre 2026.

Périmètre minimum : 3 catégories de produits, 4 produits par catégorie, des options par produit. L'epic Promotions est un bonus. Les produits sont de vrais produits Razer.

## Base de code (SAE301-Starter)
Le projet part du starter fourni par les enseignants, qui est un catalogue de films. Tout ce qui concerne les films, les genres et les comptes en dur (alice, admin) est un exemple à remplacer par le catalogue Razer.

- Back : API PHP qui ne renvoie que du JSON, dans back/. Trois couches : Core/ (Request, Response, Router, Database), Controller/, Model/. Accès MySQL par PDO. Routes dans back/src/routes.php, contrôleurs instanciés dans back/index.php.
- Front : JavaScript sans framework, Vite et Tailwind CSS v4, dans front/. Routeur maison (src/lib/router.js), pages/, ui/ (composants), data/ (appels API), lib/.
- Base de données : MySQL. Schéma et données de départ dans sql/import.sql.
- Aiguillage : le .htaccess à la racine envoie /api/ vers le back et le reste vers front/dist/.

## Commandes (dans front/)
- npm install : installe les dépendances.
- npm run dev : serveur de développement Vite. Il relaie les appels API vers l'API déployée sur mmi.unilim.fr : une modification du back n'est testable qu'une fois déposée sur le serveur par PIDEILLOU.
- npm run build : produit front/dist/.

Le chemin du projet (~login/Base/) apparaît à deux endroits qui doivent rester identiques : « chemin » dans back/config/config.php et BASE dans front/vite.config.js.

Le déploiement est fait par PIDEILLOU : il dépose .htaccess, back/ et front/dist/ sur le serveur. L'agent ne déploie rien.

## Stack et architecture
- JavaScript en architecture MVC, selon la convention du starter (voir .claude/rules/mvc-javascript.md).
- Tailwind CSS pour tout le style (voir .claude/rules/tailwind-css.md).
- Ne pas ajouter de framework, de bibliothèque ou d'outil sans l'accord de PIDEILLOU.

## Identifiants
Les identifiants de la base se trouvent uniquement dans back/config/config.php, renseignés par PIDEILLOU. Ne jamais les recopier ailleurs : ni dans AGENTS.md, les rules ou les skills, ni dans le README, ni dans les messages de commit.

## Sources de vérité
- Cahier des charges (PDF de la SAé 3.01, dans docs/) : critères d'acceptation, Definition of Done, livrables.
- Prototypes Figma de PIDEILLOU : variables, composants, variants.
- README du dépôt : graphe de dépendances et ordre de réalisation des user stories, en plus de la documentation du starter.

En cas de conflit ou de doute entre ces sources, demander à PIDEILLOU.

## Fonctionnement
- Une itération = une user story = une branche. Suivre l'ordre du README et ne pas le modifier sans l'accord de PIDEILLOU.
- En fin de user story, l'agent commit et pousse sur une nouvelle branche cumulative US-NNN (numéro d'ordre de la user story, qui contient aussi les précédentes), uniquement à la demande de PIDEILLOU (voir .claude/rules/git-workflow.md).
- Une user story n'est terminée que si ses critères d'acceptation, sa Definition of Done spécifique et la Definition of Done commune sont remplis (voir .claude/rules/qualite-livrable.md).
- La qualité prime sur la quantité : mieux vaut moins de user stories, bien faites.

## Comportement de l'agent
- Demander avant d'ajouter une dépendance, un framework ou une convention non prévue ici.
- Aucune donnée inventée : produits, prix, stocks, images et textes viennent de PIDEILLOU ou de sources réelles. Pas de lorem ipsum, pas de produit fictif.
- Réponses concises et directes. Aucun emoji, ni dans les réponses, ni dans le code, ni dans les messages d'erreur.
- Textes évalués (README, analyse) : vocabulaire et ton d'un étudiant, sans jargon inutile.
- Tout message visible par l'utilisateur final est en français.
- Fin d'itération : validation W3C de toutes les pages touchées (skill validateur-w3c), puis résumé court selon le modèle de la skill implementer-user-story.

## Rules (.claude/rules/)
- mvc-javascript.md : architecture MVC, front et back
- tailwind-css.md : style, charte Razer, responsive
- themes-et-couleurs.md : palette par thème, @theme inline, ajout d'un thème
- git-workflow.md : branches US-NNN, commits et push à la demande de PIDEILLOU
- qualite-livrable.md : Definition of Done commune
- securite.md : authentification, sessions, droits, validation, identifiants
- donnees-et-stock.md : commandes, options, variantes, stock, schéma SQL

## Skills (.claude/skills/)
- analyser-user-stories : graphe de dépendances et ordre de réalisation
- implementer-user-story : réaliser une user story de bout en bout
- integrer-maquette-tailwind : passer du Figma au HTML et Tailwind
- stock-et-commandes : transactions, journal de stock, test de concurrence
- validateur-w3c : validation HTML et CSS, à chaque itération
- verifier-livraison : contrôle final avant le rendu

## Livrables (vendredi 23 octobre 2026)
- Lien Figma des prototypes
- Lien de l'application hébergée (mmi.unilim.fr), correspondant à la branche principale
- Lien du dépôt GitHub (si privé, ajouter les enseignants en collaborateurs)
- Rapport d'audit Lighthouse
- Analyse des dépendances entre user stories et ordre retenu, justifié, dans le README
- Accès visiteur et, le cas échéant, administrateur
