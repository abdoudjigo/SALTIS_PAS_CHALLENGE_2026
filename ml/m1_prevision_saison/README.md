# Modèle 1 — La saison qui vient

**Bouton dans l'application : « La saison qui vient »** (agriculteur et ONG).

## La question
Fin mai, avant les semis : la saison des pluies sera-t-elle **sèche, normale ou humide** ? Combien de pluie attendre dans mon département ?

## Ce que le modèle regarde
Deux températures de l'océan, mesurées de mars à mai :

| Variable | Ce que c'est | Effet appris |
|---|---|---|
| `indice_oni_mars_mai` | El Niño (Pacifique) | Un El Niño fort rend la saison sèche plus probable |
| `indice_tsa_mars_mai` | Atlantique tropical sud | Un Atlantique sud chaud rend la saison humide plus probable |

Ces deux indices ont la même valeur pour tout le pays une année donnée. **Les probabilités sont donc les mêmes pour les 45 départements une année donnée** ; seule la pluie prévue en mm change, parce qu'elle part de la normale du département.

## Comment il apprend
- Données : `MARTS.MART_ML_PREVISION_PLUIE`, 45 départements × 1981-2025.
- Cible : la classe de la saison, avec les 5 classes de la source regroupées en 3 (très sèche + sèche → **sèche**, normale, humide + très humide → **humide**), et la pluie de la saison.
- Méthode : régression logistique (probabilités des 3 classes) et régression ridge (pluie en mm), toutes deux fortement régularisées, car il y a peu d'années.
- Entraînement sur 1981-2015, test sur 2016-2025. Les années ne sont jamais mélangées au hasard.

## Est-ce qu'il marche ?
On le compare à la **climatologie**, c'est-à-dire « la fréquence passée de chaque classe ». C'est la prévision de quelqu'un qui ne sait rien de l'année.

| Mesure | Validation 1981-2015 | Test 2016-2025 |
|---|---|---|
| Gain par rapport à la climatologie (RPSS ; 0 = pas mieux, 1 = parfait) | **+0,06** | **+0,17** |
| Bonne classe prévue | 41,7 % (climatologie : 37,7 %) | 46,2 % (climatologie : 38,4 %) |
| Erreur moyenne sur la pluie (RMSE) | — | **113 mm** (normale seule : 122 mm) |
| La pluie observée tombe dans la fourchette | — | 79 % (but : 80 %) |

**Ce qu'il faut dire honnêtement** : le gain est réel mais modeste. Prévoir la saison dès fin mai est difficile au Sahel. Le modèle sert à pencher la balance, pas à donner une certitude. L'application affiche donc toujours les trois probabilités et la fourchette, jamais une classe seule.

## Ce qui a été testé et écarté
Tout a été choisi sur la validation 1981-2015, sans regarder le test.

| Variable testée | Pourquoi elle est écartée |
|---|---|
| AMO (oscillation atlantique) | La série s'arrête en 2022 : elle manquerait pour prévoir 2026 |
| TNA (Atlantique nord) | N'améliore pas la validation |
| Pluie de l'année précédente | N'améliore pas la validation |
| Moyenne des 10 saisons précédentes | N'améliore pas la validation |
| Humidité du sol en avril-mai | N'améliore pas la validation et manque pour 6 départements côtiers |

Avec toutes les variables, le modèle collait aux années d'entraînement et faisait moins bien que la climatologie en validation (RPSS −0,04 à −0,11).

**Piège évité** : avec la validation « une année de côté », la climatologie de référence doit elle aussi être recalculée sans l'année laissée de côté. Sinon, la comparaison est faussée et le modèle paraît pire qu'il n'est.

## Ce qu'il produit
`ml/sorties/prevision_saison.csv`, une ligne par département × année, 1981-2035 (2 475 lignes : 1 575 en validation, 450 en test, 45 en 2026, 405 de 2027 à 2035) :

| Colonne | Contenu |
|---|---|
| `code_departement`, `departement`, `zone_agroecologique`, `annee` | Le territoire et l'année |
| `type_prevision` | `RETROSPECTIVE_VALIDATION` (1981-2015, prévue sans cette année), `RETROSPECTIVE_TEST` (2016-2025), `PREVISION_OCEAN` (2026) ou `PREVISION_TENDANCE` (2027-2035) |
| `proba_seche_pct`, `proba_normale_pct`, `proba_humide_pct` | Les 3 probabilités (somme = 100) |
| `classe_prevue` | La classe la plus probable |
| `pluie_prevue_mm`, `pluie_basse_mm`, `pluie_haute_mm` | Pluie prévue et fourchette (8 chances sur 10 d'être dedans) |
| `pluie_normale_mm`, `pluie_observee_mm`, `classe_observee` | Pour comparer |
| `version_modele`, `date_calcul` | Traçabilité |

Plus `ml/sorties/evaluation_m1.csv` : le tableau de fiabilité ci-dessus.

**Prévision 2026 (vraie prévision)** : les indices ONI et TSA de mars-mai 2026 (NOAA) sont dans `ml/entrees/indices_ocean.csv`. Le modèle, réentraîné sur 1981-2025, en tire la prévision 2026 (`type_prevision = PREVISION_OCEAN`, pluie observée vide) : **22 % sèche, 37 % normale, 41 % humide**.

**Années 2027-2035 (prévision de tendance)** : sans océan connu, la pluie attendue est la moyenne des 15 dernières saisons du département, avec une fourchette tirée des écarts mesurés (−17 % / +31 %) et des probabilités égales à la fréquence des classes sur ces 15 saisons. Mesurée en prévoyant 2016-2025 : RMSE 115 mm (normale : 122 mm), RPSS +0,10. Type `PREVISION_TENDANCE`. Elle est remplacée par la prévision océan dès la publication des indices de mai de l'année (voir `ml/entrees/README.md`).

## Dans l'application
- **Carte** : chaque département coloré selon sa pluie prévue comparée à sa normale (en %), avec la fourchette au survol.
- **Fenêtre** : « Saison 2026 : 55 % de chances d'une saison sèche », les 3 barres de probabilité, la pluie prévue et sa fourchette, puis « Fiabilité : un peu mieux que la moyenne des années passées ».
- **Méthode**, repliée : les deux indices, la période de test, le tableau de fiabilité.

## Relancer
```bash
venv/bin/python -m ml.m1_prevision_saison.entrainer
```
La première fois, les tables sont lues dans Snowflake et copiées dans `ml/donnees/` (ignoré par git). Ensuite, le script tourne sans réseau. Pour relire Snowflake, supprimer `ml/donnees/`.
