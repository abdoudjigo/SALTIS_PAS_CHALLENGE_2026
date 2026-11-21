# Données pour les modèles — Assaman & Suuf

Ce document dit **quelles données sont disponibles** pour les modèles, **où les trouver** et **comment y accéder**. Il couvre les trois modèles :

1. **Prévision de la pluie de saison** (prioritaire pour la démo) ;
2. **Prévision de l'anomalie de rendement** (si le temps le permet) ;
3. **AgroDistrib** : proposition de répartition des intrants d'une organisation (ministère, ONG) entre zones, régions ou départements.

L'équipe ML a ajouté un complément, le **modèle de date de semis** (« Quand semer » : à quelle décade semer pour courir le moins de risque), qui utilise la sortie du modèle de pluie. Les modèles construits, leur fiabilité et leurs sorties sont décrits dans [`MODELES.md`](MODELES.md) ; la comparaison des algorithmes dans [`docs/technique/rapport-comparaison-modeles.md`](../docs/technique/rapport-comparaison-modeles.md).


**Détail des colonnes** (unités, valeurs possibles, limites, exemples de requêtes) : [`docs/technique/contrat-donnees.md`](../docs/technique/contrat-donnees.md). Décisions et état de la modélisation : [`docs/technique/etat-modelisation.md`](../docs/technique/etat-modelisation.md).

---

## 1. Comment accéder aux données

### 1.1 En secours : les fichiers CSV

Les tables sont partagées dans des fichiers CSV.

Ces fichiers ont le même contenu que les tables `SALTIS.RAW` de Snowflake. Ils ne servent qu'en secours : ils n'intègrent pas les règles et contrôles des tables `MART_*`.

### 1.2 À utiliser : l'entrepôt Snowflake

