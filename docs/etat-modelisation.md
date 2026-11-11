# État de la modélisation — Projet SALTIS / Assaman & Suuf (équipe AKAI)

Référence partagée de l'équipe pour le volet données : périmètre, décisions validées, règles, état des modèles dbt, points ouverts. Mis à jour à la fin de chaque tâche.

- Dépôt `abdoudjigo/assaman-suuf`, branche `develop` ; le travail de modélisation se fait sur `dev/aby`.
- Données pour les modèles (accès, tables, variables) : [`ml/README.md`](../ml/README.md).
- Contrat de données des marts pour l'API et le front (grain, colonnes, unités, limites, exemples) : [`docs/contrat-donnees.md`](contrat-donnees.md).
- Détail des colonnes des fichiers sources : [`dataset/README.md`](../dataset/README.md).

État au 10/11/2026.

---

## 1. Le projet

Plateforme d'aide à la décision agricole au Sénégal (SALTIS PAS Challenge 2026), à l'échelle du département (45 départements, 6 zones agroécologiques).

Modules :
- DataFlow360 (socle données et analyse) ;
- A. suivi agroclimatique ;
- B. choix des cultures et des variétés ;
- C. besoins et rendements ;
- D. AgroDistrib (stocks, scénarios et allocations d'intrants par organisation).

Chaîne de données : sources → Snowflake `SALTIS.RAW` → dbt (`STAGING` → `INTERMEDIATE` → `MARTS`) → application / BI.
PostgreSQL gère les données opérationnelles de l'application : utilisateurs, rôles, organisations, déclarations de stocks, scénarios. Aucune donnée d'authentification ne va dans Snowflake.

### Cibles et fonctionnalités (dossier de candidature, référence)

Le dossier de candidature P.A.S Challenge complète la passation pour les fonctionnalités.

**Décision de l'équipe, postérieure à la candidature : les coopératives sont retirées du périmètre.** Pas de type d'organisation « coopérative », pas de rattachement producteur → coopérative, pas de consolidation au niveau coopérative. Les fournisseurs d'intrants restent aussi hors périmètre.

| Cible | Ce qu'elle doit pouvoir faire |
|---|---|
| Producteurs (bénéficiaires finaux) | Préparer la campagne, choisir culture et variété, estimer leurs propres besoins |
| Associations de producteurs de semences (**à trancher** : option B, déclarer leur offre de variétés sans scénario, ou retrait des cibles) | Caractériser leurs variétés, déclarer les semences disponibles, voir l'adéquation variétés × zones |
| Conseillers agricoles (ANCAR, services techniques) (**à trancher** : maintien recommandé, aucune fonctionnalité propre) | Relayer les recommandations aux producteurs, valider les seuils et les recommandations |
| Services de l'État et institutions | Anticiper les besoins, planifier, répartir leurs propres intrants |
| ONG | Cibler les territoires vulnérables, allouer leurs propres ressources |
| Administrateurs | Utilisateurs, droits, référentiels |

Fonctionnalités en plus du socle déjà prévu :
- **Avant la campagne** : prévision saisonnière (modèle ML à venir), distincte de l'historique.
- **Pendant la campagne** : suivi décade par décade, cumul observé comparé à la normale.
- **Vulnérabilité** : indicateur par département (alertes sécheresse, pluie de l'année sèche, variabilité des pluies et des rendements ; la probabilité de saison sèche est affichée hors score, voir `mart_vulnerabilite_departement`), utilisable comme règle de priorité dans les scénarios.
- **Besoins à deux niveaux** : producteur et département, distincts (pas de niveau coopérative).
- **Offre de semences** (si les associations de semenciers sont confirmées) : variétés disponibles déclarées, rapprochées des besoins et de l'adéquation.
- **Validation par des spécialistes** : statut de validation porté par chaque référence agronomique et chaque recommandation.

Sources futures citées dans la candidature, absentes de RAW aujourd'hui : ERA5-Land, ESA WorldCover, MODIS, stations météo locales. Ne pas créer de modèles avant leur ingestion.

---

## 2. Règles validées

1. Ne jamais inventer de source RAW ou de modèle STAGING inexistant.
2. Un modèle qui dépend d'une source à venir est désactivé avec `config(enabled=false)`, pas supprimé. On désactive le staging et la dimension ensemble.
3. Les stocks sont gérés par **organisation** (pas par département) et ne sont jamais mutualisés entre organisations. Une organisation est une ONG ou un service de l'État (association de producteurs de semences : à confirmer). Les coopératives et les fournisseurs d'intrants sont hors périmètre, tout comme la logistique physique (entrepôts, transport).
4. Les scénarios sont **générés par la solution** (algorithme de répartition), pas construits à la main par l'organisation. L'organisation fournit son stock et ses priorités, compare les propositions, peut les ajuster, puis valide. Un scénario est toujours rattaché à l'organisation dont il répartit le stock. Les quantités proposées par l'algorithme et les quantités validées restent distinctes. Chaque scénario conserve la méthode, la version de l'algorithme et les paramètres utilisés.
5. Les besoins doivent pouvoir être calculés au niveau départemental et au niveau du producteur, sans être confondus.
6. Les anciennes simulations (`D_SCENARIOS_REPARTITION`) ne sont pas de vrais scénarios. `D_STOCKS_DISPONIBLES` est vide et suit un ancien modèle par département : ne pas l'utiliser pour les stocks.
7. Besoins historiques ou de référence ≠ besoins prévisionnels.
8. Les doses agronomiques incomplètes ne sont jamais présentées comme validées.
9. Chaque fait garde son grain d'origine : on ne mélange pas département, zone et national, et on ne remplace jamais une valeur manquante par zéro. Précision validée : il est interdit de recopier une valeur de zone sur les départements **puis de l'additionner** (double comptage) ; la porter comme attribut non additif servant à classer est autorisé (ex. potentiel de gain dans `mart_territoires_agrodistrib`, avec `niveau_source_potentiel = 'ZONE'`).

---

## 3. État des modèles

Résumé : 40 modèles actifs (16 staging, 1 intermediate, 7 dimensions, 9 faits, 7 marts), 1 seed, **tous les tests OK** (total en section 3.6).

### 3.1 Préparation (étape 1, T0, corrections)

- **Étape 1** :
  - modèles sans source désactivés : `stg_organisations`, `stg_intrants`, `dim_organisation`, `dim_intrant` (réactivée en A4 sur le seed `ref_intrants`), `dim_scenario_allocation` ;
  - `dim_variete` corrigé (`tolerance_secheresse`, `disponibilite_semences`) ;
  - `int_reference_besoins_departement_culture` déplacé dans `SALTIS.INTERMEDIATE` (ancienne vue de `PUBLIC` supprimée).
- **Corrections** : commentaire de `dim_geographie` (zone et région parallèles) ; `fact_rendement_valeurs_valides.sql` déplacé de `models/marts/` vers `tests/` (aucun objet n'avait été construit dans `SALTIS.MARTS`).
- **T0, nettoyage des anciens marts** : les 8 `mart_*.sql` (copies du staging : `mart_saisons`, `mart_profil_agro`, `mart_adequation`, `mart_adequation_varietes`, `mart_besoins`, `mart_rendements`, `mart_facteurs_limitants`, `mart_agrodistrib`) sont supprimés, ainsi que leurs blocs dans `_marts.yml` et `tests/mart_grains_uniques.sql`. Le script `snowflake/00_drop_anciens_marts.sql` est à exécuter à la main (voir section 6). Après T0 : 26 modèles actifs, 74 tests OK.
  - Références restantes, non modifiées : `api/main.py` (voir section 7), `README.md`, `dbt/README.md`, `docs/README-constellation.md` (`mart_besoins_intrants`), commentaire de `fact_saison_departement.sql` (`mart_profil_agro`). À traiter en D1.

### 3.2 Dimensions

- **Étape 2** :
  - `dim_temps` : décades limitées à 3 par mois (le 31 tombe en décade 3), dates générées par `row_number()`, ajout de `libelle_decade` et `est_decade_saison` ;
  - `dim_geographie` basée sur `stg_profil_agroclimatique` ;
  - 29 tests sur les dimensions passent (à l'étape 2).
- Volumes : `dim_temps` 20 454 (1980–2035), `dim_geographie` 45, `dim_region` 14, `dim_zone_agroecologique` 6, `dim_culture` 12, `dim_variete` 3, `dim_intrant` 9.
- **A1, géographie** :
  - `dim_region` (14 régions, `nb_departements`, `superficie_km2`) depuis `stg_profil_agroclimatique`, macro `cle_region` ; `id_region` ajouté à `dim_geographie` (qui utilise désormais les macros pour ses trois clés, mêmes valeurs). Aucun lien région → zone.
  - `code_region` dans `dim_region` et `dim_geographie`, déduit du code département (règle GADM `SEN.10.1_1` → `SEN.10_1`, à confirmer avec `GID_1`) ; test `tests/dim_region_code_region_coherent.sql` (14 codes ↔ 14 noms).
  - Aucune coordonnée ni géométrie disponible : ni dans le dépôt, ni dans `SALTIS.RAW`, ni dans `../data_fr_bis.zip` (mêmes 17 CSV que `dataset/`). `departement_statique` et `stations_pluie_mois`, cités dans `docs/README-constellation.md`, n'ont jamais été livrés.
  - **Contours GADM préparés, non actifs** (l'équipe récupère GADM 4.1 Sénégal niveau 2) :
    - `snowflake/10_geo_departements.sql` : DDL de `RAW.GEO_DEPARTEMENTS` (`gid_2`, `gid_1`, `nom_departement`, `latitude_centroide`, `longitude_centroide`, `superficie_km2`, `geometrie GEOGRAPHY`) et exemple de chargement GeoJSON commenté ;
    - source `raw.geo_departements`, `stg_geo_departements`, branche latitude/longitude de `dim_geographie` (`gid_2 = code_departement`) et test `tests/geo_departements_correspondance.sql` (45 départements ↔ 45 `gid_2`, `gid_1 = code_region`) ;
    - un seul interrupteur : variable `geo_departements_charge` (false) dans `dbt_project.yml`. La passer à true après chargement ; tant qu'elle vaut false, `latitude` et `longitude` n'existent pas dans `dim_geographie`.
  - **Licence GADM** : usage non commercial uniquement, citation obligatoire (« GADM, version 4.1, https://gadm.org »). Le front utilisera un GeoJSON simplifié tiré du même fichier GADM (mêmes `GID_2`).
- **Zone et région ne sont pas emboîtées** : un département appartient à une seule zone et à une seule région, mais Louga, Matam et Tambacounda s'étendent chacune sur deux zones. Zone et région sont deux regroupements parallèles des départements. Ne pas coder une hiérarchie zone → région.
- `dim_intrant` : réactivée sur le seed `seeds/ref_intrants.csv` (9 codes, teneurs NPK 15-15-15, urée 46-0-0, DAP 18-46-0 ; fumier, semences, éléments et eau sans teneur) ; `stg_intrants` reste désactivé. Seed construit dans `SALTIS.STAGING`. **Note pour C3** : `SALTIS.APP.intrants` reprendra ces 9 `code_intrant`.

### 3.3 Faits du module A (agroclimat)

- **Étape 3** : `fact_rendement_departement`
  - grain : département × campagne × culture ;
  - 22 905 lignes, dont 8 244 avec `est_observe = true` (au moins une valeur publiée), campagnes 1981 à 2021 observées ;
  - 8 040 lignes avec un rendement renseigné : `est_observe` inclut 204 lignes sans rendement (58 superficie seule, 14 production seule, 132 superficie et production sans rendement publié). Pour un calcul sur le rendement, filtrer sur `rendement_kg_ha is not null` ;
  - variables climatiques départementales et données nationales (`engrais_total_kg_ha`, `rendement_national_kg_ha`) exclues ;
  - tests OK (génériques et `tests/fact_rendement_valeurs_valides.sql`).
- **Étape 4** : `fact_saison_departement`
  - grain : département × campagne, 2 025 lignes, 1981–2025 ;
  - Guédiawaye passe par NASA POWER (45 lignes) ;
  - c'est la source de référence des variables climatiques départementales ;
  - tests OK : 10 génériques et `tests/fact_saison_valeurs_valides.sql` ;
  - **contrôle de cohérence de la pluie avec la source des rendements validé** (0 écart dans Snowflake, contrôle fait par l'équipe le 10/11/2026).
- **Étape 5** : `fact_pluviometrie_decadaire`
  - grain : département × année × décade (`numero_decade_annee` 1 à 36), 71 280 lignes, 44 départements (Guédiawaye absent), 1981–2025 ;
  - `campagne_agricole` calculée comme dans `dim_temps` ; cumul et part de saison renseignés pour les décades 16 à 30 uniquement, nuls ailleurs ;
  - colonnes dérivées : `est_decade_saison`, `cumul_normale_depuis_juin_mm`, `ecart_cumul_normale_mm` ;
  - anomalie nulle quand la normale de la décade est < 1 mm ; `decade_seche` n'a de sens qu'avec `est_decade_saison` ;
  - tests OK : 13 génériques et `tests/fact_pluviometrie_valeurs_valides.sql`.
- **Étape 6** : `fact_climatologie_decadaire`
  - union de `stg_repartition_pluie_departement` et `stg_repartition_pluie_zone`, normales 1991-2020 (`periode_reference`) ;
  - grain : `niveau_geographique` (`DEPARTEMENT` / `ZONE`) × territoire × `numero_decade_annee` ; 1 584 lignes département (44, Guédiawaye absent) + 216 lignes zone = 1 800 ;
  - une seule clé renseignée par ligne (`id_departement` ou `id_zone_agroecologique`) ; zone jamais recalculée depuis les départements ;
  - mesures non additives ; `pluie_1_annee_sur_5_mm` = quantile bas, `pluie_4_annees_sur_5_mm` = quantile haut (vérifié) ; totaux de saison constants exclus ;
  - tests OK : 11 génériques et `tests/fact_climatologie_valeurs_valides.sql` (grain, clé selon le niveau, probabilités, ordre des quantiles, part cumulée croissante).

### 3.4 Faits des modules B et C

- **A2, étape 7** : `fact_adequation_culture` et `fact_adequation_variete` (module B)
  - `fact_adequation_culture` : département × culture × `classe_cycle`, 1 620 lignes (45 × 12 × 3). Exclus car constants sur les 3 cycles (vérifié) : `rendement_moyen_kg_ha`, `variabilite_rendement_cv_pct`, `classe_texture`, `ph_eau`, `reserve_utile_mm`.
  - Calcul du score par la source, vérifié sur les 1 080 lignes notées, non corrigé : `score = round(0,6 × proba_cycle_couvert_pct du cycle + 0,4 × proba_besoin_eau_couvert_pct du cycle moyen)`. Les cycles court et long reprennent la probabilité « eau » du cycle moyen, d'où `proba_besoin_eau_couvert_pct` renseignée seulement pour le cycle moyen.
  - **Règle de seuils retenue (celle de la source)**, sur le score arrondi : `adaptée` si score > 80, `à risque` si score > 50 (et ≤ 80), `déconseillée` sinon (14 lignes pile à 80 ou 50). `dataset/README.md` corrigé (il annonçait ≥ 80). Variétés : seuil différent, `adaptée` dès `proba_cycle_couvert_pct` ≥ 80 (une ligne à 80,0 classée adaptée), conforme au README. Score nul seulement pour `irrigation requise` (riz irrigué, oignon, tomate : 405) et `non évaluée (culture pluriannuelle)` (manioc : 135).
  - `fact_adequation_variete` : département × variété, 90 lignes (45 × 2), `id_culture` conservé et testé égal à celui de `dim_variete`. Mil souna (type hâtif) absent (cycle inconnu) ; Sahel 177 sans `proba_cycle_couvert_pct` (irrigué). `cycle_jours` et `zones_recommandees` laissés à `dim_variete`.
  - tests OK : 21 génériques et `tests/fact_adequation_valeurs_valides.sql`. Après A2 : 107 tests OK, 29 modèles actifs.
- **A3, étape 8** : `fact_facteurs_limitants` (module C)
  - grain : zone × culture, 72 lignes (6 × 12) ; clés `cle_zone`, `cle_culture` ;
  - colonnes : `nb_observations`, rendements moyen et atteignable, écart, `source_rendement`, `est_rendement_national`, facteur limitant principal, 4 corrélations, 3 recommandations de sol (booléens, depuis `oui`/`non`) ;
  - `données insuffisantes` (33 lignes) et `aucun facteur climatique net` (4) sont des valeurs légitimes ;
  - **16 lignes à rendement national FAOSTAT recopié sur la zone** (`est_rendement_national = true`, ex. oignon 30 555,71 kg/ha dans 6 zones), toutes en `données insuffisantes` ; conservées telles quelles (décision validée ; règle d'usage en section 4) ;
  - écart négatif pour Vallée du fleuve × Sésame (−26,12) ; `correlation_chaleur` nulle pour 5 cultures des Niayes ; `apport_organique_recommande` toujours faux ;
  - exclus : `adequation_cycle` (voir `fact_adequation_culture`), `besoin_irrigation_normal_mm` (repris en A4 comme intrant `EAU_IRRIGATION` de `fact_reference_agronomique` : volume m³/ha et besoin mm, statut « estimation FAO-56, efficience 60 % ») ;
  - tests OK : 17 génériques et `tests/fact_facteurs_limitants_valeurs_valides.sql`. Après A3 : 125 tests OK.
- **A4, étape 9** : `fact_reference_agronomique` (depuis `stg_besoins_hectare`)
  - grain : zone (nullable = dose nationale) × culture × `code_intrant` × `source_reference`, pour que les doses ISRA s'ajoutent sans écraser les références actuelles ; `portee_geographique` (`ZONE` / `NATIONAL`), `unite`, `date_reception` (nulle aujourd'hui), `note_source` (texte d'origine) ;
  - intrants : `PRODUIT` (NPK_15_15_15, UREE, DAP_18_46_0 en kg/ha, FUMIER en t/ha, SEMENCES en kg/ha), `ELEMENT` (N, P2O5, K2O en kg/ha), `EAU` (EAU_IRRIGATION en m³/ha, avec `besoin_eau_mm`) ;
  - **on n'additionne jamais des types ou des unités différents** (produits et éléments décrivent la même fertilisation) ; test garde-fou : un `code_intrant` = un seul type et une seule unité ;
  - **dose à 0 conservée** (produit absent de la formule, irrigation inutile en année normale : 0 = besoin nul) ; dose inconnue = aucune ligne (= dose à saisir, visible dans `mart_besoins` en B2) ;
  - correspondance des statuts validée (macros partagées `macros/statuts_doses.sql`) : Tounkara 2022 (Casamance × mil) et Faye 2020 (Vallée × riz, engrais et semis) → `A_CONFIRMER` ; mil extrapolé aux 5 autres zones, formule N120 P60 K60 (source web), semis riz hors Vallée → `NON_VERIFIEE` ; irrigation → `A_CONFIRMER` (« estimation calculée (FAO-56, efficience 60 %), non mesurée ») ; `VALIDEE` réservé aux doses validées par un spécialiste (aucune aujourd'hui, et toujours avec `date_reception`) ; « à compléter » → pas de ligne ;
  - volumes : 141 lignes = EAU 72 (A_CONFIRMER, dont 22 à 0) + ELEMENT 27 (6 A_CONFIRMER, 21 NON_VERIFIEE) + PRODUIT 42 (9 A_CONFIRMER, 33 NON_VERIFIEE) ; 35 doses à 0 ;
  - `besoin_irrigation_normal_mm` identique dans `stg_besoins_hectare` et `stg_facteurs_limitants` (72/72) ;
  - tests OK : génériques (dont `code_intrant` → `dim_intrant`), `tests/fact_reference_agronomique_valeurs_valides.sql` et `tests/fact_reference_agronomique_bilan_elements.sql` (pour chaque zone × culture × source : N = Σ produit × teneur N, idem P2O5 et K2O, à 0,1 kg près).
- **A5, étape 10** : `fact_besoin_reference` (depuis `int_reference_besoins_departement_culture`)
  - **besoins de référence historiques, pas prévisionnels** ; grain : département × culture, 367 lignes, 43 départements (**Guédiawaye et Pikine absents** : aucune superficie de référence) ;
  - colonnes : `superficie_reference_ha`, `annees_reference`, `type_superficie` (semée 350, récoltée 17), 8 besoins en t (N, P2O5, K2O, NPK, urée, DAP, fumier, semences), `besoin_semences_applicable`, `statut_validation_engrais` / `_semis` et `source_reference_engrais` / `_semis`, `coherence_dose_n`, `coherence_dose_semis` ;
  - statuts calculés par les macros `macros/statuts_doses.sql`, partagées avec `fact_reference_agronomique` (refonte sans changement de résultat) ; « densité documentée » (semis mil) → `A_COMPLETER` ;
  - besoin = superficie × dose de la zone / 1000, vérifié par rapport à `fact_reference_agronomique` (à 0,05 t) pour les 8 besoins ;
  - **règle NULL / 0, vérifiée et testée sur les 8 besoins** : dose inconnue (statut `A_COMPLETER`) → besoin **NULL**, jamais 0 ; dose à 0 → besoin à 0 ; superficie de référence à 0 → besoin à 0 (22 lignes) ;
  - `besoin_semences_applicable` (booléen) : faux pour « Riz (irrigué) » en Casamance (9 départements, 7 858 t), vrai ailleurs ; la valeur de `besoin_semences_t` n'est pas modifiée ; testé ;
  - `coherence_dose_*` : uniquement `COHERENT` ou `A_VERIFIER`, aucun `ECART` ;
  - `annees_reference` très hétérogène : 2019-2021 pour 279 lignes, mais jusqu'à 2003-2004 ;
  - exclus : doses et irrigation par hectare (références de zone recopiées sur chaque département ; jointure par zone vers `fact_reference_agronomique`) ;
  - riz : 38 départements avec besoin en semences, dont Casamance 7 858 t sur 10 929 t (dose de repiquage irrigué appliquée au riz surtout pluvial, voir section 4) ;
  - tests OK : 16 génériques et `tests/fact_besoin_reference_valeurs_valides.sql`. Après A5 : 174 tests OK.

### 3.5 Marts

- **A6, étape 11** : `mart_vulnerabilite_departement` (validé)
  - grain : département, 45 lignes ; codes lisibles, pas de clé md5 ; score **relatif et indicatif**, méthode `v1` ;
  - normalisation : rang centile 0-100 parmi les départements (ex aequo au rang moyen, macro `rang_centile` dans `macros/scores.sql`), 100 = le plus vulnérable ;
  - **aléa sécheresse (60 %)** = moyenne des rangs de `freq_alerte_secheresse_pct` (1991-2020), `variabilite_pluie_cv_pct` et `pluie_saison_annee_seche_mm` (sens inverse : moins de pluie = plus vulnérable). `proba_saison_seche_pct` remplacée (SPI relatif à chaque département, 7 valeurs seulement), affichée comme indicateur brut ;
  - **sensibilité des rendements (40 %)** = 0,7 × rang de `variabilite_rendement_pct` + 0,3 × rang inversé de `tendance_rendement_pct_an`, sur **1991-2015 seulement** (rupture superficie récoltée / semée en 2016), lignes avec `rendement_kg_ha is not null` (pas `est_observe`) pour les compteurs, la variabilité, la tendance et la pondération par la superficie moyenne, cultures avec au moins 10 campagnes ; `periode_rendement = '1991-2015'`. Alignement sur cette règle sans effet sur le classement (ρ = 1,00, top 10 identique ; 41 lignes sans rendement retirées des compteurs) ;
  - hors score, affichés : `freq_alerte_exces_pct` (seuil absolu, mesure surtout un climat humide), `proba_saison_seche_pct`, `proba_sequence_seche_15j_pct` (redondant avec les alertes, ρ = 0,91), `part_cultures_pct` (déjà pris en compte par le besoin dans AgroDistrib) ;
  - `confiance_rendement = 'faible'` si moins de 3 cultures ou moins de 15 campagnes observées au total (couples culture × campagne) : la sensibilité est alors NULL et ses indicateurs de rendement sont exclus du calcul des rangs des autres départements ; seul Dakar est concerné ;
  - score NULL si une dimension manque, jamais remplacé par 0 : Guédiawaye et Pikine (aucun rendement), Dakar (confiance faible) ; leur aléa sécheresse reste affiché ;
  - classes par quintiles calculés sur les 42 départements notés (9, 9, 8, 8, 8), libellées « (relatif) » ;
  - effet des décisions : ρ = 0,88 avec l'aperçu initial (0,92 pour la seule période 1991-2015) ; top 5 : Saint-Louis, Matam, Dagana, Rufisque, Kébémer ; bas : Kédougou, Salémata, Saraya, Kolda, Tambacounda ;
  - tests OK : 9 génériques et `tests/mart_vulnerabilite_valeurs_valides.sql` (recalcul du score, NULL, confiance faible, quintiles).

- **B1** : `mart_ml_prevision_pluie` (pour l'équipe ML, voir [`ml/README.md`](../ml/README.md))
  - grain : département × année, 2 025 lignes (45 × 1981-2025) ; codes lisibles, pas de clé md5 ;
  - variables connues fin mai seulement : `indice_oni_mars_mai`, `indice_tna_mars_mai`, `indice_tsa_mars_mai`, `indice_amo_mars_mai`, `pluie_saison_n_moins_1_mm`, `humidite_sol_avril_mai_m3_m3`, `pluie_normale_saison_mm`, plus `nb_variables_manquantes` ;
  - cibles `pluie_saison_mm` et `classe_saison` issues de `fact_saison_departement` (identiques à la table de prédicteurs : 0 écart) ;
  - `jeu` : `ENTRAINEMENT` (≤ 2015, 1 575 lignes) / `TEST` (2016-2025, 450 lignes) ; découpage temporel, jamais aléatoire ;
  - vérifié : indices océaniques identiques pour tous les départements d'une même année ; **AMO : dernière valeur en 2022, nulle de 2023 à 2025** (135 lignes) ; pluie N-1 = cible de l'année précédente, nulle seulement en 1981 ; normale identique au profil ;
  - humidité du sol nulle sur 282 lignes : 6 départements côtiers sur toute la période (Dakar, Guédiawaye, Pikine, Rufisque, Oussouye, Ziguinchor), Goudomp (4 années entre 1989 et 2003), 8 départements en 1986 ; les valeurs nulles restent nulles ;
  - la normale 1991-2020 chevauche le jeu de test (2016-2020) ; les variables de saison (connues après fin mai) sont volontairement absentes ;
  - tests OK : 8 génériques et `tests/mart_ml_prevision_pluie_valeurs_valides.sql` (grain, volume, découpage, indices par année, pluie N-1, variables obligatoires).

- **B2, marts par écran** (pour l'API et le front ; contrat détaillé dans [`contrat-donnees.md`](contrat-donnees.md)). Tous à plat, codes lisibles, sans clé md5 ; tests génériques dans `_marts.yml` et `tests/marts_ecrans_valeurs_valides.sql`.
  - `mart_carte_agroclimat` : département × campagne, 2 025 lignes ; variables de `fact_saison_departement`, normale du profil, `risque_saison` (règle à 4 valeurs : 943 normal, 629 excès, 363 sécheresse, 90 les deux), `score_vulnerabilite` et `classe_vulnerabilite` (un seul écran carte ; NULL pour Dakar, Guédiawaye, Pikine) ;
  - `mart_suivi_decadaire` : département × année × décade, 71 280 lignes (44 départements) ; observé, normale et écart côte à côte (décade et cumul), fourchette climatologique 1991-2020 du département, `libelle_decade` selon l'année ; `pluie_normale_mm` = moyenne 1991-2020 de `fact_climatologie_decadaire` (vérifié, 1 584/1 584) ;
  - `mart_choix_cultures` : département × culture × `type_option` (`CYCLE` / `VARIETE`) × option, 1 710 lignes (1 620 + 90), colonnes propres à un type NULL pour l'autre ; `rang_option` sur `proba_cycle_couvert_pct` (NULL pour le manioc et Sahel 177), `note_score` pour les cycles court et long ; unicité du grain testée ;
  - `mart_besoins` : département × culture depuis `dim_geographie`, 369 lignes (367 + Guédiawaye et Pikine avec « pas de superficie agricole de référence ») ; `besoin_semences_retenu_t` (riz pluvial de Casamance exclu, 9 lignes « non applicable (riz pluvial) »), `reference_anterieure_2015` (dernière année de référence < 2015 : 13 lignes), `irrigation_totale_m3` seulement si « irrigation requise » (41 lignes), libellés « dose à saisir » / « superficie de référence nulle » / « calculé » ;
  - `mart_territoires_agrodistrib` : département × culture avec superficie de référence > 0, 345 lignes (43 départements) ; `besoin_semences_applicable` et `besoin_semences_retenu_t` ; additifs : superficie et besoins ; non additifs : tout le reste. Potentiel de gain : valeurs de zone, `niveau_source_potentiel = 'ZONE'`, `potentiel_gain_kg_ha` NULL quand `est_rendement_national` (aucune ligne concernée aujourd'hui : les rendements nationaux recopiés portent sur des couples zone × culture sans superficie départementale) ; meilleur niveau d'adéquation, sol du département, recommandations de zone, vulnérabilité.
- **Précision validée sur la règle 9** : elle interdit de recopier une valeur de zone sur les départements **puis de l'additionner** (double comptage). Porter une valeur de zone comme attribut non additif servant à classer est autorisé (spécification AgroDistrib) ; ces colonnes ne distinguent pas les départements d'une même zone.
- **D, documentation** :
  - D1 : `dbt/README.md` réécrit (dimensions, faits, marts réellement construits, anciens marts supprimés) ; `README.md` (modules et marts) ; `docs/README-constellation.md` (hiérarchie corrigée : zone et région parallèles ; encadré d'état de mise en œuvre en tête : construit, non construit et pourquoi, faits ajoutés, marts par écran, anciens marts supprimés) ; coopératives retirées de `dataset/README.md` ; commentaire de `fact_saison_departement.sql` mis à jour ;
  - D2 : [`docs/contrat-donnees.md`](contrat-donnees.md) (7 marts : grain, colonnes, unités, limites, exemple de requête vérifié) ;
  - D3 : `dbt docs generate` fonctionne (catalogue et site générés dans `dbt/target/`).

### 3.6 Total

- Après B2 et D : 40 modèles actifs (16 staging, 1 intermediate, 7 dimensions, 9 faits, 7 marts), 1 seed, **221 tests, tous OK**.

---

## 4. Règles d'usage pour les marts et l'aval

### Saison ou décadaire

- Bilan d'une saison (total, démarrage, fin, séquences sèches, classe, alertes) : **`fact_saison_departement`**, toujours. C'est la source de référence.
- Suivi en cours de campagne, décade par décade (pluie de la décade, cumul depuis juin comparé à la normale) : **`fact_pluviometrie_decadaire`**.
- Ne pas recalculer le total de saison en sommant les décades : le cumul décadaire à fin octobre diffère de `pluie_saison_mm` (1 663 couples département × année sur 1 980 avec plus de 1 mm d'écart, écart moyen −2,4 mm, maximum 41 mm ; les deux mesures sont calculées différemment par la source).

### Marts par écran (B2)

- Construits sur les faits et dimensions, à plat, avec noms lisibles et codes (`code_departement`, région, zone), sans clé md5 exposée.
- **`mart_carte_agroclimat`** : `risque_saison` à construire. 90 saisons sur 2 025 portent les deux alertes à la fois, d'où la règle retenue :
  - `'sécheresse et excès de pluie'` si `alerte_secheresse` et `alerte_exces_pluie` ;
  - `'sécheresse'` si seulement `alerte_secheresse` ;
  - `'excès de pluie'` si seulement `alerte_exces_pluie` ;
  - `'normal'` sinon.
  Garder aussi `alerte_secheresse` et `alerte_exces_pluie` dans le mart. (L'ancien `mart_saisons` donnait la priorité à la sécheresse : règle abandonnée.)
- **`mart_choix_cultures`** : comparer les cycles sur `proba_cycle_couvert_pct`, pas sur le score, et signaler que le score des cycles court et long utilise la part « eau » du cycle moyen.
- **`mart_besoins`** :
  - partir de `dim_geographie` (45 départements) : Guédiawaye et Pikine apparaissent avec « pas de superficie agricole de référence » ;
  - exclure des totaux de semences les lignes `besoin_semences_applicable = false` et afficher « non applicable (riz pluvial) » ;
  - afficher `annees_reference` avec un indicateur « référence antérieure à 2015 » ;
  - irrigation totale (m³) = `superficie_reference_ha` × `volume_irrigation_m3_ha` (zone, `fact_reference_agronomique`), **uniquement** quand `niveau_adequation = 'irrigation requise'` (`fact_adequation_culture`), NULL sinon ;
  - dose inconnue → « dose à saisir » ; dose à 0 → besoin nul.
- **Riz** : « Riz (irrigué) » inclut le riz pluvial de Casamance. La dose de semis de 40 kg/ha (repiquage irrigué, Faye et al. 2020) ne s'applique pas au riz pluvial : ne pas l'utiliser pour calculer les besoins en semences du riz pluvial (Casamance), signaler « dose à saisir ». `fact_besoin_reference.besoin_semences_t` l'applique pourtant aux 9 départements de Casamance (7 858 t sur 10 929 t au niveau national) : les marts excluent ces lignes des totaux de semences et affichent « non applicable (riz pluvial) ».
- **Potentiel de gain** (B2 et AgroDistrib) : quand `est_rendement_national` est vrai (`fact_facteurs_limitants`), le potentiel de gain (écart atteignable − moyen) est « non évalué au niveau de la zone » et ne doit jamais servir à comparer ni classer les zones.

---

## 5. Prochaines étapes

12. Faits AgroDistrib (besoins prévisionnels, stocks, allocations), en attente des tables PostgreSQL :
    - `APP_ORGANISATIONS` (ONG, services de l'État ; associations de semenciers à confirmer) ;
    - `APP_INTRANTS` (une semence peut référencer une variété ; reprend les 9 `code_intrant` de `ref_intrants`) ;
    - `APP_STOCKS_INTRANTS` ;
    - `APP_SCENARIOS_ALLOCATION`, `APP_ALLOCATIONS_INTRANTS` ;
    - `APP_PLANS_CULTURAUX_DEPARTEMENT`, `APP_PLANS_CULTURAUX_PRODUCTEUR`.

    Besoins : deux faits distincts, un au niveau producteur et un au niveau département. Aucun niveau coopérative. `id_variete` nullable dans les besoins en semences, pour rapprocher l'offre des semenciers de la demande.

    **Répartition multi-niveaux.** Le décideur (ministère, ONG) saisit ses intrants : produit, quantité, campagne. Il choisit ensuite le **niveau de répartition** (zone agroécologique, région ou département) et ses critères (prorata des besoins, priorité à la vulnérabilité, plafonds…). Le modèle propose alors une quantité par territoire, selon la situation de chaque territoire.
    - Une exécution = un seul niveau. `fact_allocation_intrant` porte `niveau_destination` (`ZONE` / `REGION` / `DEPARTEMENT`) et la clé du territoire correspondant. Une seule clé est renseignée par ligne.
    - Les besoins et indicateurs des zones et des régions sont **agrégés** depuis le département (somme des besoins, jamais une valeur zonale recopiée sur les départements).
    - Un intrant est lié aux cultures auxquelles il s'applique. Seuls les territoires qui cultivent ces cultures reçoivent une part.
    - `dim_region` existe (A1) : utiliser `id_region` de `dim_geographie` pour agréger.
    - Zone et région ne sont pas emboîtées (voir section 3.2) : ne pas coder une hiérarchie zone → région.
    - **Critères du modèle**, calculés au niveau du département puis agrégés (le sol varie fortement à l'intérieur d'une même zone : pH de 5,6 à 7,0 dans le Bassin arachidier) :
      - besoin (superficie × dose) ;
      - potentiel de gain (écart entre rendement atteignable et rendement moyen) ;
      - capacité à valoriser l'intrant (adéquation climat et cycle, risque de saison sèche, facteur limitant principal) ;
      - contraintes de sol (pH, texture, réserve utile, carbone organique) ;
      - vulnérabilité (`mart_vulnerabilite_departement`, relatif et indicatif).
    - Le décideur règle l'arbitrage **rendement / équité** par des pondérations. L'allocation ne dépasse jamais le besoin. Le gain de rendement est une **estimation indicative** : aucune donnée de réponse aux engrais par territoire n'est disponible (à valider avec l'ISRA).
13. `fact_prevision_saisonniere` (département × campagne × version de modèle) quand le modèle ML existera. Ne jamais la mélanger avec `fact_saison_departement`.
14. Potentiel de gain par département (option b, avec l'ISRA) : calculer un rendement atteignable par département depuis `fact_rendement_departement` (ex. 90e centile 1991-2015) pour distinguer les départements d'une même zone ; aujourd'hui, le potentiel est une valeur de zone (`niveau_source_potentiel = 'ZONE'`).

Plan restant de la passation : **C1 à C3, plateforme Snowflake**. Le schéma `SALTIS.ML` (créé le 11/11/2026), le rôle `R_ML` et l'utilisateur `USER_ML` (lecture `MARTS`, écriture `ML`) ont été créés par Ibrahima. Restent : le schéma `SALTIS.APP` (absent au 11/11/2026), l'accès de l'API, le DDL de `SALTIS.APP`, puis la déclaration de ces tables comme sources dbt et le réalignement de `stg_organisations` et `stg_intrants`.

---

## 6. Données ISRA (engrais), à intégrer à réception

- Usage : AgroDistrib et calcul des besoins uniquement. **Jamais dans `fact_rendement_departement`.**
- Circuit prévu :

```
RAW.ISRA_DOSES_ENGRAIS
  → stg_isra_doses_engrais
    → int_reference_dose_engrais    (union références actuelles + ISRA, règle de priorité)
      → fact_reference_agronomique
        → fact_besoin_intrant
```

- Une ligne par dose et par source : une dose ISRA n'écrase jamais une référence existante. On conserve la source, l'unité, le statut de validation et la date de réception.
- Priorité de la dose retenue :
  1. ISRA validée propre à la zone ;
  2. ISRA validée nationale ;
  3. ISRA à confirmer ;
  4. références actuelles (Tounkara 2022, Faye 2020).
- Zone nullable : une dose nationale s'applique aux zones qui n'ont pas de dose propre, sans être recopiée sur chaque département.

---

## 7. Scripts Snowflake à exécuter par l'équipe

Les scripts du dossier `snowflake/` sont écrits par l'équipe données et **exécutés à la main** par un membre de l'équipe.

- `snowflake/00_drop_anciens_marts.sql` : suppression des 8 anciens `MART_*` de `SALTIS.MARTS` (à lancer avant B2, car `mart_besoins` sera recréé). Restes d'un ancien build (2026-11-08) : `SALTIS.ANALYTICS_MARTS` (3 tables `MART_*`) et `SALTIS.ANALYTICS_STAGING` (3 vues `STG_*`) ; leurs `drop` (y compris `drop schema`) sont commentés en fin de script, après les commandes `show` de vérification.
- `snowflake/10_geo_departements.sql` : création de `RAW.GEO_DEPARTEMENTS` pour les contours GADM 4.1 niveau 2, puis activer `geo_departements_charge` dans `dbt_project.yml`. Le front attend un GeoJSON simplifié du même fichier.

---

## 8. Points ouverts

### À signaler

- `api/` appartient à Anthony : l'équipe données n'y modifie rien. L'endpoint `/saisons` de `api/main.py` lit `marts_marts.mart_saisons`, supprimé en T0. Il devra être rebranché sur `mart_carte_agroclimat` après B2.
- Contours GADM 4.1 niveau 2 : récupérés par l'équipe, à charger avec `snowflake/10_geo_departements.sql` (section 7).
- **Marts reconstruits depuis une version ancienne du code** : le 11/11/2026 vers 02:51 UTC, `SALTIS.MARTS` a été reconstruit sans la colonne `besoin_semences_applicable` de `mart_territoires_agrodistrib`, pourtant présente dans le commit `c109ae1`. Reconstruit depuis `dev/aby` le 11/11/2026 (262 nœuds, 0 erreur). Tant que la construction n'est pas faite depuis une seule branche, chaque `dbt build` lancé depuis une autre copie du dépôt écrase `SALTIS.MARTS` : convenir de qui construit, et depuis quelle branche.
### Questions pour l'ISRA

- Arachide : confirmer la dose « 150 kg/ha de 6-20-10 », citée seulement dans le texte du statut (`note_source`), sans dose chiffrée.
- Mil : poids de semences par hectare (seule la densité est documentée : 5 graines par poquet à 80 × 80 cm, démariage à 3 plants).
- Plus largement : doses validées par zone pour toutes les cultures « à compléter » (voir section 6).

### À signaler au producteur du dataset

- Adéquation des cultures : la probabilité « eau » des cycles court et long reprend celle du cycle moyen ; à recalculer. Rien n'est corrigé dans dbt.
- Besoins de référence : `annees_reference` très hétérogène (2019-2021 pour 279 lignes, mais jusqu'à 2003-2004 ou 2004-2008) ; mettre à jour les superficies de référence anciennes (antérieures à 2015).
- Rendements et besoins : « Riz (irrigué) » regroupe aussi le riz pluvial de Casamance ; la dose de semis de 40 kg/ha (repiquage irrigué) ne vaut pas pour le riz pluvial. À séparer quand les données le permettront.
- Facteurs limitants, Vallée du fleuve Sénégal × Sésame : rendement atteignable (723,88) inférieur au rendement moyen (750), écart −26,12 kg/ha.
- Facteurs limitants, Niayes : `correlation_chaleur` absente pour arachide, maïs, mil (souna), niébé et sorgho, alors que les trois autres corrélations sont calculées.
- Prédicteurs saisonniers (priorité basse) : `humidite_sol_avril_mai_m3_m3` manque ponctuellement sur 12 valeurs, en plus des 6 départements côtiers absents sur toute la période : Goudomp (4 années entre 1989 et 2003) et 8 départements en 1986 (Bambey, Diourbel, Fatick, Foundiougne, Mbour, Saint-Louis, Thiès, Tivaouane).

### À confirmer

- **Vulnérabilité, validation par les techniciens** :
  - la Vallée du fleuve est en tête alors qu'une grande partie de son agriculture est irriguée : l'aléa pluvial peut y surestimer la vulnérabilité ;
  - Saint-Louis (1er) et Rufisque (4e) sont des départements en partie urbains.

---

## 9. Points de vigilance sur les données

- Le mil ressort « déconseillé » dans le nord alors qu'il y est cultivé : calibration à faire avec les techniciens.
- La variété « Mil sanio (type tardif) » est rattachée à la culture « Mil (souna) », qui est en réalité le libellé générique du mil chez DAPSA.
- Rendements : superficie récoltée jusqu'en 2015, superficie semée ensuite (`type_superficie`). Pour agréger le rendement, calculer `sum(production) / sum(superficie)`, jamais la moyenne des rendements. Les indicateurs de tendance et de variabilité s'arrêtent à 2015 pour éviter cette rupture.
- NDVI disponible à partir de 2000 seulement.
