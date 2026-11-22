# AgroDistrib — Répartir un stock d'intrants

**Bouton dans l'application : « Répartir un stock »** (ONG, services de l'État).

## La question
Une organisation a un stock (par exemple 20 000 t de NPK 15-15-15 pour le mil). Comment le répartir entre les zones, les régions ou les départements ?

AgroDistrib **propose** des répartitions. Il ne prévoit rien. L'organisation compare les propositions, les ajuste et valide ; la quantité validée est saisie dans l'application, pas ici. Le stock d'une organisation n'est jamais mélangé à celui d'une autre.

## La méthode (validée le 18/11/2026)
Le **prorata multicritère**, retenu par la comparaison de 6 méthodes ([`docs/technique/rapport-comparaison-modeles.md`](../../docs/technique/rapport-comparaison-modeles.md), section 5). Chaque couple département × culture reçoit une part proportionnelle à :

```
besoin × (0,5 + α × valeur indicative + (1 − α) × vulnérabilité)
```

- **Le besoin n'est jamais dépassé.** Ce qu'un département ne peut pas recevoir est redistribué aux autres.
- **Tout département qui a un besoin reçoit quelque chose** (le terme 0,5 l'assure).
- **α** est l'arbitrage du décideur : 0 = équité seule, 1 = rendement seul.

| Critère | Calcul | Source |
|---|---|---|
| Besoin (t) | Colonne du mart, ou superficie × dose saisie par le décideur | `MART_TERRITOIRES_AGRODISTRIB` |
| Vulnérabilité | `score_vulnerabilite` / 100 (relative : compare les départements entre eux) | `MART_VULNERABILITE_DEPARTEMENT` |
| Valeur indicative d'une tonne | Potentiel de gain de la zone, ramené entre 0 et 1 **dans chaque culture** (validé : des kg/ha de deux cultures ne se comparent pas) × probabilité que le cycle soit couvert × (1 − probabilité climatologique de saison sèche) | Mart. C'est un indicateur de priorité, **pas un gain de rendement mesuré** : aucune donnée de réponse aux engrais n'existe par territoire |

Le potentiel de gain est une valeur de zone : il sert à classer, il n'est jamais additionné. Un potentiel négatif (sésame de la Vallée, −26 kg/ha) compte pour 0.

## Les propositions
Chaque demande rend **trois scénarios**, plus celui du décideur si son α est différent :

| Scénario | α |
|---|---|
| Équité | 0 |
| Équilibré | 0,5 (proposé par défaut) |
| Rendement | 1 |
| Personnalisé | α du décideur |

Pour chacun, les indicateurs sont comparés au **prorata du besoin** (chaque département reçoit la même part de son besoin). On voit ainsi ce que l'on gagne et ce que l'on perd. Vulnérabilité et valeur indicative tirent en sens inverse (corrélation de rang −0,56) : aucun scénario ne gagne sur les deux à la fois.

## Règles
- **Intrants répartis** : `NPK_15_15_15`, `UREE`, `DAP_18_46_0`, `FUMIER` (t/ha), `SEMENCES`. Les éléments (N, P₂O₅, K₂O) et l'eau d'irrigation ne se répartissent pas : on répartit un stock de produit.
- **Dose manquante** : le couple n'est pas servi et figure dans `doses_a_saisir`. Le décideur peut saisir une dose (`--dose CULTURE=DOSE`). Elle ne s'applique qu'aux couples sans dose et **ne remplace jamais une dose existante**. Ces couples portent le statut `SAISIE_DECIDEUR`.
- **Statut de la dose** (`VALIDEE`, `A_CONFIRMER`, `NON_VERIFIEE`, `SAISIE_DECIDEUR`) : repris sur chaque ligne et chaque territoire. Aujourd'hui, aucune dose n'est validée.
- **Critère vide** (vulnérabilité de Dakar, valeur du manioc) : remplacé par la **médiane** des autres lignes de la répartition, et signalé dans `critere_impute`. Jamais par 0, ce qui pénaliserait la ligne en silence.
- **Semences** : `besoin_semences_retenu_t`, qui exclut le riz pluvial de Casamance (dose de repiquage irrigué non applicable).
- **Niveaux** : la répartition est calculée par département. Zones et régions en sont la **somme** (zone et région ne sont pas emboîtées). Une demande = un seul niveau.
- **Stock supérieur au besoin** : chaque couple reçoit son besoin, et le reste est affiché comme non réparti.
- **Saison sèche** : la probabilité climatologique du mart, pas la prévision du modèle 1. En 2026, le modèle 1 donne 22 % pour tous les départements : il ne les départagerait pas.

## Le cas de démonstration
20 000 t de NPK 15-15-15 pour le mil, réparties par zone. 41 départements, besoin de 120 318 t (16,6 % couvert).

| Scénario | Couverture min – max | Gini | Ciblage vulnérabilité | Valeur indicative |
|---|---|---|---|---|
| Équité (α = 0) | 9,5 – 24,6 % | 0,12 | +4,4 % | −4,0 % |
| **Équilibré (α = 0,5)** | **12,7 – 21,6 %** | **0,06** | **+0,9 %** | **+0,8 %** |
| Rendement (α = 1) | 12,4 – 26,1 % | 0,11 | −3,2 % | +6,6 % |

Les quantités par département sont celles de la comparaison (testé). Les gains diffèrent de 0,1 à 0,2 point de ceux du rapport : la comparaison les calculait à partir de moyennes déjà arrondies.

**Limite** : seul le mil a une dose d'engrais dans toutes les zones (à confirmer). Pour l'arachide, le niébé ou le sésame, il faut saisir une dose.

## Utiliser
Depuis la racine du dépôt :

```bash
venv/bin/python -m ml.agrodistrib.repartir --intrant NPK_15_15_15 --culture "MIL (SOUNA)" \
    --stock 20000 --niveau ZONE --campagne 2026

# plusieurs cultures, une dose saisie, un α choisi
venv/bin/python -m ml.agrodistrib.repartir --intrant NPK_15_15_15 --culture "MIL (SOUNA)" --culture NIÉBÉ \
    --dose NIÉBÉ=100 --stock 20000 --niveau REGION --alpha 0.3
```

Depuis Python (pour l'API) : `ml.agrodistrib.moteur.proposer_scenarios(territoires, code_intrant, cultures, stock_t, niveau, alpha, doses_saisies, campagne)`. Le module ne lit ni n'écrit rien : il reçoit la table `MART_TERRITOIRES_AGRODISTRIB` et rend un objet `Propositions`.

| Sortie | Fichier écrit par `repartir.py` | Contenu |
|---|---|---|
| `parametres` | `agrodistrib_parametres.json` | Méthode, version `agrodistrib-v1`, intrant, cultures, stock, niveau, α, doses saisies, date de calcul |
| `scenarios` | `agrodistrib_scenarios.csv` | Une ligne par scénario : stock réparti et non réparti, couverture, départements servis, Gini, gains sur le prorata |
| `territoires` | `agrodistrib_territoires.csv` | Scénario × territoire du niveau choisi : besoin, quantité proposée, couverture, statuts des doses |
| `departements` | `agrodistrib_departements.csv` | Scénario × département × culture : les critères et la quantité, pour expliquer la proposition |
| `doses_a_saisir` | — (affiché) | Couples département × culture sans dose, non servis |

Les fichiers `ml/sorties/agrodistrib_*` sont versionnés : ils contiennent le **cas de démonstration**. Chaque lancement de `repartir.py` les écrase ; relancer le cas de démonstration (première commande ci-dessus) avant de commiter. Rien n'est écrit dans Snowflake : les scénarios iront dans `SALTIS.APP` quand le schéma existera.

## Dans l'application
L'écran « Répartir un stock » applique **ce moteur** dans le navigateur, sans appel réseau (le calcul est léger et doit marcher hors ligne) : `app/src/scene/regles/repartition.ts`, version `agrodistrib-v1`.
- Même préparation (vulnérabilité / 100, potentiel ramené au maximum de la culture, médiane pour un critère vide), même poids, même remplissage plafonné au besoin.
- Le curseur « Arbitrage » de l'écran est α en % : Équité (0), Équilibré (50, par défaut), Rendement (100).
- `app/src/scene/regles/repartition.test.ts` relit `ml/sorties/agrodistrib_departements.csv` et vérifie que les quantités des trois scénarios sont retrouvées (à 0,2 % près : les critères du CSV sont arrondis à 3 décimales). **Si la formule change ici, ce test casse** : il faut changer les deux et régénérer les sorties.
- Les scénarios « Urgence » et « Production » de l'écran sont des règles d'ordre (Cadre harmonisé, potentiel), pas des variantes de ce moteur.

## Tests
```bash
venv/bin/python -m pytest ml/tests
```
Ils vérifient : le stock entièrement réparti, le besoin jamais dépassé, tous les couples servis, les zones et les régions égales à la somme des départements, l'effet de α, la médiane signalée, les doses saisies sans écraser, le stock supérieur au besoin, les entrées refusées, et la reproduction de la comparaison sur les vraies données. Ce dernier test est sauté sans la copie locale `ml/donnees/`.
