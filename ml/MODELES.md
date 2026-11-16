# Les modèles d'IA — Assaman & Suuf

Chaque modèle répond à **une question**. Les données disponibles sont décrites dans [`README.md`](README.md).

**Bouton ou modèle ?**
- Le **bouton**, c'est ce que l'utilisateur voit et clique dans l'application.
- Le **modèle**, c'est le moteur caché derrière, qui calcule la réponse.

L'utilisateur ne choisit jamais un modèle : il clique sur un bouton.

## Les 3 modèles

Les numéros 1, 3 et 4 sont conservés. Le modèle 2 (années semblables), absent de `README.md` et plus affiché dans l'application, a été retiré le 16/11/2026 (code, sorties, route de l'API).

| # | Modèle | Question | Fiabilité, en résumé | État |
|---|---|---|---|---|
| 1 | [Prévision de la saison](m1_prevision_saison/README.md) | Fin mai : la saison sera-t-elle sèche, normale ou humide ? | Modeste : un peu mieux que la moyenne des années passées | ✅ fait |
| 3 | [Rendement prévu et alerte récolte](m3_rendement/README.md) | Combien vais-je récolter ? Où la récolte risque-t-elle de chuter ? | Faible : prouvée seulement pour l'alerte arachide à partir de fin juillet | ✅ fait |
| 4 | [Date de semis](m4_date_semis/README.md) | À quelle décade semer pour courir le moins de risque ? | Meilleure que la fréquence passée (faux départ : AUC 0,83 contre 0,76) | ✅ fait |

## Correspondance avec `README.md` (16/11/2026)

[`README.md`](README.md) décrit **trois** modèles : la pluie, le rendement et AgroDistrib. Ce dossier contient les deux premiers, plus un complément (la date de semis).

| Partie de `README.md` | Dans ce dossier | Écart |
|---|---|---|
| 1. Prévision de la pluie de saison | Modèle 1 (`m1_prevision_saison`) | Aucun : mêmes données (`MART_ML_PREVISION_PLUIE`), mêmes cibles, même découpage |
| 2. Anomalie de rendement | Modèle 3 (`m3_rendement`) | La cible n'est pas `anomalie_rendement_pct` mais le rapport rendement / moyenne des 10 campagnes précédentes : la tendance de la source est ajustée sur toute la série, années futures comprises. 5 cultures pluviales, jusqu'en 2015 (rupture de 2016) |
| 3. AgroDistrib | Absent jusqu'ici. Méthodes de répartition comparées dans [`comparaison/agrodistrib.py`](comparaison/agrodistrib.py) | Pas encore de moteur servi par l'API : `SALTIS.APP` (stocks, scénarios) n'existe pas |
| — | Modèle 4 (`m4_date_semis`) | **Complément hors `README.md`**, gardé (décision du 16/11/2026) : il sert « Quand semer », « Ma parcelle », « Surface » et l'assistant vocal. Non comparé |

## Quel algorithme pour chaque partie (16/11/2026)

Six familles de modèles ont été comparées à des prévisions de référence, avec la même validation temporelle pour toutes. Méthode : [`comparaison/README.md`](comparaison/README.md). Résultats : [`docs/rapport-comparaison-modeles.md`](../docs/rapport-comparaison-modeles.md).

| Partie | Tâche | Algorithme retenu | Résultat sur le test |
|---|---|---|---|
| 1. Pluie de saison | Pluie en mm | Linéaire régularisé (ridge) | RMSE 111 mm ; gain prouvé sur la normale 1991-2020 (122 mm), non prouvé sur la moyenne des 15 dernières saisons (118 mm) |
| 1. Pluie de saison | Classe de saison | Linéaire régularisé (logistique) | RPSS +0,22, gain prouvé sur la climatologie |
| 2. Rendement | Rendement en kg/ha | Linéaire régularisé parmi les 6 ; aucun ne bat la tendance | Les 6 familles font 5 à 10 % moins bien que la tendance |
| 2. Rendement | Chute de la récolte | Linéaire régularisé (logistique) | Gain prouvé en validation (+0,08), absent sur le test |
| 3. AgroDistrib | Répartition d'un stock | Prorata multicritère, arbitrage α du décideur | Pas de vérité observée : comparaison sur critères |

