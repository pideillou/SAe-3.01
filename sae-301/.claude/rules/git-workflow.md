# Git et GitHub

Le cahier des charges exige un dépôt GitHub bien géré : commits explicites et soignés, une branche par user story, fusion dans la branche principale. La branche principale correspond à l'application hébergée et rendue.

## Qui fait quoi
- À la fin de chaque user story, l'agent commit et pousse le travail sur GitHub, mais uniquement quand PIDEILLOU le demande. Sans demande, il ne commit pas et ne pousse pas : il propose la branche et les messages de commit.
- Chaque user story est poussée sur une nouvelle branche nommée US-NNN, où NNN est le numéro d'ordre de la user story sur trois chiffres : US-001 pour la première réalisée, US-002 pour la deuxième, etc. Les branches sont cumulatives : US-001 contient la première user story (DEC-b), US-002 contient la première et la deuxième (DEC-b puis DEC-a), US-003 les trois premières, et ainsi de suite. Le code de la user story figure dans les messages de commit.
- L'agent crée la branche US-NNN à partir de la branche US précédente (US-002 à partir de US-001), qui porte déjà le travail des user stories antérieures.
- L'agent ne pousse jamais sur la branche principale, ne force rien (pas de --force), ne fusionne pas et n'ouvre pas de pull request. La fusion dans la branche principale reste à PIDEILLOU.
- L'agent ne déploie rien (voir AGENTS.md).

## Fin d'itération
1. Présenter le résumé de la skill implementer-user-story, avec le nom de branche US-NNN et les messages de commit proposés.
2. Attendre la demande de PIDEILLOU.
3. Sur demande : créer la branche US-NNN, ajouter uniquement les fichiers de la user story, un commit par changement logique avec un message explicite, puis git push -u origin US-NNN.
4. Donner à PIDEILLOU le nom de la branche poussée et la liste des commits.

## Avant chaque commit
- Relire git status : n'ajouter que les fichiers de la user story, par leur chemin. Pas de git add -A ni de git add .
- Ne jamais ajouter back/config/config.php (voir securite.md). S'il apparaît modifié, s'arrêter et prévenir PIDEILLOU.
- Ne jamais ajouter de secret, de fichier d'environnement, de dossier node_modules ni de dossier dist.
- Ne pas modifier l'historique déjà poussé (pas de rebase, de reset ni d'amend sur une branche publiée).

## Dépôt
- Ne jamais versionner de secret (identifiants de base de données, fichiers d'environnement).
- L'ordre de réalisation des user stories est dans le README de PIDEILLOU. Ne pas le modifier sans son accord.
