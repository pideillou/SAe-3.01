# Architecture MVC

Le projet suit le découpage Modèle, Vue, Contrôleur du starter. Ne pas inventer une autre organisation : s'aligner sur le code existant.

## Front (JavaScript, front/src/)
- Une page dynamique (pages/nom/page.js) est découpée en trois objets. M contient l'état de la page (réponse de l'API, message affiché). C contient les traitements : chargement des données, réactions aux actions de l'utilisateur. V construit la page à partir de M ; après chaque changement, la page est reconstruite en entier (V.rafraichir()).
- Un composant (ui/nom/) est un template.html et un index.js qui expose html(data) et/ou dom(data, actions). Il ne décide de rien : il reçoit ses données et signale les actions de l'utilisateur par les fonctions de actions (surTri, surPage, etc.).
- Les appels à l'API sont dans data/, un module par ressource, via lib/api-request.js. Jamais de fetch directement dans une page ou un composant.
- Un template n'a ni boucle ni condition. Une liste se construit avec un template par élément, un état (bouton désactivé, option choisie) se règle en JavaScript. Un composant s'insère dans un autre par un slot nommé.
- Les placeholders {{cle}} sont échappés. N'insérer des données dans le DOM que par ce mécanisme, jamais en concaténant du HTML.
- Les routes se déclarent dans main.js. Un lien interne porte data-link et un chemin sans le chemin du projet.
- Modules ES, aucune variable globale, aucun JavaScript dans les attributs HTML.

## Back (PHP, back/)
- Core/ contient l'infrastructure (Request, Response, Router, Database). Ne pas y mettre de logique propre au site.
- Controller/ reçoit la requête, valide les entrées, vérifie les droits, appelle les modèles, répond en JSON par Response. Aucun SQL, aucun HTML.
- Model/ exécute les requêtes PDO et renvoie des tableaux. Aucune notion de requête ou de réponse HTTP. Une opération qui doit être atomique (par exemple commande et stock) est une méthode de modèle qui gère sa propre transaction.
- Les dépendances sont injectées à la construction : le modèle reçoit le PDO, le contrôleur reçoit le modèle. Une nouvelle route s'ajoute dans back/src/routes.php, et le contrôleur correspondant est instancié dans back/index.php.
- Requêtes préparées pour toute valeur. Un critère de tri vient d'une liste blanche écrite côté serveur, comme dans CatalogueController.
- Le back ne renvoie que du JSON.

## Général
- Les règles de validation ne vivent jamais dans une vue.
- Respecter l'arborescence existante. Pas de nouveau dossier sans raison, et rien de ce qui est fourni n'est déplacé sans en parler à PIDEILLOU.
