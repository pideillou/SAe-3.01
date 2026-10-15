# Git et GitHub

Le cahier des charges exige un dépôt GitHub bien géré : commits explicites et soignés, une branche par user story, fusion dans la branche principale. La branche principale correspond à l'application hébergée et rendue.

## Qui fait quoi
- PIDEILLOU fait lui-même tous les git push, après chaque itération.
- L'agent ne lance jamais git push, ne force rien, ne fusionne pas dans la branche principale et n'ouvre pas de pull request.
- L'agent ne crée pas de commit sauf si PIDEILLOU le demande. Il propose les messages.

## Fin d'itération
Fournir à PIDEILLOU :
- le nom de branche proposé, de la forme code-de-la-user-story puis sujet court (exemple : cmd-b-panier) ;
- la liste des fichiers créés ou modifiés ;
- un ou plusieurs messages de commit explicites, un par changement logique ;
- un rappel que le push est à faire par PIDEILLOU.

## Dépôt
- Ne jamais versionner de secret (identifiants de base de données, fichiers d'environnement).
- L'ordre de réalisation des user stories est dans le README. Ne pas le modifier sans l'accord de PIDEILLOU.
