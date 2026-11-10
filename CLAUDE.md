# CLAUDE.md — Projet SALTIS / Assaman & Suuf (équipe AKAI)

Contexte de reprise pour Claude Code. À placer à la racine du dépôt `abdoudjigo/assaman-suuf` (branche `develop`).

## Le projet

Plateforme d'aide à la décision agricole au Sénégal (SALTIS PAS Challenge 2026), à l'échelle du département (45 départements, 6 zones agroécologiques).

Modules :
- DataFlow360 (socle données et analyse) ;
- A. suivi agroclimatique ;
- B. choix des cultures et des variétés ;
- C. besoins et rendements ;
- D. AgroDistrib (stocks, scénarios et allocations d'intrants par organisation).

Chaîne de données : sources → Snowflake `SALTIS.RAW` → dbt (`STAGING` → `INTERMEDIATE` → `MARTS`) → application / BI.
PostgreSQL gère les données opérationnelles de l'application : utilisateurs, rôles, organisations, déclarations de stocks, scénarios. Aucune donnée d'authentification ne va dans Snowflake.

## Cibles et fonctionnalités (dossier de candidature, référence)

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
- **Vulnérabilité** : indicateur par département (alertes, probabilité de saison sèche, variabilité), utilisable comme règle de priorité dans les scénarios.
- **Besoins à deux niveaux** : producteur et département, distincts (pas de niveau coopérative).
- **Offre de semences** (si les associations de semenciers sont confirmées) : variétés disponibles déclarées, rapprochées des besoins et de l'adéquation.
- **Validation par des spécialistes** : statut de validation porté par chaque référence agronomique et chaque recommandation.

Sources futures citées dans la candidature, absentes de RAW aujourd'hui : ERA5-Land, ESA WorldCover, MODIS, stations météo locales. Ne pas créer de modèles avant leur ingestion.

## Environnement

- Windows / PowerShell, venv à la racine : `..\.venv\Scripts\dbt.exe` depuis `dbt/`.
- dbt `1.13.0-rc1`, adaptateur Snowflake `1.12.5`, profil `saltis`, target `snowflake`, `--profiles-dir .`
- Les avertissements `FutureWarning` / `UserWarning` du connecteur Snowflake sont sans effet.

```powershell
Push-Location dbt
& ..\.venv\Scripts\dbt.exe run  --profiles-dir . --target snowflake --select <modele>
& ..\.venv\Scripts\dbt.exe test --profiles-dir . --target snowflake --select <modele>
Pop-Location
```

## Règles à respecter (décisions validées)

1. Ne jamais inventer de source RAW ou de modèle STAGING inexistant.
2. Un modèle qui dépend d'une source à venir est désactivé avec `config(enabled=false)`, pas supprimé. On désactive le staging et la dimension ensemble.
3. Les stocks sont gérés par **organisation** (pas par département) et ne sont jamais mutualisés entre organisations. Une organisation est une ONG ou un service de l'État (association de producteurs de semences : à confirmer). Les coopératives et les fournisseurs d'intrants sont hors périmètre, tout comme la logistique physique (entrepôts, transport).
4. Les scénarios sont **générés par la solution** (algorithme de répartition), pas construits à la main par l'organisation. L'organisation fournit son stock et ses priorités, compare les propositions, peut les ajuster, puis valide. Un scénario est toujours rattaché à l'organisation dont il répartit le stock. Les quantités proposées par l'algorithme et les quantités validées restent distinctes. Chaque scénario conserve la méthode, la version de l'algorithme et les paramètres utilisés.
5. Les besoins doivent pouvoir être calculés au niveau départemental et au niveau du producteur, sans être confondus.
6. Les anciennes simulations (`D_SCENARIOS_REPARTITION`) ne sont pas de vrais scénarios. `D_STOCKS_DISPONIBLES` est vide et suit un ancien modèle par département : ne pas l'utiliser pour les stocks.
7. Besoins historiques ou de référence ≠ besoins prévisionnels.
8. Les doses agronomiques incomplètes ne sont jamais présentées comme validées.
9. Chaque fait garde son grain d'origine : on ne mélange pas département, zone et national, et on ne remplace jamais une valeur manquante par zéro.

## Conventions dbt

- `dbt_project.yml` :
  - `staging` → vues, schéma `staging` ;
  - `intermediate` → vues, schéma `intermediate` ;
  - `marts` → tables, schéma `marts`.
- Les dimensions et les faits sont dans `models/marts/`.
- **Clés partagées** : toujours utiliser les macros de `macros/cles.sql` dans les faits :
  - `{{ cle_departement('code_departement') }}` = `md5(trim(...))`
  - `{{ cle_zone('zone_agroecologique') }}` = `md5(upper(trim(...)))`
  - `{{ cle_culture('culture') }}` = `md5(upper(trim(...)))`
- Le lien au temps se fait par `campagne_agricole` (année) ou `numero_decade_annee` (1 à 36), pas par `id_temps` journalier.
- Tests YAML : clé `data_tests:`, paramètres des tests génériques sous `arguments:` (exigé par dbt 1.13).
- Tests des dimensions dans `models/marts/_marts.yml`, tests des faits dans `models/marts/_facts.yml`, tests métier dans `tests/*.sql`.

## État d'avancement (10/11/2026)

### Fait et validé

- **Étape 1** :
  - modèles sans source désactivés : `stg_organisations`, `stg_intrants`, `dim_organisation`, `dim_intrant`, `dim_scenario_allocation` ;
  - `dim_variete` corrigé (`tolerance_secheresse`, `disponibilite_semences`) ;
  - `int_reference_besoins_departement_culture` déplacé dans `SALTIS.INTERMEDIATE` (ancienne vue de `PUBLIC` supprimée).
- **Étape 2** :
  - `dim_temps` : décades limitées à 3 par mois (le 31 tombe en décade 3), dates générées par `row_number()`, ajout de `libelle_decade` et `est_decade_saison` ;
  - `dim_geographie` basée sur `stg_profil_agroclimatique` ;
  - 29 tests sur les dimensions passent.
- Volumes : `dim_temps` 20 454 (1980–2035), `dim_geographie` 45, `dim_zone_agroecologique` 6, `dim_culture` 12, `dim_variete` 3.
- **Étape 3** : `fact_rendement_departement`
  - grain : département × campagne × culture ;
  - 22 905 lignes, dont 8 244 avec `est_observe = true`, campagnes 1981 à 2021 observées ;
  - variables climatiques départementales et données nationales (`engrais_total_kg_ha`, `rendement_national_kg_ha`) exclues ;
  - tests OK.
- **Étape 4** : `fact_saison_departement`
  - grain : département × campagne, 2 025 lignes, 1981–2025 ;
  - Guédiawaye passe par NASA POWER (45 lignes) ;
  - c'est la source de référence des variables climatiques départementales ;
  - tests OK : 10 génériques et `tests/fact_saison_valeurs_valides.sql`.
- **Étape 5** : `fact_pluviometrie_decadaire`
  - grain : département × année × décade (`numero_decade_annee` 1 à 36), 71 280 lignes, 44 départements (Guédiawaye absent), 1981–2025 ;
  - `campagne_agricole` calculée comme dans `dim_temps` ; cumul et part de saison renseignés pour les décades 16 à 30 uniquement, nuls ailleurs ;
  - colonnes dérivées : `est_decade_saison`, `cumul_normale_depuis_juin_mm`, `ecart_cumul_normale_mm` ;
  - anomalie nulle quand la normale de la décade est < 1 mm ; `decade_seche` n'a de sens qu'avec `est_decade_saison` ;
  - tests OK : 13 génériques et `tests/fact_pluviometrie_valeurs_valides.sql`.
- Corrections : commentaire de `dim_geographie` (zone et région parallèles) ; `fact_rendement_valeurs_valides.sql` déplacé de `models/marts/` vers `tests/` (aucun objet n'avait été construit dans `SALTIS.MARTS`).

### Règle d'usage : saison ou décadaire

- Bilan d'une saison (total, démarrage, fin, séquences sèches, classe, alertes) : **`fact_saison_departement`**, toujours. C'est la source de référence.
- Suivi en cours de campagne, décade par décade (pluie de la décade, cumul depuis juin comparé à la normale) : **`fact_pluviometrie_decadaire`**.
- Ne pas recalculer le total de saison en sommant les décades : le cumul décadaire à fin octobre diffère de `pluie_saison_mm` (1 663 couples département × année sur 1 980 avec plus de 1 mm d'écart, écart moyen −2,4 mm, maximum 41 mm ; les deux mesures sont calculées différemment par la source).

### À confirmer

- Contrôle de cohérence de la pluie entre `fact_rendement_departement` et `fact_saison_departement`. Résultat attendu : 0 écart. Utiliser la jointure sur `DIM_CULTURE`, pas une sous-requête corrélée, que Snowflake refuse.

### Prochaines étapes

6. `fact_climatologie_decadaire`
   - sources `stg_repartition_pluie_departement` et `stg_repartition_pluie_zone` ;
   - une ligne par niveau géographique, jamais les deux.
7. `fact_adequation_culture` (département × culture × classe de cycle) et `fact_adequation_variete` (département × variété), pour le module B.
8. `fact_facteurs_limitants` (zone × culture), pour le module C.
9. `fact_reference_agronomique`
   - grain : zone × culture × intrant × source ;
   - colonnes de traçabilité prévues dès le départ : source, unité, statut de validation, date.
10. `fact_besoin_reference`
    - à partir de `int_reference_besoins_departement_culture` ;
    - besoins historiques ou de référence, pas prévisionnels.
11. Indicateur de vulnérabilité par département (mart), à partir de `fact_saison_departement` et du profil agroclimatique.
12. Faits AgroDistrib (besoins prévisionnels, stocks, allocations), en attente des tables PostgreSQL :
    - `APP_ORGANISATIONS` (ONG, services de l'État ; associations de semenciers à confirmer) ;
    - `APP_INTRANTS` (une semence peut référencer une variété) ;
    - `APP_STOCKS_INTRANTS` ;
    - `APP_SCENARIOS_ALLOCATION`, `APP_ALLOCATIONS_INTRANTS` ;
    - `APP_PLANS_CULTURAUX_DEPARTEMENT`, `APP_PLANS_CULTURAUX_PRODUCTEUR`.

    Besoins : deux faits distincts, un au niveau producteur et un au niveau département. Aucun niveau coopérative. `id_variete` nullable dans les besoins en semences, pour rapprocher l'offre des semenciers de la demande.

    **Répartition multi-niveaux.** Le décideur (ministère, ONG) saisit ses intrants : produit, quantité, campagne. Il choisit ensuite le **niveau de répartition** (zone agroécologique, région ou département) et ses critères (prorata des besoins, priorité à la vulnérabilité, plafonds…). Le modèle propose alors une quantité par territoire, selon la situation de chaque territoire.
    - Une exécution = un seul niveau. `fact_allocation_intrant` porte `niveau_destination` (`ZONE` / `REGION` / `DEPARTEMENT`) et la clé du territoire correspondant. Une seule clé est renseignée par ligne.
    - Les besoins et indicateurs des zones et des régions sont **agrégés** depuis le département (somme des besoins, jamais une valeur zonale recopiée sur les départements).
    - Un intrant est lié aux cultures auxquelles il s'applique. Seuls les territoires qui cultivent ces cultures reçoivent une part.
    - Il faut créer `dim_region` (dérivable dès maintenant de `stg_profil_agroclimatique`).
    - **Zone et région ne sont pas emboîtées** : un département appartient à une seule zone et à une seule région, mais Louga, Matam et Tambacounda s'étendent chacune sur deux zones. Zone et région sont deux regroupements parallèles des départements. Ne pas coder une hiérarchie zone → région.
    - **Critères du modèle**, calculés au niveau du département puis agrégés (le sol varie fortement à l'intérieur d'une même zone : pH de 5,6 à 7,0 dans le Bassin arachidier) :
      - besoin (superficie × dose) ;
      - potentiel de gain (écart entre rendement atteignable et rendement moyen) ;
      - capacité à valoriser l'intrant (adéquation climat et cycle, risque de saison sèche, facteur limitant principal) ;
      - contraintes de sol (pH, texture, réserve utile, carbone organique) ;
      - vulnérabilité.
    - Le décideur règle l'arbitrage **rendement / équité** par des pondérations. L'allocation ne dépasse jamais le besoin. Le gain de rendement est une **estimation indicative** : aucune donnée de réponse aux engrais par territoire n'est disponible (à valider avec l'ISRA).
13. `fact_prevision_saisonniere` (département × campagne × version de modèle) quand le modèle ML existera. Ne jamais la mélanger avec `fact_saison_departement`.
14. Mettre à jour `dbt/README.md` (il indique à tort que les `dim_` n'existent pas). Dans `docs/README-constellation.md`, corriger la hiérarchie « Zone → Région → Département » : zone et région sont deux regroupements parallèles. Le reste du document est juste sur les coopératives (hors périmètre).

## Données ISRA (engrais), à intégrer à réception

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

## Points de vigilance sur les données

- Le mil ressort « déconseillé » dans le nord alors qu'il y est cultivé : calibration à faire avec les techniciens.
- La variété « Mil sanio (type tardif) » est rattachée à la culture « Mil (souna) », qui est en réalité le libellé générique du mil chez DAPSA.
- Rendements : superficie récoltée jusqu'en 2015, superficie semée ensuite (`type_superficie`). Pour agréger le rendement, calculer `sum(production) / sum(superficie)`, jamais la moyenne des rendements.
- NDVI disponible à partir de 2000 seulement.
