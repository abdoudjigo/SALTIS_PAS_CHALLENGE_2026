# Contrat de données — marts SALTIS (API et front)

Référence pour l'API et le front : ce que chaque mart contient, à quel grain, avec quelles unités et quelles limites. Les marts sont construits par dbt dans **`SALTIS.MARTS`** (tables). Ils sont à plat, avec des noms lisibles et des codes ; **aucune clé technique md5 n'est exposée**.

- Décisions, règles et état d'avancement : [`etat-modelisation.md`](etat-modelisation.md).
- Données pour les modèles ML : [`../ml/README.md`](../ml/README.md).

## Conventions communes

| Élément | Règle |
|---|---|
| Territoire | Chaque mart commence par `code_departement` (code GADM, ex. `SEN.10.1_1`), `departement`, `code_region` (ex. `SEN.10_1`), `region`, `zone_agroecologique` (en majuscules). |
| Région et zone | Deux regroupements **parallèles** des départements, pas une hiérarchie (Louga, Matam et Tambacounda couvrent deux zones). Agréger par l'un ou l'autre, jamais zone → région. |
| Valeurs manquantes | `NULL` veut dire « inconnu ou non applicable », **jamais 0**. Un 0 est une vraie valeur (ex. besoin nul). Ne jamais remplacer un NULL par 0 côté API ou front. |
| Additivité | Seuls les quantités (superficies, besoins en t, volumes en m³) s'additionnent. Les moyennes, probabilités, scores, rangs, quantiles et valeurs de zone ne s'additionnent jamais. |
| Unités | Dans le nom de la colonne : `_mm`, `_pct` (0-100), `_kg_ha`, `_t`, `_ha`, `_m3`, `_m3_ha`, `_j` (jours), `_jour` (jour de l'année, 1 à 366), `_c` (°C). |
| Temps | `campagne_agricole` : année de la campagne (juin N à mai N+1 rattachés à N). `numero_decade_annee` : 1 à 36 (16 = 1-10 juin, 30 = 21-31 octobre ; saison des pluies = décades 16 à 30). |
| Coordonnées | `latitude` / `longitude` et contours viendront de GADM 4.1 (licence non commerciale, citation obligatoire) ; pas encore disponibles. |

## Vue d'ensemble

| Mart | Écran / usage | Grain | Lignes |
|---|---|---|---|
| `MART_CARTE_AGROCLIMAT` | Carte agroclimatique (module A) | département × campagne | 2 025 |
| `MART_SUIVI_DECADAIRE` | Suivi décade par décade (module A) | département × année × décade | 71 280 |
| `MART_CHOIX_CULTURES` | Choix des cultures et variétés (module B) | département × culture × type d'option × option | 1 710 |
| `MART_BESOINS` | Besoins en intrants (module C) | département × culture | 369 |
| `MART_TERRITOIRES_AGRODISTRIB` | Critères de répartition (module D) | département × culture cultivée | 345 |
| `MART_VULNERABILITE_DEPARTEMENT` | Détail de la vulnérabilité | département | 45 |
| `MART_ML_PREVISION_PLUIE` | Jeu de données ML (équipe ML) | département × année | 2 025 |

---

## 1. `MART_CARTE_AGROCLIMAT`

**Grain** : un département, une campagne (1981-2025), 45 × 45 = 2 025 lignes. Source de référence : `fact_saison_departement`.

| Colonne | Unité | Description |
|---|---|---|
| `campagne_agricole` | année | Campagne |
| `pluie_saison_mm` | mm | Cumul juin-octobre |
| `pluie_saison_normale_mm` | mm | Normale 1991-2020 du département |
| `anomalie_pluie_saison_pct` | % | Écart à la normale |
| `spi_saison` | sans unité | Indice standardisé de précipitations |
| `classe_saison` | texte | `très sèche`, `sèche`, `normale`, `humide`, `très humide` (SPI, relatif au département) |
| `debut_saison_jour`, `fin_saison_jour` | jour de l'année | Démarrage et fin de saison |
| `retard_debut_saison_j`, `duree_saison_j` | jours | Retard du démarrage, durée |
| `nb_jours_pluie`, `plus_longue_sequence_seche_j`, `nb_sequences_seches_7j`, `nb_decades_seches` | nombre / jours | Répartition des pluies |
| `temp_max_moy_saison_c`, `nb_jours_tmax_sup_40` | °C / jours | Chaleur |
| `ndvi_max_saison_zc`, `anomalie_ndvi_pct` | indice / % | Végétation (**à partir de 2000**) |
| `alerte_secheresse`, `alerte_exces_pluie` | booléen | Alertes de la source |
| `risque_saison` | texte | `sécheresse et excès de pluie`, `sécheresse`, `excès de pluie`, `normal` |
| `score_vulnerabilite`, `classe_vulnerabilite` | 0-100 / texte | Vulnérabilité **relative** du département (même valeur pour toutes les campagnes ; détail dans le mart dédié) |
| `source_calendrier` | texte | `CHIRPS journalier` ou `NASA POWER` (Guédiawaye) |

**Limites** : NDVI nul avant 2000 ; vulnérabilité NULL pour Dakar, Guédiawaye et Pikine ; `classe_saison` est relative à chaque département (une « saison sèche » à Ziguinchor reste plus arrosée qu'une saison normale à Podor).

```sql
-- Carte d'une campagne
select code_departement, departement, pluie_saison_mm, anomalie_pluie_saison_pct, risque_saison, classe_vulnerabilite
from SALTIS.MARTS.MART_CARTE_AGROCLIMAT
where campagne_agricole = 2024;
```

---

## 2. `MART_SUIVI_DECADAIRE`

**Grain** : un département, une année civile, une décade (1 à 36) ; 44 départements × 1981-2025 × 36 = 71 280 lignes. **Guédiawaye absent.**

| Colonne | Unité | Description |
|---|---|---|
| `annee`, `campagne_agricole` | année | Année civile, campagne (janvier-mai rattachés à N-1) |
| `numero_decade_annee`, `libelle_decade` | 1-36 / texte | Décade (ex. `11-20 aout`) |
| `est_decade_saison` | booléen | Décades 16 à 30 |
| `pluie_mm`, `pluie_normale_mm`, `ecart_pluie_mm` | mm | Observé, normale 1991-2020 (moyenne), observé − normale |
| `anomalie_pluie_pct` | % | NULL quand la normale de la décade est < 1 mm |
| `cumul_depuis_juin_mm`, `cumul_normale_depuis_juin_mm`, `ecart_cumul_normale_mm` | mm | Cumuls depuis le 1er juin (décades 16-30 seulement) |
| `part_saison_pct` | % | Part de la décade dans la saison (décades 16-30) |
| `pluie_1_annee_sur_5_mm`, `pluie_mediane_mm`, `pluie_4_annees_sur_5_mm` | mm | Fourchette 1991-2020 de la décade (quantile bas, médiane, quantile haut) |
| `proba_decade_seche_pct` | % | Probabilité d'une décade sèche (< 10 mm) |
| `nb_jours_pluie`, `plus_longue_sequence_seche_j`, `decade_seche` | nombre / jours / booléen | Détail (`decade_seche` n'a de sens qu'en saison) |

**Limites** : ne pas recalculer le total de saison en sommant les décades (il diffère de `pluie_saison_mm` de la carte, en moyenne de −2,4 mm et jusqu'à 41 mm) ; pour le bilan d'une saison, utiliser `MART_CARTE_AGROCLIMAT`. Les quantiles et probabilités ne s'additionnent pas.

```sql
-- Courbe de la campagne en cours pour un département
select numero_decade_annee, libelle_decade, pluie_mm, pluie_normale_mm,
       cumul_depuis_juin_mm, cumul_normale_depuis_juin_mm, ecart_cumul_normale_mm
from SALTIS.MARTS.MART_SUIVI_DECADAIRE
where code_departement = 'SEN.10.1_1' and annee = 2025 and est_decade_saison
order by numero_decade_annee;
```

---

## 3. `MART_CHOIX_CULTURES`

**Grain** : un département, une culture, un type d'option, une option. `type_option = 'CYCLE'` : `option` = `courte`, `moyenne` ou `longue` (1 620 lignes) ; `type_option = 'VARIETE'` : `option` = nom de la variété documentée (90 lignes). Les colonnes propres à un type sont NULL pour l'autre.

| Colonne | Unité | Description |
|---|---|---|
| `culture` | texte | Culture (libellé en majuscules) |
| `type_option`, `option` | texte | Voir ci-dessus |
| `cycle_jours` | jours | Durée du cycle |
| `proba_cycle_couvert_pct` | % | Part des années 1991-2020 où la saison couvre le cycle. **Critère de comparaison des options.** |
| `rang_option` | entier | 1 = meilleure probabilité au sein du département × culture × type d'option ; NULL si la probabilité est inconnue |
| `score_adequation` | 0-100 | Cycles seulement : `round(0,6 × proba cycle + 0,4 × proba eau du cycle moyen)` |
| `proba_besoin_eau_couvert_pct` | % | Cycle moyen seulement |
| `niveau_adequation` | texte | Cultures : `adaptée` (score > 80), `à risque` (> 50), `déconseillée`, `irrigation requise`, `non évaluée (culture pluriannuelle)`. Variétés : `adaptée` dès 80 % |
| `note_score` | texte | « score calculé avec la part eau du cycle moyen » (cycles court et long) |
| `tolerance_secheresse`, `disponibilite_semences`, `zones_recommandees` | texte | Variétés seulement |

**Limites** : comparer les options sur `proba_cycle_couvert_pct`, pas sur le score. Seulement 2 variétés évaluées (Mil sanio, Sahel 177 ; mil souna absent, cycle inconnu) ; Sahel 177 et le manioc n'ont pas de probabilité de cycle. Le mil ressort « déconseillé » dans le nord, où il est pourtant cultivé (calibration à faire).

```sql
-- Options pour une culture dans un département, de la meilleure à la moins bonne
select type_option, option, cycle_jours, proba_cycle_couvert_pct, niveau_adequation, note_score
from SALTIS.MARTS.MART_CHOIX_CULTURES
where code_departement = 'SEN.7.1_1' and culture = 'MIL (SOUNA)'
order by type_option, rang_option;
```

---

## 4. `MART_BESOINS`

**Grain** : un département, une culture. Les 45 départements apparaissent : Guédiawaye et Pikine ont une ligne unique (culture NULL, `message_departement` = « pas de superficie agricole de référence »). **Besoins de référence historiques, pas prévisionnels.**

| Colonne | Unité | Description |
|---|---|---|
| `culture`, `message_departement` | texte | |
| `superficie_reference_ha` | ha | Moyenne des dernières campagnes connues |
| `annees_reference`, `type_superficie` | texte | Années de référence (ex. `2019-2021`), `semée` ou `récoltée` |
| `reference_anterieure_2015` | booléen | Dernière année de référence < 2015 (référence ancienne) |
| `besoin_azote_n_t`, `besoin_phosphate_p2o5_t`, `besoin_potasse_k2o_t` | t | Éléments fertilisants |
| `besoin_npk_15_15_15_t`, `besoin_uree_t`, `besoin_dap_t`, `besoin_fumier_t` | t | Produits (**ne pas additionner produits et éléments** : même fertilisation) |
| `libelle_besoin_engrais` | texte | `dose à saisir`, `superficie de référence nulle`, `calculé` |
| `besoin_semences_t` | t | Valeur de la source |
| `besoin_semences_applicable`, `besoin_semences_retenu_t` | booléen / t | **Totaliser sur `besoin_semences_retenu_t`** (NULL pour le riz pluvial de Casamance) |
| `libelle_semences` | texte | `non applicable (riz pluvial)`, `dose à saisir`, `superficie de référence nulle`, `calculé` |
| `besoin_irrigation_mm`, `volume_irrigation_m3_ha` | mm / m³/ha | Références de **zone** (FAO-56, efficience 60 %), non additives |
| `irrigation_requise`, `irrigation_totale_m3` | booléen / m³ | Volume total seulement pour les cultures en « irrigation requise » |
| `statut_validation_engrais`, `statut_validation_semis` | texte | `VALIDEE`, `A_CONFIRMER`, `NON_VERIFIEE`, `A_COMPLETER` (aucune dose `VALIDEE` aujourd'hui) |
| `source_reference_engrais`, `source_reference_semis` | texte | Source de la dose |
| `coherence_dose_n`, `coherence_dose_semis` | texte | `COHERENT`, `ECART`, `A_VERIFIER` |

**Limites** : dose inconnue → besoin NULL (afficher « dose à saisir », jamais 0) ; dose à 0 → besoin 0 (produit absent de la formule). Doses chiffrées seulement pour le mil, le maïs, le sorgho et le riz irrigué ; aucune n'est validée par un spécialiste. Années de référence anciennes pour 13 lignes.

```sql
-- Totaux nationaux de référence (semences : colonne retenue)
select sum(besoin_azote_n_t) as azote_t, sum(besoin_uree_t) as uree_t, sum(besoin_semences_retenu_t) as semences_t
from SALTIS.MARTS.MART_BESOINS;
```

---

## 5. `MART_TERRITOIRES_AGRODISTRIB`

**Grain** : un département, une culture, **seulement là où la culture existe** (superficie de référence > 0) : 345 lignes. `region`, `code_region` et `zone_agroecologique` servent à agréger selon le niveau de répartition choisi.

| Groupe | Colonnes | Additif ? |
|---|---|---|
| Besoin | `superficie_reference_ha`, `besoin_*_t` (8 besoins, semences retenues), `statut_validation_engrais`, `statut_validation_semis` | **Oui** (superficie et besoins) |
| Potentiel de gain | `niveau_source_potentiel` (`ZONE`), `rendement_moyen_kg_ha`, `rendement_atteignable_kg_ha`, `ecart_rendement_kg_ha`, `potentiel_evalue`, `potentiel_gain_kg_ha` | Non |
| Capacité à valoriser | `meilleur_niveau_adequation`, `proba_cycle_couvert_moyen_pct`, `facteur_limitant_principal` (zone), `proba_saison_seche_pct` | Non |
| Sol | `classe_texture`, `ph_eau`, `reserve_utile_mm`, `carbone_organique_g_kg` (département) ; `amendement_ph_recommande`, `fractionnement_azote_recommande` (zone) | Non |
| Vulnérabilité | `score_vulnerabilite`, `classe_vulnerabilite`, `score_alea_secheresse`, `confiance_rendement`, `methode_version_vulnerabilite` | Non |
| Contexte | `part_cultures_pct` | Non |

**Limites** : le potentiel de gain est une valeur de **zone** : il ne s'additionne jamais et ne distingue pas les départements d'une même zone ; `potentiel_gain_kg_ha` est NULL quand le rendement est une valeur nationale recopiée (« non évalué au niveau de la zone »). Le gain de rendement est indicatif (aucune donnée de réponse aux engrais par territoire). Les besoins d'une zone ou d'une région sont la **somme** des départements.

```sql
-- Besoin en urée et vulnérabilité moyenne par région, pour le mil
select region, sum(besoin_uree_t) as besoin_uree_t, avg(score_vulnerabilite) as vulnerabilite_moyenne
from SALTIS.MARTS.MART_TERRITOIRES_AGRODISTRIB
where culture = 'MIL (SOUNA)'
group by region
order by besoin_uree_t desc;
```

---

## 6. `MART_VULNERABILITE_DEPARTEMENT`

**Grain** : un département, 45 lignes. Score **relatif et indicatif** (méthode `v1`), à valider avec les techniciens.

| Colonne | Unité | Description |
|---|---|---|
| `score_vulnerabilite` | 0-100 | 60 % aléa sécheresse + 40 % sensibilité des rendements ; 100 = le plus vulnérable |
| `rang_vulnerabilite` | entier | 1 = le plus vulnérable |
| `classe_vulnerabilite` | texte | Quintiles : `très faible (relatif)` … `très élevée (relatif)` |
| `score_alea_secheresse`, `score_sensibilite_rendement` | 0-100 | Sous-scores |
| `nb_dimensions_disponibles`, `confiance_rendement` | entier / texte | Score NULL s'il manque une dimension ; `faible` = moins de 3 cultures ou moins de 15 campagnes |
| `freq_alerte_secheresse_pct`, `variabilite_pluie_cv_pct`, `pluie_saison_annee_seche_mm` | % / % / mm | Indicateurs de l'aléa (1991-2020) |
| `variabilite_rendement_pct`, `tendance_rendement_pct_an`, `nb_cultures_rendement`, `nb_campagnes_rendement` | % / %/an / nombre | Indicateurs de sensibilité (1991-2015) |
| `rang_*` | 0-100 | Rangs centiles des indicateurs |
| `freq_alerte_exces_pct`, `proba_saison_seche_pct`, `proba_sequence_seche_15j_pct`, `part_cultures_pct` | % | Affichés **hors score** |
| `methode_version`, `periode_climat`, `periode_rendement`, `nb_saisons_1991_2020` | texte / nombre | Traçabilité |

**Limites** : classement relatif (il compare les départements entre eux) ; score NULL pour Dakar (confiance faible), Guédiawaye et Pikine (aucun rendement). À confirmer : la Vallée du fleuve, en grande partie irriguée, et Saint-Louis et Rufisque, en partie urbains, sont en tête.

```sql
select rang_vulnerabilite, departement, score_vulnerabilite, classe_vulnerabilite, score_alea_secheresse, score_sensibilite_rendement
from SALTIS.MARTS.MART_VULNERABILITE_DEPARTEMENT
order by rang_vulnerabilite nulls last;
```

---

## 7. `MART_ML_PREVISION_PLUIE`

**Grain** : un département, une année, 2 025 lignes (1981-2025). Détail et usage : [`ml/README.md`](../ml/README.md).

| Colonne | Unité | Description |
|---|---|---|
| `annee`, `jeu` | année / texte | `ENTRAINEMENT` (≤ 2015, 1 575 lignes), `TEST` (2016-2025, 450 lignes) |
| `indice_oni_mars_mai`, `indice_tna_mars_mai`, `indice_tsa_mars_mai`, `indice_amo_mars_mai` | °C (anomalie) | Indices océaniques moyens mars-mai, **identiques pour tous les départements d'une année** ; AMO NULL de 2023 à 2025 |
| `pluie_saison_n_moins_1_mm` | mm | Saison précédente (NULL en 1981) |
| `humidite_sol_avril_mai_m3_m3` | m³/m³ | NULL pour 6 départements côtiers et 12 valeurs ponctuelles |
| `pluie_normale_saison_mm` | mm | Normale 1991-2020 |
| `nb_variables_manquantes` | nombre | Variables explicatives NULL sur la ligne |
| `pluie_saison_mm`, `classe_saison` | mm / texte | Cibles (`fact_saison_departement`) |

**Limites** : découpage temporel uniquement ; la normale 1991-2020 chevauche le jeu de test ; aucune variable connue après fin mai.

```sql
select * from SALTIS.MARTS.MART_ML_PREVISION_PLUIE where jeu = 'ENTRAINEMENT';
```
