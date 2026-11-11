# Données par module — plateforme Assaman & Suuf

Ce dossier contient les tables prêtes à l'emploi pour les **quatre modules** de la plateforme. Elles sont tirées du dataset consolidé (`datafr/`, voir son README pour le détail des sources et des calculs) et des référentiels (`data/raw/referentiels/`), puis organisées selon les questions de chaque module.

Toutes les tables sont produites par la même commande que `datafr/` :

```bash
cd ingestion
python -m construction        # écrit datafr/ puis data_fr_bis/
```

Le préfixe du nom de fichier donne le module : `a_` suivi agroclimatique, `b_` choix des cultures, `c_` besoins et rendements, `d_` AgroDistrib.

## Vue d'ensemble

| Module | Table | Une ligne = | Utilisateurs principaux |
|---|---|---|---|
| a) Suivi et anticipation agroclimatique | `a_saisons_departement.csv` | département × saison (1981–2025) | services techniques, institutions, ONG |
| | `a_profil_agroclimatique_departement.csv` | département | tous |
| | `a_repartition_pluie_zone_decade.csv` | zone × décade | producteurs, techniciens |
| | `a_repartition_pluie_departement_decade.csv` | département × décade | idem |
| | `a_suivi_pluie_decade.csv` | département × année × décade | techniciens, institutions |
| | `a_predicteurs_saisonniers.csv` | département × saison | équipe data (modèle de prévision) |
| b) Choix des cultures et des variétés | `b_adequation_culture_departement.csv` | département × culture × durée de cycle | producteurs, techniciens |
| | `b_referentiel_varietes.csv` | variété (3 documentées, **à compléter**) | associations de semenciers, ISRA |
| | `b_adequation_variete_departement.csv` | département × variété | producteurs, semenciers |
| c) Besoins et rendements | `c_rendements_departement.csv` | département × campagne × culture | institutions, techniciens, équipe data |
| | `c_facteurs_limitants_zone_culture.csv` | zone × culture | techniciens, ONG |
| | `c_besoins_par_hectare.csv` | zone × culture | producteurs, techniciens |
| | `c_besoins_departement_culture.csv` | département × culture | institutions, ONG |
| d) AgroDistrib | `d_besoins_consolides_departement.csv` | département | institutions, ONG |
| | `d_stocks_disponibles.csv` | stock (**à remplir**) | institutions, ONG |
| | `d_scenarios_repartition.csv` | département × scénario | institutions |

Colonnes d'identification communes : `code_departement` (identifiant GADM, ex. `SEN.10.1_1`), `departement`, `region`, `zone_agroecologique` (6 zones). Une **décade** est une période de 10 jours (1–10, 11–20, 21–fin du mois) ; la saison des pluies va de la décade 16 (1er–10 juin) à la décade 30 (21–31 octobre). Les **normales** et probabilités sont calculées sur 1991–2020.

## État des données : ce qui est prêt et ce qui manque

| Besoin de la plateforme | État | Ce qui manque |
|---|---|---|
| Quantité, durée et répartition des pluies, sécheresses, excès | ✅ complet, 1981–2025, 45 départements | — |
| Prévisions saisonnières | ⚠️ variables prêtes, pas encore de modèle | entraîner un modèle sur `a_predicteurs_saisonniers.csv` |
| Adéquation des cultures (cycle, eau) | ✅ par culture et durée de cycle | — |
| Variétés de semences (cycle, tolérance à la sécheresse) | ⚠️ 3 variétés documentées (riz Sahel 177, mil sanio, mil souna) | catalogue officiel des variétés (DISEM / ISRA) |
| Rendements et facteurs limitants | ✅ par département 1960–2021 (DAPSA via HarvestStat et FEWS NET) | campagnes après 2021 (DAPSA) |
| Doses d'engrais | ⚠️ mil (toutes zones), riz irrigué de la vallée (documentés), maïs et sorgho de la vallée (non vérifiés) | arachide, niébé, sésame, coton, maraîchage… : fiches ISRA / ANCAR |
| Doses de semis | ⚠️ riz irrigué seulement (40 kg/ha) | fiches ISRA / ANCAR, DISEM |
| Stocks d'intrants | ❌ modèle de table vide | organisations (ONG, services de l'État) |

Les calculs sont déjà écrits : dès qu'un référentiel manquant est rempli, relancer `python -m construction` met à jour toutes les tables qui en dépendent.

---

## a) Suivi et anticipation agroclimatique

### `a_saisons_departement.csv` — bilan de chaque saison