| Élément | Valeur |
|---|---|
| Base | `SALTIS` |
| Entrepôt de calcul | `SALTIS_WH` |
| Données brutes | `SALTIS.RAW` (les CSV chargés tels quels) |
| Données préparées | `SALTIS.MARTS` (faits, dimensions et tables prêtes à l'emploi, construits par dbt) |
| Écriture des résultats ML | `SALTIS.ML` |
| Écriture des scénarios AgroDistrib | `SALTIS.APP` |

**Accès** : l'utilisateur **`USER_ML`**, avec le rôle **`R_ML`** (créés par Ibrahima), **lit** `SALTIS.MARTS` et **écrit** dans `SALTIS.ML`. Demander à Ibrahima les identifiants de connexion. Ils vont dans le fichier `.env` local, **jamais dans Git**. Ne jamais utiliser le compte personnel de quelqu'un d'autre.

**Règle** : lire de préférence dans `MARTS`, qui contient les données nettoyées et testées. `RAW` ne sert qu'en dépannage.

### 1.3 Ce qui est prêt et ce qui arrive

| Table | Contenu | Statut |
|---|---|---|
| `MARTS.MART_ML_PREVISION_PLUIE` | **Table d'entraînement prête** pour le modèle de pluie (modèle 1) | ✅ prêt |
| `MARTS.MART_TERRITOIRES_AGRODISTRIB` | **Table unique pour AgroDistrib** (tous les critères par département × culture cultivée) | ✅ prêt |
| `MARTS.MART_VULNERABILITE_DEPARTEMENT` | Score de vulnérabilité par département (relatif, indicatif) | ✅ prêt |
| `MARTS.MART_CARTE_AGROCLIMAT`, `MART_SUIVI_DECADAIRE`, `MART_CHOIX_CULTURES`, `MART_BESOINS` | Tables des écrans de l'application (carte, suivi décadaire, choix des cultures, besoins) | ✅ prêt |
| `MARTS.FACT_SAISON_DEPARTEMENT` | Bilan de chaque saison des pluies | ✅ prêt |
| `MARTS.FACT_RENDEMENT_DEPARTEMENT` | Superficies, productions, rendements (modèle 2) | ✅ prêt |
| `MARTS.FACT_PLUVIOMETRIE_DECADAIRE` | Pluie observée décade par décade | ✅ prêt |
| `MARTS.FACT_CLIMATOLOGIE_DECADAIRE` | Pluie habituelle par décade (1991–2020) | ✅ prêt |
| `MARTS.FACT_ADEQUATION_CULTURE`, `FACT_ADEQUATION_VARIETE`, `FACT_FACTEURS_LIMITANTS`, `FACT_REFERENCE_AGRONOMIQUE`, `FACT_BESOIN_REFERENCE` | Adéquation, facteurs limitants, doses, besoins | ✅ prêt |
| `MARTS.DIM_GEOGRAPHIE`, `DIM_REGION`, `DIM_ZONE_AGROECOLOGIQUE`, `DIM_CULTURE`, `DIM_VARIETE`, `DIM_INTRANT`, `DIM_TEMPS` | Référentiels, dont les coordonnées des départements (`DIM_GEOGRAPHIE`) et les paramètres agronomiques des cultures (`DIM_CULTURE`) | ✅ prêt |
| Schéma `SALTIS.ML` | Écriture des résultats des modèles | ✅ prêt |
| Rôle `R_ML` et utilisateur `USER_ML` | Accès Snowflake de l'équipe ML (lecture `MARTS`, écriture `ML`) | ✅ prêt |
| Contours des départements (GADM 4.1) | Géométrie des départements (les coordonnées sont déjà dans `DIM_GEOGRAPHIE`) | 🔜 en cours |

**Conseil** : travailler directement sur les tables `MART_*` de `MARTS`, nettoyées et testées. Les CSV ne servent qu'en secours.

---

## 2. Repères communs à toutes les données

| Notion | Ce qu'il faut savoir |
|---|---|
| **Clé géographique** | `code_departement` au format GADM (ex. `SEN.10.1_1`). Ne jamais utiliser le nom comme clé. |
| **Territoires** | 45 départements, 14 régions, 6 zones agroécologiques. Un département appartient à une seule zone et à une seule région. **Zone et région ne sont pas emboîtées** : Louga, Matam et Tambacounda couvrent chacune deux zones. |
| **Saison des pluies** | Du 1er juin au 31 octobre, soit les décades 16 à 30. |
| **Décade** | 10 jours : 1–10, 11–20, 21–fin du mois. 36 par an. |
| **Campagne agricole** | Année de l'hivernage (juin N à mai N+1 → N). Colonne `annee` dans les CSV, `campagne_agricole` dans les tables de `MARTS`. |
| **Normales** | Calculées sur 1991–2020. |
| **Classes de saison** | `très sèche`, `sèche`, `normale`, `humide`, `très humide`, définies à partir du SPI. |
| **Valeurs manquantes** | Elles restent vides dans toutes les tables, jamais remplacées par zéro. |
| **Coordonnées** | `latitude` et `longitude` de chaque département (degrés décimaux, WGS 84) dans `DIM_GEOGRAPHIE` (et `MART_CARTE_AGROCLIMAT`), pour 45 départements sur 45. `zone_secondaire` signale les 8 départements de transition entre deux zones : c'est une information, pas un regroupement. |

---

## 3. Modèle 1 — Prévision de la pluie de saison

### Données

| Source | Grain | Volume | Période |
|---|---|---|---|
| **`MARTS.MART_ML_PREVISION_PLUIE`** (à utiliser) | département × année | 2 025 lignes (45 × 45 ans) | 1981–2025 |
| `a_predicteurs_saisonniers.csv` (secours) | idem | idem | idem |

`MART_ML_PREVISION_PLUIE` contient déjà tout ce qu'il faut, avec les codes du territoire (`code_departement`, `code_region`, `region`, `zone_agroecologique`) :

- **`jeu`** : `ENTRAINEMENT` (≤ 2015, 1 575 lignes) ou `TEST` (2016–2025, 450 lignes). Le découpage est temporel : ne jamais mélanger les années au hasard ;
- **`nb_variables_manquantes`** : nombre de variables explicatives vides sur la ligne (438 lignes en ont au moins une) ;
- les variables connues fin mai et les cibles, décrites ci-dessous.

**Cibles** :
- `pluie_saison_mm` : cumul de juin à octobre ;
- `classe_saison`.

Elles sont identiques à celles de `FACT_SAISON_DEPARTEMENT` (vérifié).

**Variables connues fin mai** :

| Variable | Remarque |
|---|---|
| `indice_oni_mars_mai` | El Niño. **Même valeur pour les 45 départements d'une année.** |
| `indice_tna_mars_mai`, `indice_tsa_mars_mai` | Atlantique tropical nord et sud. **Même valeur pour tous les départements.** |
| `indice_amo_mars_mai` | Oscillation atlantique. **Absente de 2023 à 2025** : la série s'arrête en 2022. |
| `pluie_saison_n_moins_1_mm` | Pluie de l'année précédente. Absente en 1981. |
| `humidite_sol_avril_mai_m3_m3` | **Toujours absente pour 6 départements côtiers** : Dakar, Guédiawaye, Pikine, Rufisque, Oussouye, Ziguinchor. Absente aussi ponctuellement : Goudomp (4 années entre 1989 et 2003) et 8 départements en 1986. |
| `pluie_normale_saison_mm` | Constante par département, calculée sur 1991–2020. |

### Points d'attention sur ces données

- **Le signal climatique ne compte qu'une valeur par année.** Les indices étant identiques pour tous les départements, la période 1981–2015 ne fournit que 35 situations océaniques différentes.
- **Les années récentes sont plus humides.** Sur 2016–2025, on ne compte que 39 saisons sèches ou très sèches sur 450, contre 495 sur 1 575 entre 1981 et 2015. L'anomalie moyenne sur 2016–2025 est de +7,6 %.
- **La normale 1991–2020 chevauche les années récentes.** Une comparaison sur 2016–2020 n'est donc pas totalement indépendante de la normale.
- **Les variables de saison** (`pluie_juin_juillet_mm`, début de saison, SPI, NDVI…) sont connues **après** fin mai. Elles ne peuvent pas servir à une prévision faite avant la saison.

### Repères chiffrés

Écart moyen (RMSE) sur 2016–2025 de deux prévisions simples :

| Prévision simple | RMSE |
|---|---|
| Moyenne 1981–2015 de chaque département | 134 mm |
| Normale 1991–2020 de chaque département | 122 mm |

### Pour la prévision 2026

Les indices mars–mai 2026 (ONI, TNA, TSA), la pluie 2025 et l'humidité du sol avril–mai 2026 seront ajoutés par l'équipe données dès leur publication. Il faut en faire la demande.

---

## 4. Modèle 2 — Anomalie de rendement

### Données

| Source | Grain | Volume | Période |
|---|---|---|---|
| `c_rendements_departement.csv`, ou `FACT_RENDEMENT_DEPARTEMENT` | département × campagne × culture | 22 905 lignes, dont **8 040 avec un rendement observé** | 1981–2021 observées |

**Cible** : `anomalie_rendement_pct`, l'écart du rendement à sa tendance. 7 428 valeurs ; médiane +2,5 % ; quelques **valeurs extrêmes** (jusqu'à +1 349 %).

