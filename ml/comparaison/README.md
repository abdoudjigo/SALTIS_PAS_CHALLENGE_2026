# Comparaison des modèles — documentation

Ce dossier compare **6 familles de modèles** à des **prévisions de référence**, pour chacune des trois parties de [`ml/README.md`](../README.md), et désigne le modèle à prendre. Les résultats chiffrés et les décisions sont dans [`docs/technique/rapport-comparaison-modeles.md`](../../docs/technique/rapport-comparaison-modeles.md).

| Partie de `ml/README.md` | Script | Ce qui est comparé |
|---|---|---|
| 1. Pluie de saison | `pluie.py` | 6 familles, 2 tâches : pluie en mm, classe sèche / normale / humide |
| 2. Rendement | `rendement.py` | 6 familles, 2 tâches : rendement en kg/ha, chute de la récolte |
| 3. AgroDistrib | `agrodistrib.py` | 6 méthodes de répartition (ce n'est pas une prévision : voir plus bas) |

## Les 6 familles (`modeles.py`)

Les mêmes pour les parties 1 et 2. Elles sont rangées **de la plus simple à la plus complexe** ; cet ordre sert à la règle de choix.

| # | Famille | Bibliothèque | Comment elle prévoit | Réglages essayés |
|---|---|---|---|---|
| 1 | **Linéaire régularisé** | scikit-learn (`Ridge`, `LogisticRegression`) | Somme pondérée des variables. La pénalité tire les poids vers zéro pour ne pas apprendre le bruit | Pénalité 1, 10, 100, 1000 |
| 2 | **k plus proches voisins** | scikit-learn (`KNeighbors…`) | Moyenne de ce qui s'est passé dans les k situations passées les plus ressemblantes | k = 10, 25, 50, 100 |
| 3 | **Forêt aléatoire** | scikit-learn (`RandomForest…`) | Moyenne de 200 arbres de décision, chacun construit sur un tirage différent des lignes et des variables | Profondeur 3, 5 ou libre ; 20 ou 50 lignes au moins par feuille |
| 4 | **Gradient boosting** | scikit-learn (`HistGradientBoosting…`) | Des arbres peu profonds ajoutés un à un, chacun corrigeant les erreurs des précédents | Profondeur 2 ou 3 ; pas 0,03 ou 0,1 ; 100 ou 300 arbres |
| 5 | **XGBoost** | xgboost (`XGB…`) | Gradient boosting avec pénalité sur les feuilles et tirage des lignes et des colonnes | Mêmes réglages que le 4 |
| 6 | **Réseau de neurones** | scikit-learn (`MLP…`) | Perceptron à 1 couche (8 neurones) ou 2 couches (16 puis 8), pénalisé | 2 architectures × pénalité 0,1 ou 1 |

Les familles 1, 2 et 6 reçoivent des variables centrées et réduites. Chaque famille fournit une version « régression » et une version « classification ». Les grilles sont courtes exprès : avec 35 années, essayer beaucoup de réglages revient à choisir le hasard.

## Les références (baselines)

Un modèle n'a d'intérêt que s'il fait mieux qu'une prévision que tout le monde peut faire sans modèle.

| Partie | Référence | Ce qu'elle dit |
|---|---|---|
| Pluie, mm | Normale 1991-2020 | « Il pleuvra comme d'habitude. » Elle contient les années 1991-2020, donc une partie des années sur lesquelles on la juge |
| Pluie, mm | **Moyenne des 15 dernières saisons** | Référence équitable : elle n'utilise que le passé |
| Pluie, mm | Moyenne de tout le passé ; pluie de l'année précédente | Deux autres prévisions naïves |
| Pluie, classe | **Climatologie** | La fréquence passée de chaque classe |
| Rendement, kg/ha | **Tendance** | La moyenne des 10 campagnes précédentes du département et de la culture |
| Rendement, chute | **Passé de la culture** | La fréquence passée des chutes pour cette culture |
| AgroDistrib | **Prorata du besoin** | Chaque département reçoit la même part de son besoin |

Pour le rendement, le **modèle actuel** (`m3-v1`) est aussi rejoué dans les mêmes conditions, pour situer les 6 familles par rapport à lui.

## Le protocole de validation

Règles communes, celles de [`MODELES.md`](../MODELES.md) :

- **Jamais d'années mélangées au hasard.** Un modèle ne prévoit une année qu'avec les années d'avant.
- **Validation** : sert à choisir le réglage de chaque famille, puis la famille.
- **Test** : années jamais regardées pour choisir. Il sert seulement à confirmer.

| | Pluie | Rendement |
|---|---|---|
| Apprentissage | À partir de 1982 | À partir de 1991 |
| Validation | 2001-2015, 5 blocs de 3 années, chaque bloc prévu avec les années d'avant | 2001-2008, chaque année prévue avec les années d'avant |
| Test | 2016-2025, modèle entraîné jusqu'en 2015 | 2009-2015, chaque année prévue avec les années d'avant |
| Variables | 3 jeux essayés pour chaque famille (voir `pluie.py`) | Celles du modèle 3, par moment (fin mai à fin août) |

Le rendement s'arrête en 2015 : à partir de 2016, les superficies sont semées et non plus récoltées, et les rendements ne sont plus comparables.

### Les mesures

| Mesure | Tâche | Lecture |
|---|---|---|
| RMSE, MAE | pluie (mm), rendement (kg/ha) | Erreur moyenne. Plus bas = mieux |
| RPS et RPSS | classe de saison | Erreur sur les 3 probabilités, qui pardonne plus une erreur d'une classe que de deux. RPSS = gain sur la climatologie |
| Brier et Brier skill score | chute de la récolte | Erreur sur la probabilité de chute. Skill score = gain sur la fréquence passée |
| AUC | chute de la récolte | Le modèle classe-t-il bien les cas à risque ? 0,5 = hasard |
| **Gain** | toutes | 1 − erreur du modèle / erreur de la référence. 0 = pas mieux, positif = mieux, négatif = moins bien |

### L'intervalle à 90 %

Les 45 départements d'une même année se ressemblent beaucoup : le test de la pluie compte 450 lignes, mais seulement **10 années** vraiment différentes. Chaque gain est donc donné avec un intervalle à 90 %, obtenu en retirant au hasard des **années entières** (2 000 tirages). Si l'intervalle contient 0, le gain n'est pas prouvé.

## La règle de choix (`selection.py`)

Fixée avant de regarder le test :

1. On repère la famille dont l'erreur de **validation** est la plus basse.
2. Toute famille dont l'écart avec elle n'est pas distinguable du hasard (intervalle à 90 % de la différence contenant 0) est dite **équivalente**.
3. Parmi les équivalentes, on retient **la plus simple** (ordre du tableau des familles).
4. Le test dit ensuite si le modèle retenu bat la référence. S'il ne la bat pas, la sortie n'est pas présentée comme une prévision de l'année (règle de `MODELES.md`).

Pourquoi « la plus simple » : avec si peu d'années, un écart de 1 ou 2 % entre deux familles change d'un tirage à l'autre. À performance égale, un modèle simple s'explique, se relance en quelques secondes et se trompe moins hors de ce qu'il a vu.

## AgroDistrib : une comparaison de méthodes, pas de prévisions

AgroDistrib ne prévoit rien : il **propose une répartition**. Aucune « bonne répartition » n'est observée, et aucune donnée de réponse aux engrais n'existe par territoire. On ne peut donc ni calculer une erreur, ni parler de validation au sens des parties 1 et 2.

`agrodistrib.py` compare 6 méthodes au **prorata du besoin** sur le cas de démonstration du README (20 000 t de NPK 15-15-15 pour le mil) :

| Méthode | Principe |
|---|---|
| Parts égales plafonnées | Le même tonnage pour chaque département, sans dépasser son besoin |
| Prorata pondéré par la vulnérabilité | Besoin × (0,5 + vulnérabilité) |
| Prorata pondéré par la valeur indicative | Besoin × (0,5 + valeur indicative) |
| Prorata multicritère | Besoin × (0,5 + α × valeur + (1 − α) × vulnérabilité) ; α = arbitrage rendement / équité du décideur |
| Priorité stricte (glouton) | Besoin entier des départements les mieux classés, jusqu'à épuisement du stock |
| Optimisation linéaire bornée | Maximise la somme score × quantité, chaque département recevant entre 0,5 et 3 fois le taux moyen |

**Valeur indicative d'une tonne** = potentiel de gain de la zone (ramené entre 0 et 1) × probabilité que le cycle soit couvert × (1 − probabilité de saison sèche). C'est un indicateur de priorité, pas un gain de rendement mesuré. Le potentiel est une valeur de zone : il classe, il ne s'additionne pas.

Critères : stock entièrement réparti, besoin jamais dépassé, nombre de départements servis, couverture minimale et maximale, inégalité des taux de couverture (Gini), part du stock allant au cinquième des départements les plus vulnérables, valeur indicative moyenne d'une tonne, et **stabilité** (part du stock qui change de département quand les scores sont perturbés de ± 10 %).

Règle de choix : (1) contraintes respectées et aucun département à zéro ; (2) pas moins bien que le prorata sur le ciblage **et** sur la valeur indicative ; (3) parmi celles-là, la plus forte somme des deux gains.

## Relancer

Depuis la racine du dépôt, après `ml.m1_prevision_saison.entrainer` (la partie 2 lit `prevision_saison.csv`) :

```bash
venv/bin/python -m ml.comparaison.pluie          # ~40 s
venv/bin/python -m ml.comparaison.rendement      # plusieurs minutes
venv/bin/python -m ml.comparaison.agrodistrib    # quelques secondes
```

Les tables sont lues dans `ml/donnees/` (copies locales, nécessite `pyarrow`), ou dans Snowflake la première fois. Rien n'est écrit dans Snowflake.

| Fichier de `ml/sorties/` | Contenu |
|---|---|
| `comparaison_pluie.csv`, `comparaison_rendement.csv` | Une ligne par tâche × modèle ou référence : réglage choisi, mesures de validation et de test, gains et intervalles, `equivalent_au_meilleur`, `retenu` |
| `comparaison_pluie_essais.csv`, `comparaison_rendement_essais.csv` | Tous les essais de validation (famille × réglage × jeu de variables) |
| `comparaison_rendement_moments.csv` | Le test du rendement, moment par moment |
| `comparaison_agrodistrib.csv` | Une ligne par méthode : critères, `admissible`, `retenu` |
| `comparaison_agrodistrib_departements.csv` | Quantité proposée par département, pour chaque méthode |

Ces fichiers ne sont pas chargés dans `SALTIS.ML` : ce sont des pièces justificatives, pas des sorties servies par l'API.