**Conséquence : aucun moteur ne change.** Les modèles 1 et 3 en service (`m1-v1`, `m3-v1`) sont déjà des modèles linéaires régularisés. XGBoost, le gradient boosting, la forêt aléatoire, les plus proches voisins et le réseau de neurones ne font mieux nulle part de façon prouvée. Leurs sorties (`sorties/prevision_*.csv`) n'ont pas été recalculées.

## Les boutons (décision du 13/11/2026)

**Règle : un bouton par modèle, et des boutons qui en combinent plusieurs.**

### Un bouton par modèle
| Bouton | Modèle | Profil |
|---|---|---|
| La saison qui vient | 1 | Agriculteur, ONG |
| Quelle culture | 3 (rendement attendu) | Agriculteur |
| Alerte récolte | 3 (risque de chute) | ONG |
| Quand semer | 4 | Agriculteur |

### Boutons qui combinent
| Bouton | Modèles | Ce qu'il répond |
|---|---|---|
| Ma parcelle (agriculteur) | 1 + 3 + 4 | Pour le point GPS : la saison attendue, la culture, la décade de semis |
| Préparer la campagne (ONG) | 1 + 3 + vulnérabilité | Les départements où une mauvaise saison est probable et où la récolte risque de chuter |
| Répartir un stock (ONG, phase 2) | 3 + optimisation | Le stock envoyé en priorité là où le risque est le plus fort |

Dans un bouton qui combine, **chaque morceau de réponse dit de quel modèle il vient et quelle est sa fiabilité**. On ne mélange jamais une prévision fiable et une prévision faible sous un seul chiffre.

Les boutons existants ont été renommés dans le front : « Que semer » devient « Quelle culture », « Le ciel » devient « Suivi de la pluie », « Besoins » devient « Besoins du pays ». Les boutons des modèles seront ajoutés quand les modèles passeront dans l'API.

## Prévoir l'année que l'on tape (2026-2035)
Nos observations s'arrêtent en 2025. L'utilisateur tape l'année qu'il veut préparer ; la plateforme prédit (voir [`docs/v1-cahier-des-charges.md`](../docs/v1-cahier-des-charges.md)).

| Année | Type | Comment | Fiabilité mesurée (2016-2025) |
|---|---|---|---|
| 2026 | `PREVISION_OCEAN` | Modèle 1 : océan de mars-mai 2026 (NOAA, [`entrees/indices_ocean.csv`](entrees/README.md)), modèle réentraîné sur 1981-2025 | RMSE 113 mm, RPSS +0,17 |
| 2027-2035 | `PREVISION_TENDANCE` | Moyenne des 15 dernières saisons du département ; probabilités = fréquence des classes sur ces 15 saisons | RMSE 115 mm (117 mm à 5 ans), RPSS +0,10 |
| Référence | — | Normale 1991-2020 | RMSE 122 mm |

La prévision de tendance est remplacée par la prévision océan dès que les indices de mai de l'année sont publiés : ajouter la ligne dans `entrees/indices_ocean.csv`, puis relancer les modèles.

Les modèles 3 (récolte, `PROJECTION_NON_EVALUEE`) et 4 (semis) utilisent ces probabilités pour les mêmes années.