**Cible retenue (validée par l'équipe le 18/11/2026)** : le modèle de rendement (`ml/m3_rendement/`) n'utilise pas `anomalie_rendement_pct`, mais le **rapport du rendement à la moyenne des 10 campagnes précédentes** du même département et de la même culture (au moins 5 observées). La tendance fournie par la source (`tendance_rendement_kg_ha`, d'où vient `anomalie_rendement_pct`) est ajustée sur toute la série, années futures comprises : elle n'est pas connue au moment de la prévision.

Dans `FACT_RENDEMENT_DEPARTEMENT`, filtrer sur **`rendement_kg_ha is not null`** (8 040 lignes), et non sur `est_observe`. `est_observe = true` (8 244 lignes) signifie qu'au moins une valeur a été publiée : il inclut 204 lignes sans rendement, dont 58 avec seulement une superficie, 14 avec seulement une production et 132 avec une superficie et une production mais sans rendement publié. Les 7 428 anomalies sont toutes sur des lignes avec un rendement.

**Variables de saison** : dans `FACT_SAISON_DEPARTEMENT`, à joindre sur département et campagne. Les variables propres à chaque culture (`indice_satisfaction_eau_pct`, `deficit_hydrique_mm`) sont dans le fait de rendement.

**Paramètres des cultures** : dans `DIM_CULTURE`, à joindre sur `id_culture`, pour les 12 cultures :

| Colonne | Contenu |
|---|---|
| `kc_ini`, `kc_mid`, `kc_end` | Coefficients culturaux FAO-56 (début, mi-saison, fin de cycle) |
| `t_base_c` | Température de base de la culture, en °C (7 à 12), utile pour les degrés-jours |
| `cycle_min_jours`, `cycle_max_jours` | Durée de cycle la plus courte et la plus longue (égales aux cycles court et long de `FACT_ADEQUATION_CULTURE`) |
| `nom_fao` | Libellé FAOSTAT de la culture |

Ce sont des valeurs de référence par culture, identiques partout. Elles ne varient ni par département ni par année.

**Couverture en eau par cycle** : `FACT_ADEQUATION_CULTURE` contient maintenant `proba_besoin_eau_couvert_final_pct` pour les 3 cycles. Pour le cycle moyen, c'est la valeur de la source ; les cycles court et long y ajoutent l'écart calculé entre cycles (approximation décadaire). Le calcul brut reste dans `proba_besoin_eau_couvert_calc_pct`. Il s'agit d'une probabilité climatique sur 1991-2020, constante d'une année à l'autre : elle peut décrire un département, pas une campagne donnée.

### Observations par culture

| Culture | Rendements | dont anomalie renseignée |
|---|---|---|
| Arachide | 1 447 | 1 447 |
| Mil | 1 368 | 1 368 |
| Sorgho | 1 295 | 1 294 |
| Niébé | 1 265 | 1 253 |
| Maïs | 1 113 | 1 088 |
| Riz irrigué | 889 (dépend de l'irrigation plus que de la pluie) | 811 |
| Manioc | 453 (culture pluriannuelle) | 133 |
| Sésame | 178 | 34 |
| Pastèque, coton, tomate | 24, 5, 3 (trop peu) | 0 |

### Points d'attention sur ces données

- **Rupture de série en 2016.** Jusqu'en 2015, les superficies sont **récoltées** (source HarvestStat / DAPSA). À partir de 2016, elles sont **semées** (FEWS NET). Les rendements calculés sur la superficie semée sont mécaniquement plus bas. Les colonnes `type_superficie` et `source_rendement` le signalent.
- **Pas de données après 2021.**
- **Ce qui est connu quand** :
  - avant la saison : caractéristiques fixes des départements et prévision de pluie du modèle 1 ;
  - fin juillet : pluie de juin–juillet, date de début de saison ;
  - le reste (pluie totale, séquences sèches, chaleur, NDVI, satisfaction en eau) n'est connu qu'en fin de saison.
- **NDVI** disponible seulement à partir de 2000.

---

## 5. AgroDistrib — Répartition des intrants

### Le principe

Le décideur (ministère, ONG) saisit son intrant, la quantité, la campagne, le niveau de répartition (zone, région ou département) et ses priorités (rendement ou équité). **La solution propose** une répartition par territoire, au choix parmi plusieurs scénarios. Le décideur compare, ajuste et valide. La quantité répartie ne dépasse jamais le stock déclaré de l'organisation.

### Données

Tout est regroupé dans **une seule table**, `MARTS.MART_TERRITOIRES_AGRODISTRIB`. **Grain : département × culture, seulement là où la culture existe** (superficie de référence renseignée et > 0) : **345 lignes, 43 départements** (Guédiawaye et Pikine n'ont aucune superficie agricole de référence). AgroDistrib ne répartit que sur ces couples.

| Critère | Colonnes | Additif ? |
|---|---|---|
| Territoire et agrégation | `code_departement`, `departement`, `code_region`, `region`, `zone_agroecologique`, `culture` | — |
| Besoin | `superficie_reference_ha` ; besoins en t : `besoin_azote_n_t`, `besoin_phosphate_p2o5_t`, `besoin_potasse_k2o_t`, `besoin_npk_15_15_15_t`, `besoin_uree_t`, `besoin_dap_t`, `besoin_fumier_t` ; `besoin_semences_applicable`, `besoin_semences_retenu_t` ; `statut_validation_engrais`, `statut_validation_semis` | **Oui** (superficie et besoins) |
| Potentiel de gain | `niveau_source_potentiel` (toujours `ZONE`), `rendement_moyen_kg_ha`, `rendement_atteignable_kg_ha`, `ecart_rendement_kg_ha`, `potentiel_evalue`, `potentiel_gain_kg_ha` | Non |
| Capacité à valoriser l'intrant | `meilleur_niveau_adequation`, `proba_cycle_couvert_moyen_pct`, `facteur_limitant_principal`, `proba_saison_seche_pct` (climatologie) | Non |
| Contraintes de sol | `classe_texture`, `ph_eau`, `reserve_utile_mm`, `carbone_organique_g_kg` (département) ; `amendement_ph_recommande`, `fractionnement_azote_recommande` (zone) | Non |
| Équité | `score_vulnerabilite`, `classe_vulnerabilite`, `score_alea_secheresse`, `confiance_rendement`, `methode_version_vulnerabilite` | Non |
| Contexte | `part_cultures_pct` | Non |

Comment lire ces colonnes :

- **Besoins** : les besoins d'une zone ou d'une région sont la **somme** de ses départements. Ne jamais additionner produits (NPK, urée, DAP) et éléments (N, P₂O₅, K₂O) : ils décrivent la même fertilisation. Un besoin vide veut dire « dose à saisir », jamais 0.
- **Semences** : `besoin_semences_applicable` est faux pour le riz irrigué en Casamance (riz surtout pluvial, alors que la dose est celle du repiquage irrigué) ; `besoin_semences_retenu_t` y est vide. Toujours totaliser sur `besoin_semences_retenu_t`.
- **Potentiel de gain** : `niveau_source_potentiel = 'ZONE'` signifie que le rendement moyen, l'atteignable et l'écart sont des valeurs de la **zone**, reprises sur chaque département. Ils servent à classer, ne s'additionnent jamais et ne distinguent pas les départements d'une même zone. `potentiel_gain_kg_ha` est vide quand le rendement de la zone est en fait une valeur nationale (`potentiel_evalue = false`) ; aucune ligne n'est concernée aujourd'hui.
- **Vulnérabilité** : le détail du score (indicateurs, rangs, méthode) est dans `MARTS.MART_VULNERABILITE_DEPARTEMENT`. Le score est **relatif** (il compare les départements entre eux) et **NULL pour Dakar, Guédiawaye et Pikine** (rendements absents ou trop peu nombreux) ; dans `MART_TERRITOIRES_AGRODISTRIB`, seul Dakar est concerné (2 lignes), les deux autres n'y figurant pas.
- **Probabilité de saison sèche prévue** : elle viendra de la sortie du modèle 1 (`SALTIS.ML`), à joindre sur `code_departement` et la campagne.

Les **stocks déclarés** et les **paramètres saisis** par le décideur seront dans `SALTIS.APP`, alimenté par l'application.

**Moteur construit** : [`agrodistrib/`](agrodistrib/README.md) (18/11/2026), prorata multicritère avec l'arbitrage α du décideur, à partir de cette table. Il n'est pas encore servi par l'API.

En secours, les mêmes informations se trouvent dans les CSV `c_besoins_departement_culture`, `c_besoins_par_hectare`, `c_facteurs_limitants_zone_culture`, `b_adequation_culture_departement` et `a_profil_agroclimatique_departement`, mais sans les règles ci-dessus (semences non applicables, potentiel non évalué, vulnérabilité).

### Points d'attention sur ces données

- **Doses très partielles.** Sur les 345 couples de la table, 286 n'ont pas de dose d'engrais (besoin vide). Seul le **mil** a une dose d'engrais dans toutes les zones (NPK 125 kg/ha + urée 93,75 kg/ha), et elle est encore **à confirmer**. Le maïs, le sorgho et le riz n'en ont que dans la Vallée. **L'arachide (1,18 million d'ha), le niébé et le sésame n'ont aucune dose** tant que les données de l'ISRA n'ont pas été reçues. Il faut prévoir que le décideur puisse saisir une dose manquante.
- **Statut des doses.** Chaque dose porte un statut (`VALIDEE`, `A_CONFIRMER`, `NON_VERIFIEE`, `A_COMPLETER`). Il doit apparaître dans les résultats.
- **Superficies** : ce sont les moyennes des dernières campagnes connues (jusqu'en 2021), pas des superficies prévues pour la campagne.
- **Facteurs limitants** : calculés par zone, pas par département. 33 couples zone × culture sur 72 indiquent « données insuffisantes ».
- **Aucune donnée de réponse aux engrais** par territoire : le gain de rendement ne peut être qu'un indicateur de priorité.
- **Le sol varie beaucoup à l'intérieur d'une même zone** (pH de 5,6 à 7,0 dans le Bassin arachidier). D'où l'intérêt de raisonner par département, puis d'agréger par zone ou par région.
- **Aucun stock réel** n'existe encore : `d_stocks_disponibles.csv` est vide, et `d_scenarios_repartition.csv` est un **ancien exemple**, à ne pas réutiliser.

### Cas de démonstration réaliste avec les données actuelles

**20 000 t de NPK 15-15-15 pour le mil**, campagne 2026, réparties par zone. Le besoin calculé est d'environ 120 000 t sur 41 départements : la quantité ne couvre qu'une partie du besoin, donc les priorités comptent.

---

## 6. Où déposer les résultats

Les modèles écrivent d'abord des CSV dans `ml/sorties/`. Les tables de `SALTIS.ML` sont créées par [`snowflake/20_ml_resultats.sql`](../snowflake/20_ml_resultats.sql) (à exécuter à la main, une fois), puis remplies par [`charger_snowflake.py`](charger_snowflake.py) : sans option, il vérifie sans écrire ; avec `--confirmer`, il vide chaque table puis la remplit.

| Résultat | Où | Fichier | Contenu |
|---|---|---|---|
| Prévision de pluie (modèle 1) | `SALTIS.ML.PREVISION_SAISONNIERE` | `prevision_saison.csv` | Par département et année (1981-2035) : version du modèle, date de calcul, pluie prévue avec une fourchette, probabilités sèche / normale / humide, classe prévue. `type_prevision` distingue les prévisions rétrospectives (`RETROSPECTIVE_VALIDATION`, `RETROSPECTIVE_TEST`) des prévisions des années à venir (`PREVISION_OCEAN` pour 2026, `PREVISION_TENDANCE` pour 2027-2035). |
| Prévision de rendement (modèle 2 de ce document) | `SALTIS.ML.PREVISION_RENDEMENT` | `prevision_rendement.csv` | Par département, culture, campagne et moment de prévision (fin mai à fin août) : fourchette de rendement, probabilité de chute de la récolte, drapeaux `rendement_fiable` et `alerte_fiable`. |
| Date de semis (complément) | `SALTIS.ML.RISQUE_SEMIS` | `risque_semis.csv` | Par département, année, culture et décade de semis : risques de faux départ et de fin trop tôt, décade conseillée. |
| Fiabilité des modèles | `SALTIS.ML.EVALUATION_MODELES` | `evaluation_m1.csv`, `evaluation_m3.csv`, `evaluation_m4.csv` | Une ligne par mesure : version, période, moment, culture. Elles permettent à l'application d'afficher la fiabilité. |
| Scénarios AgroDistrib | `SALTIS.APP` (**à venir** : schéma pas encore créé) | — | Paramètres du scénario, quantité proposée par territoire, détail par département pour l'explication. La quantité validée est saisie par le décideur dans l'application. |

Le format des tables est à valider avec l'équipe données avant la première écriture. **Ne jamais écrire dans `RAW` ni dans `MARTS`.** Une prévision ne remplace jamais une observation.

---

## 7. Ce qu'il faut demander à l'équipe données

- Les identifiants de connexion de `USER_ML` (rôle `R_ML`, déjà créés) : auprès d'Ibrahima, pour le fichier `.env` local.
- Les contours des départements (GADM 4.1), s'ils sont utiles aux modèles.
- Les variables 2026 dès leur publication.
- Toute nouvelle variable utile : elle sera ajoutée proprement dans les tables `MART_*`, pas bricolée dans le code ML.
- La validation du format des tables de sortie avant la première écriture.