| Colonne | Description | Unité |
|---|---|---|
| `annee` | saison des pluies | — |
| `pluie_saison_mm`, `pluie_normale_saison_mm`, `anomalie_pluie_saison_pct` | cumul juin–octobre, normale, écart à la normale | mm, mm, % |
| `spi_saison` | indice standardisé de précipitations (< −1 : sécheresse) | sans unité |
| `classe_saison` | `très sèche` (SPI ≤ −1,5), `sèche` (≤ −0,5), `normale`, `humide` (≥ 0,5), `très humide` (≥ 1,5) | texte |
| `debut_saison_jour`, `retard_debut_saison_j`, `fin_saison_jour`, `duree_saison_j` | démarrage (jour de l'année), retard par rapport à la normale, fin, durée | jours |
| `nb_jours_pluie`, `nb_jours_pluie_forte`, `pluie_max_journaliere_mm` | jours ≥ 1 mm, jours ≥ 20 mm, plus forte pluie d'un jour | jours, mm |
| `plus_longue_sequence_seche_j`, `nb_sequences_seches_7j` | plus longue pause sèche dans la saison, nombre de pauses de plus de 7 jours | jours, nombre |
| `nb_decades_seches`, `nb_decades_tres_pluvieuses` | décades de la saison à moins de 10 mm / à plus de 100 mm | nombre |
| `pluie_juin_juillet_mm` | pluie du début de saison (connue fin juillet, utile pour le suivi) | mm |
| `temp_max_moy_saison_c`, `nb_jours_tmax_sup_40` | chaleur de la saison | °C, jours |
| `et0_saison_mm`, `humidite_sol_surface_m3_m3`, `ndvi_max_saison_zc`, `anomalie_ndvi_pct` | demande en eau de l'air, humidité du sol (juillet–septembre), vigueur de la végétation cultivée | mm, m³/m³, 0–1, % |
| `alerte_secheresse` | `True` si SPI ≤ −1 ou pause sèche d'au moins 15 jours | booléen |
| `alerte_exces_pluie` | `True` si SPI ≥ 1,5 ou au moins 2 décades à plus de 100 mm | booléen |
| `source_calendrier` | `CHIRPS journalier` ou `NASA POWER` (secours) | texte |

### `a_profil_agroclimatique_departement.csv` — à quoi s'attendre habituellement

Une ligne par département (1991–2020) : `pluie_saison_normale_mm`, `variabilite_pluie_cv_pct` (variation d'une année à l'autre), `pluie_saison_annee_seche_mm` (1 année sur 5), `proba_saison_seche_pct`, `debut_saison_moyen_jour` avec `debut_saison_precoce_jour` et `debut_saison_tardif_jour` (1 année sur 5 plus tôt / plus tard), `fin_saison_moyenne_jour`, `duree_saison_moyenne_j` et `duree_saison_courte_j` (1 année sur 5), `nb_sequences_seches_7j_moyen`, `proba_sequence_seche_15j_pct`, `proba_exces_pluie_pct`, `et0_saison_normale_mm`, et le sol (`classe_texture`, `reserve_utile_mm`, `ph_eau`, `carbone_organique_g_kg`), `part_cultures_pct`, `superficie_km2`.

### `a_repartition_pluie_zone_decade.csv` et `a_repartition_pluie_departement_decade.csv` — comment la pluie se répartit

C'est la réponse à « pour cette zone, on attend 700 mm : combien dans les premières semaines, et les pluies seront-elles séparées ? ». Une ligne par zone (ou département) et par décade. Colonnes détaillées dans `datafr/README.md`, partie 5 bis ; les principales sont :

| Colonne | Description |
|---|---|
| `periode` | libellé de la décade (ex. « 11-20 aout ») |
| `pluie_moyenne_mm`, `pluie_1_annee_sur_5_mm`, `pluie_4_annees_sur_5_mm` | pluie habituelle et fourchette (4 années sur 5 entre les deux) |
| `part_saison_pct`, `part_cumulee_saison_pct` | part du total juin–octobre tombée dans la décade, et déjà tombée à sa fin |
| `part_saison_annees_seches_pct`, `part_saison_annees_humides_pct` | même part en année sèche / humide |
| `proba_decade_seche_pct`, `proba_sequence_seche_7j_pct` | risque de décade sèche (< 10 mm) et de pause d'au moins 7 jours : **pluies séparées** |
| `proba_decade_tres_pluvieuse_pct` | risque de décade à plus de 100 mm : **excès** |

**Exemple** : si l'on prévoit 700 mm pour la saison dans une zone, la pluie attendue dans une décade vaut environ `700 × part_saison_pct / 100`. Si la saison s'annonce sèche ou humide, prendre plutôt `part_saison_annees_seches_pct` ou `part_saison_annees_humides_pct`.

### `a_suivi_pluie_decade.csv` — suivi de la saison en cours

La pluie observée décade par décade (1981–2025), avec le cumul depuis le 1er juin et l'écart à la normale. 44 départements : Guédiawaye, dont tous les pixels CHIRPS sont en mer, n'y figure pas. Pour suivre une saison, comparer `cumul_depuis_juin_mm` au `cumul_moyen_depuis_juin_mm` de la climatologie.

### `a_predicteurs_saisonniers.csv` — pour le futur modèle de prévision

Une ligne par département et saison. **Cible** : `pluie_saison_mm` et `classe_saison`. **Variables connues fin mai**, donc utilisables pour une prévision avant la saison :

| Colonne | Description |
|---|---|
| `indice_oni_mars_mai`, `indice_tna_mars_mai`, `indice_tsa_mars_mai`, `indice_amo_mars_mai` | moyennes mars–mai des indices océaniques (El Niño, Atlantique tropical nord et sud, AMO : dernière valeur en 2022, absente de 2023 à 2025) |
| `pluie_saison_n_moins_1_mm` | cumul de la saison précédente |
| `humidite_sol_avril_mai_m3_m3` | humidité du sol avant la saison (ESA CCI) |
| `pluie_normale_saison_mm` | normale du département |

Entraîner sur ≤ 2015 et tester sur 2016–2025, sans mélange au hasard des années (voir `datafr/README.md`, partie 7.3).

---

## b) Aide au choix des cultures et des variétés

### `b_adequation_culture_departement.csv`

Une ligne par département, culture et **durée de cycle** : `courte`, `moyenne` et `longue` correspondent au bas, au milieu et au haut de la fourchette de cycle de la culture (ex. mil 85, 90 et 95 jours). Faute de catalogue des variétés, ces trois classes représentent des variétés précoces, intermédiaires et tardives.

| Colonne | Description | Unité |
|---|---|---|
| `culture`, `classe_cycle`, `cycle_jours` | culture et durée de cycle testée | —, —, jours |
| `proba_cycle_couvert_pct` | part des années 1991–2020 où l'eau disponible a duré au moins `cycle_jours` : durée de la saison des pluies + jours couverts par la réserve du sol (`reserve_utile_mm` / 4 mm consommés par jour en fin de cycle) | % |
| `besoin_eau_estime_mm` | besoin en eau de la culture sur son cycle (FAO-56, au prorata de la durée) | mm |
| `proba_besoin_eau_couvert_pct` | part des années où la pluie efficace couvre au moins 80 % du besoin (cycle moyen seulement) | % |
| `rendement_moyen_kg_ha`, `variabilite_rendement_cv_pct` | rendement des 15 dernières campagnes du département et sa variation d'une année à l'autre | kg/ha, % |
| `score_adequation` | 0,6 × `proba_cycle_couvert_pct` + 0,4 × `proba_besoin_eau_couvert_pct` | 0–100 |
| `niveau_adequation` | sur le score arrondi : `adaptée` (> 80), `à risque` (> 50 et ≤ 80), `déconseillée` (≤ 50), `irrigation requise` ou `non évaluée (culture pluriannuelle)` | texte |
| `classe_texture`, `ph_eau`, `reserve_utile_mm` | sol du département | —, pH, mm |

**À savoir** :
- Le score est **indicatif** : il ne prend en compte que la durée de la saison et l'eau, pas encore la tolérance au sol ou aux maladies. Il est à valider avec les techniciens.
- **Riz irrigué, oignon et tomate** sont marqués `irrigation requise` sans score : leur faisabilité dépend de l'accès à l'eau d'irrigation, pas de la saison des pluies. Le riz pluvial de Casamance figure dans les statistiques sous « Riz (irrigué) » : à séparer quand les données le permettront.
- **Manioc** : cycle de 9 à 12 mois, `non évaluée`, car la durée de la saison des pluies n'est pas le bon critère.
- **Contrôle de cohérence** : le coton ressort `adaptée` à Kédougou, Salémata, Vélingara et Saraya, sa zone de culture réelle. En revanche, le mil ressort `déconseillée` dans le nord (Louga, Linguère, Podor, Matam…), où il est pourtant cultivé. La saison y est très courte selon la définition stricte du démarrage (AGRHYMET), et les variétés locales y sont souvent plus précoces que la fourchette du référentiel. À calibrer avec les techniciens et le catalogue des variétés.

### `b_referentiel_varietes.csv` — à remplir

Colonnes : `culture`, `variete`, `obtenteur`, `annee_homologation`, `cycle_jours`, `classe_cycle`, `tolerance_secheresse`, `besoin_eau_mm`, `rendement_potentiel_kg_ha`, `zones_recommandees`, `pluie_min_mm`, `pluie_max_mm`, `tolerance_salinite`, `disponibilite_semences`, `caracteristiques`, `source`.

Trois variétés documentées, chacune avec sa source :

| Variété | Culture | Cycle | Ce que dit la source |
|---|---|---|---|
| Sahel 177 | riz irrigué | 122 jours | AfricaRice, homologuée en 2009 ; potentiel de 10 t/ha ; aromatique, tolérante aux insectes, résistante à la verse (Faye et al., 2020) |
| Mil sanio | mil, type tardif (variété locale) | 120 à 150 jours (135 retenu) | généralement photopériodique ; cultivé en Casamance et au Sénégal oriental (Tounkara et al., 2022) |
| Mil souna | mil, type hâtif (variété locale) | non précisé | généralement non photopériodique ; cultivé sur presque tout le territoire (Tounkara et al., 2022) |

**Pour ajouter des variétés** : les saisir dans `VARIETES` (`collecte/territoire.py`), à partir du catalogue officiel des espèces et variétés (DISEM, ISRA) et avec les associations de producteurs de semences, puis lancer `python -m collecte referentiels` et `python -m construction`. Ne pas modifier `data/raw/referentiels/varietes.csv` à la main : il est réécrit à chaque génération des référentiels.

### `b_adequation_variete_departement.csv`

Une ligne par variété au cycle connu et par département : `variete`, `culture`, `cycle_jours`, `zones_recommandees` (selon la source), `proba_cycle_couvert_pct` (part des années 1991–2020 où la saison des pluies, plus la réserve du sol, a duré au moins le cycle de la variété) et `niveau_adequation` (`adaptée` ≥ 80 %, `à risque` 50–80 %, `déconseillée` < 50 %, `irrigation requise` pour le riz irrigué).

**Contrôle de cohérence** : le mil sanio ressort `adaptée` à Kédougou, Vélingara, Salémata, Saraya, Kolda, Tambacounda et Ziguinchor, c'est-à-dire en Casamance et au Sénégal oriental, là où la source indique qu'il est cultivé.

---

## c) Estimation des besoins et analyse des rendements

### `c_rendements_departement.csv`

Une ligne par département, campagne et culture : `superficie_recoltee_ha` (superficie **semée** après 2015, voir `type_superficie`), `production_t`, `rendement_kg_ha`, `source_rendement`, `tendance_rendement_kg_ha`, `anomalie_rendement_pct`, `rendement_national_kg_ha`, et les principaux facteurs de l'année (`pluie_saison_mm`, `spi_saison`, `retard_debut_saison_j`, `plus_longue_sequence_seche_j`, `indice_satisfaction_eau_pct`, `deficit_hydrique_mm`, `nb_jours_tmax_sup_40`, `ndvi_max_saison_zc`, `engrais_total_kg_ha`).

### `c_facteurs_limitants_zone_culture.csv`

Une ligne par zone et culture :
- `rendement_moyen_kg_ha`, `rendement_atteignable_kg_ha` (bonnes années) et `ecart_rendement_kg_ha` (marge de progrès) ;
- `facteur_limitant_principal` ;
- la **corrélation de rang** entre l'anomalie de rendement et chaque facteur : `correlation_eau`, `correlation_sequence_seche`, `correlation_chaleur`, `correlation_demarrage_tardif`. Plus la valeur est négative, plus ce facteur pèse sur les mauvaises années ;
- `nb_observations` ;
- les recommandations de sol (`apport_organique_recommande`, `amendement_ph_recommande`, `fractionnement_azote_recommande`).

### `c_besoins_par_hectare.csv`

Une ligne par zone et culture :
- **produits à apporter**, tels que donnés par la source : `npk_15_15_15_kg_ha`, `uree_kg_ha`, `dap_kg_ha` (DAP 18-46-0) et `fumier_t_ha`. Quand la source ne donne qu'une formule N-P-K (maïs et sorgho de la vallée), les produits sont calculés : NPK 15-15-15 pour le plus petit besoin entre phosphore et potasse, urée pour le reste d'azote ;
- les éléments fertilisants correspondants (`dose_n_recommandee_kg_ha`, `dose_p2o5_recommandee_kg_ha`, `dose_k2o_recommandee_kg_ha`), la `formule_engrais_recommandee`, le `statut_dose` et l'`origine_dose` (document source) ;
- dose de semis (`dose_semis_kg_ha`, `statut_dose_semis`, `origine_dose_semis`) ;
- irrigation (`besoin_irrigation_normal_mm`, `volume_irrigation_m3_ha`, efficience de 60 %).

### `c_besoins_departement_culture.csv`

Une ligne par département et culture : `superficie_reference_ha` (moyenne des 3 dernières campagnes connues, voir `annees_reference`) × doses = `besoin_azote_n_t`, `besoin_phosphate_p2o5_t`, `besoin_potasse_k2o_t`, `besoin_npk_15_15_15_t`, `besoin_uree_t`, `besoin_semences_t`. Pour estimer les besoins d'une exploitation, remplacer la superficie de référence par la superficie déclarée.

---

## d) Optimisation de la distribution des intrants — AgroDistrib

### `d_besoins_consolides_departement.csv`

Une ligne par département :
- somme des besoins de toutes les cultures : `besoin_*_t`, `superficie_totale_ha` ;
- `superficie_avec_dose_ha` et `part_superficie_avec_dose_pct`, la part de la superficie pour laquelle une dose est connue ;
- `cultures_avec_dose` ;
- `part_besoin_national_npk_15_15_15_pct` et `part_besoin_national_uree_pct`, le poids du département dans le besoin national.

> ⚠️ **Besoins partiels** : ils ne comptent que les cultures qui ont une dose (aujourd'hui le mil partout, et le maïs, le riz et le sorgho dans la vallée). `part_superficie_avec_dose_pct` indique la part couverte : environ 35 à 55 % dans le Bassin arachidier. Les besoins augmenteront quand les doses de l'arachide, du niébé, etc. seront saisies.
>
> **Fumier** : `besoin_fumier_t` suit la recommandation de la recherche pour le mil (10 t/ha), soit près de 10 millions de tonnes au niveau national. C'est un ordre de grandeur théorique, sans rapport avec le fumier réellement disponible ; il sert surtout à montrer l'écart entre recommandation et pratique.

### `d_stocks_disponibles.csv` — à remplir

Modèle vide : `code_departement`, `departement`, `produit` (ex. `uree`, `npk_15_15_15`, `semences_mil`), `stock_t`, `date_inventaire`, `lieu_stockage`, `source`. À remplir avec les organisations (ONG, services de l'État), puis à enregistrer sous `data/raw/referentiels/stocks_intrants.csv`.

### `d_scenarios_repartition.csv`

Une ligne par département et scénario : `quantite_disponible_nationale_t`, `besoin_t`, `allocation_t`, `taux_couverture_pct` et `deficit_t`. Le scénario actuel répartit l'urée **au prorata des besoins**, sans dépasser le besoin d'un département.

> Sans stocks saisis, la quantité disponible est une **hypothèse de démonstration** : l'azote réellement utilisé au Sénégal la dernière année connue (FAOSTAT), converti en urée. Comme les besoins sont encore partiels, ce scénario couvre aujourd'hui 100 % des besoins calculés : il illustre le calcul, pas la situation réelle. D'autres règles (priorité aux zones vulnérables, contraintes de transport) pourront être ajoutées comme scénarios supplémentaires.

---

## Limites communes

- **Échelle** : département. Les besoins d'une exploitation se calculent avec les tables par hectare (`c_besoins_par_hectare.csv`).
- **Références agronomiques** : doses d'engrais, doses de semis et variétés encore partielles. Les valeurs documentées viennent de deux articles, gardés dans `ingestion/` :
  - Tounkara et al. (2022), *Revue Africaine d'Environnement et d'Agriculture* 5(3) : mil sanio en Basse Casamance (dose de la recherche, densité de semis) ;
  - Faye et al. (2020), *European Scientific Journal* 16(13) : riz irrigué à Matam (pratique vulgarisée, dose de semis, variété Sahel 177).

  Ce sont des essais locaux. La dose du mil, établie pour le mil sanio de Basse Casamance, est appliquée faute de mieux aux autres zones et reste à confirmer pour le mil souna. Les tables sont structurées pour recevoir le reste des références, à faire valider par l'ISRA et l'ANCAR.
- **Rendements** : statistiques DAPSA jusqu'en 2021, superficie semée (et non récoltée) après 2015.
- **Prévision saisonnière** : les variables sont prêtes, le modèle reste à construire. En attendant, la plateforme peut s'appuyer sur la climatologie (probabilités 1991–2020) et sur les prévisions publiées chaque année (PRESASS d'AGRHYMET, ANACIM).