**Ce qui existe ailleurs** : aucun modèle public de Hugging Face ne fait de prévision saisonnière pour le Sahel (GraphCast, Aurora, Prithvi WxC prévoient à 10 jours). Le centre régional AGRHYMET utilise la même approche que notre modèle 1 (statistique et apprentissage sur les températures de l'océan, outil WAS_S2S / bibliothèque `wass2s`).

## Règles communes
- On lit `SALTIS.MARTS` en lecture seule (`ml/commun/donnees.py`). Rien n'est écrit dans Snowflake depuis ces scripts.
- Les années ne sont jamais mélangées au hasard : on entraîne sur le passé, on teste sur les années suivantes.
- Les réglages sont choisis sur la validation, jamais sur le test.
- Chaque modèle est comparé à une prévision simple (climatologie, fréquence passée ou tendance). Là où il ne fait pas mieux, sa sortie le dit (`rendement_fiable`, `alerte_fiable`, probabilités vides…) et l'application ne la présente pas comme une prévision.
- Chaque prévision porte une fourchette ou des probabilités, jamais un chiffre seul.
- Une valeur absente reste vide, jamais 0.
- Les résultats vont dans `ml/sorties/` (CSV), avec `version_modele` et `date_calcul`.

## Organisation du dossier
```
ml/
  README.md              données disponibles (équipe données)
  MODELES.md             ce fichier
  commun/                lecture des marts, mesures de fiabilité
  m1_prevision_saison/   un dossier par modèle : entrainer.py + README.md
  m3_rendement/
  m4_date_semis/
  comparaison/           6 familles de modèles comparées aux références, par partie (README.md)
  sorties/               résultats (CSV)
  donnees/               copies locales des tables (ignoré par git)
```

## Relancer les modèles
Depuis la racine du dépôt, dans cet ordre (le 4 utilise la sortie du 1) :
```bash
venv/bin/python -m ml.m1_prevision_saison.entrainer    # quelques secondes
venv/bin/python -m ml.m3_rendement.entrainer           # ~30 s
venv/bin/python -m ml.m4_date_semis.entrainer          # quelques secondes
```
La première fois, les tables sont lues dans Snowflake et copiées dans `ml/donnees/`. Ensuite, tout tourne sans réseau.

## Du modèle à l'écran
```
ml/m*/entrainer.py ──► ml/sorties/*.csv ──► ml/charger_snowflake.py ──► SALTIS.ML ──► API (/previsions) ──► boutons du front
```

| Étape | Commande | Qui |
|---|---|---|
| 1. Créer les tables (une fois) | exécuter `snowflake/20_ml_resultats.sql` dans Snowflake | un membre de l'équipe, à la main |
| 2. Relancer les modèles | voir « Relancer les modèles » ci-dessus | équipe ML |
| 3. Vérifier sans écrire | `venv/bin/python -m ml.charger_snowflake` | équipe ML |
| 4. Charger dans `SALTIS.ML` | `venv/bin/python -m ml.charger_snowflake --confirmer` | équipe ML |
| 5. Servir | `POST /api/v1/systeme/cache/rafraichir`, ou redémarrer l'API | équipe API |

| Table `SALTIS.ML` | Fichier | Route de l'API |
|---|---|---|
| `PREVISION_SAISONNIERE` | `prevision_saison.csv` | `/previsions/saison/…` |
| `PREVISION_RENDEMENT` | `prevision_rendement.csv` | `/previsions/rendement/…`, `/previsions/alerte-recolte/…` |
| `RISQUE_SEMIS` | `risque_semis.csv` | `/previsions/semis/…` |
| `EVALUATION_MODELES` | les 3 `evaluation_m*.csv` (modèles 1, 3 et 4), une ligne par mesure | `/previsions/fiabilite` |

Le chargement ajoute à chaque table les colonnes du territoire (`code_region`, `region`, `zone_agroecologique`), pour qu'elle soit à plat comme les marts. Chaque table est vidée puis remplie : elle contient toujours la dernière version des modèles. Le détail des routes est dans [`api/README.md`](../api/README.md).

**Pour tester, rien de tout cela n'est nécessaire** : tant que `SALTIS.ML` n'est pas chargé, `python -m api` lit directement les CSV de `ml/sorties/`. Le chargement dans Snowflake sert pour la mise en production.

## Ce que chaque sortie contient
| Fichier | Grain | Lignes |
|---|---|---|
| `prevision_saison.csv` (1) | département × année, 1981-2035 | 2 475 |
| `prevision_rendement.csv` (3) | département × culture × année × moment (5 cultures), années à venir 2026-2035 à fin mai | 14 036 |
| `risque_semis.csv` (4) | département × année × culture × décade de semis (8 cultures), 2016-2035 | 59 136 |
| `evaluation_m1.csv`, `evaluation_m3.csv`, `evaluation_m4.csv` | fiabilité de chaque modèle | — |

## Les moments de la saison
« La saison qui vient » (modèle 1) est une prévision de fin mai. Le modèle 3 est mis à jour à quatre moments : fin mai, fin juin, fin juillet, fin août. Ses colonnes `rendement_fiable` et `alerte_fiable` disent, par moment et par culture, s'il fait mieux que la référence. Sinon, l'application présente sa sortie comme la fourchette et le risque habituels du département.
