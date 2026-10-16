# Test de concurrence : dernière unité d'un produit

Test demandé par la Definition of Done de STK-a et par la skill stock-et-commandes. Il porte sur la validation de commande de CMD-a (CommandeModel::creer).

## Principe
Plusieurs processus PHP indépendants (donc plusieurs connexions MySQL) lancent la même commande au même instant, sur une variante dont le stock est connu. Ils partent tous à un instant fixé à l'avance, pour que les requêtes se chevauchent vraiment.

La méthode creer() fait, dans une seule transaction : verrou des variantes (SELECT ... FOR UPDATE, dans l'ordre des identifiants), contrôle du stock, création de la commande et de ses lignes, décrément par une mise à jour conditionnelle (WHERE stock >= quantité) et écriture du journal.

## Résultats (16 octobre 2026, base de test, nettoyée après les essais)

| Stock | Commandes simultanées | Quantité chacune | Réussies | Refusées | Stock final | Sorties au journal |
|---|---|---|---|---|---|---|
| 1 | 2 (x5 essais) | 1 | 1 | 1 | 0 | 1 |
| 1 | 5 | 1 | 1 | 4 | 0 | 1 |
| 2 | 4 | 1 | 2 | 2 | 0 | 2 |
| 3 | 2 | 2 | 1 | 1 | 1 | 1 |

Dans tous les cas : une seule commande passe quand il n'y a qu'une unité, le stock ne devient jamais négatif, la commande refusée n'écrit rien et le journal ne contient qu'un mouvement de sortie par commande réussie.

## Autres cas vérifiés
- Une commande à deux lignes dont la seconde dépasse le stock n'enregistre rien (le stock de la première ligne n'est pas décrémenté).
- Variante épuisée ou inconnue : commande refusée avec le détail.
- Le prix enregistré dans la commande ne bouge pas quand le prix de la variante change ensuite.
- Un client ne peut pas lire la commande d'un autre client.
