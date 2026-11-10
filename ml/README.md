# Données pour les modèles — Assaman & Suuf

Ce document dit **quelles données sont disponibles** pour les modèles, **où les trouver** et **comment y accéder**. Il couvre les trois modèles :

1. **Prévision de la pluie de saison** (prioritaire pour la démo) ;
2. **Prévision de l'anomalie de rendement** (si le temps le permet) ;
3. **AgroDistrib** : proposition de répartition des intrants d'une organisation (ministère, ONG) entre zones, régions ou départements.

Pour toute question sur une donnée (colonne, valeur bizarre, besoin d'une nouvelle variable), s'adresser à l'**équipe données** (Aby, Abdoulaye) plutôt que de corriger soi-même.

**Détail des colonnes** (unités, valeurs possibles, limites, exemples de requêtes) : [`docs/contrat-donnees.md`](../docs/contrat-donnees.md). Décisions et état de la modélisation : [`docs/etat-modelisation.md`](../docs/etat-modelisation.md).

---

## 1. Comment accéder aux données

### 1.1 En secours : les fichiers CSV

Les tables sont partagées dans le **dossier Drive commun** de l'équipe. Elles se déposent dans `data/modules/` du dépôt et ne vont **jamais dans Git**.

Le préfixe indique le module : `a_` agroclimat, `b_` cultures, `c_` besoins et rendements, `d_` AgroDistrib. Le détail des colonnes est dans `dataset/README.md`.

Ces fichiers ont le même contenu que les tables `SALTIS.RAW` de Snowflake. Ils permettent d'explorer en attendant l'accès Snowflake, mais n'intègrent pas les règles et contrôles des tables `MART_*`.

### 1.2 À utiliser : l'entrepôt Snowflake

| Élément | Valeur |
|---|---|
| Base | `SALTIS` |
| Entrepôt de calcul | `SALTIS_WH` |
| Données brutes | `SALTIS.RAW` (les CSV chargés tels quels) |
| Données préparées | `SALTIS.MARTS` (faits, dimensions et tables prêtes à l'emploi, construits par dbt) |
| Écriture des résultats ML | `SALTIS.ML` |
| Écriture des scénarios AgroDistrib | `SALTIS.APP` |

**Accès** : l'équipe données crée un utilisateur de service `SVC_ML`, qui pourra **lire** `MARTS` et **écrire** dans `ML`. La connexion se fait par **paire de clés**, sans mot de passe. Demander à l'équipe données l'identifiant du compte et la clé. Ces informations vont dans le fichier `.env` local, **jamais dans Git**. Ne jamais utiliser le compte personnel de quelqu'un d'autre.

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
| `MARTS.DIM_GEOGRAPHIE`, `DIM_REGION`, `DIM_ZONE_AGROECOLOGIQUE`, `DIM_CULTURE`, `DIM_VARIETE`, `DIM_INTRANT`, `DIM_TEMPS` | Référentiels | ✅ prêt |
| Schéma `ML` | Écriture des résultats des modèles | 🔜 en cours |
| Utilisateur `SVC_ML` (paire de clés) | Accès Snowflake de l'équipe ML | 🔜 en cours |
| Contours des départements (GADM 4.1) | Latitude, longitude et géométrie des départements | 🔜 en cours |

Le schéma `APP` (stocks déclarés, paramètres et scénarios AgroDistrib) est alimenté par l'application ; il sera créé avec elle.

**Conseil** : travailler directement sur les tables `MART_*` de `MARTS`, nettoyées et testées. Les CSV ne servent qu'en secours, tant que l'accès `SVC_ML` n'est pas ouvert.

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

Dans `FACT_RENDEMENT_DEPARTEMENT`, filtrer sur **`rendement_kg_ha is not null`** (8 040 lignes), et non sur `est_observe`. `est_observe = true` (8 244 lignes) signifie qu'au moins une valeur a été publiée : il inclut 204 lignes sans rendement, dont 58 avec seulement une superficie, 14 avec seulement une production et 132 avec une superficie et une production mais sans rendement publié. Les 7 428 anomalies sont toutes sur des lignes avec un rendement.

**Variables de saison** : dans `FACT_SAISON_DEPARTEMENT`, à joindre sur département et campagne. Les variables propres à chaque culture (`indice_satisfaction_eau_pct`, `deficit_hydrique_mm`) sont dans le fait de rendement.

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

| Résultat | Où | Contenu attendu |
|---|---|---|
| Prévision de pluie | `SALTIS.ML.PREVISION_SAISONNIERE` | Par département et campagne : version du modèle, date des données utilisées, pluie prévue avec une fourchette, probabilités sèche / normale / humide, classe prévue. Distinguer les prévisions rétrospectives (années passées) de la prévision opérationnelle (année à venir). |
| Prévision de rendement | `SALTIS.ML.PREVISION_RENDEMENT` | Par département, campagne et culture : anomalie prévue, date de prévision (fin mai ou fin juillet). |
| Fiabilité des modèles | `SALTIS.ML.EVALUATION_MODELES` | Métriques par version, par zone et par culture. Elles permettent à l'application d'afficher la fiabilité. |
| Scénarios AgroDistrib | `SALTIS.APP` | Paramètres du scénario, quantité proposée par territoire, détail par département pour l'explication. La quantité validée est saisie par le décideur dans l'application. |

Le format exact des tables est fixé avec l'équipe données avant la première écriture. **Ne jamais écrire dans `RAW` ni dans `MARTS`.** Une prévision ne remplace jamais une observation.

---

## 7. Ce qu'il faut demander à l'équipe données

- L'accès Snowflake (`SVC_ML`, la clé, l'identifiant du compte).
- La création du schéma `ML`.
- Les contours des départements (GADM 4.1), s'ils sont utiles aux modèles.
- Les variables 2026 dès leur publication.
- Toute nouvelle variable utile : elle sera ajoutée proprement dans les tables `MART_*`, pas bricolée dans le code ML.
- La validation du format des tables de sortie avant la première écriture.

**Rappel** : ni données, ni clés, ni identifiants dans Git.
