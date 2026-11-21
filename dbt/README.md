# Modèles dbt

dbt transforme les tables agricoles chargées dans `SALTIS.RAW` en une constellation de faits et de dimensions, puis en marts prêts pour l'API, le front et le ML :

- `models/staging/` : un modèle `stg_` par table source (vues dans `SALTIS.STAGING`). Ces modèles sélectionnent explicitement les colonnes attendues et gardent les noms de colonnes du fichier source.
- `models/intermediate/` : calculs intermédiaires (vues dans `SALTIS.INTERMEDIATE`).
- `models/marts/` : dimensions `dim_`, faits `fact_` et marts `mart_` (tables dans `SALTIS.MARTS`).
- `seeds/` : petits référentiels du projet (`ref_intrants`, `ref_departements`, `ref_cultures`), chargés dans `SALTIS.STAGING`.

Les modèles ne chargent pas les CSV : les tables sources doivent déjà exister dans `SALTIS.RAW` avec leurs en-têtes correctement définis.

- **Décisions, règles, état détaillé de chaque modèle et points ouverts** : [`docs/technique/etat-modelisation.md`](../docs/technique/etat-modelisation.md).
- **Contrat de données des marts** (grain, colonnes, unités, limites, exemples de requêtes) : [`docs/technique/contrat-donnees.md`](../docs/technique/contrat-donnees.md).

## Dimensions

| Modèle | Grain | Lignes |
|---|---|---|
| `dim_temps` | jour (1980-2035), avec décade 1-36 et campagne agricole | 20 454 |
| `dim_geographie` | département (code GADM, région, `code_region`, zone, `zone_secondaire`, latitude et longitude du seed `ref_departements`) | 45 |
| `dim_region` | région administrative | 14 |
| `dim_zone_agroecologique` | zone agroécologique | 6 |
| `dim_culture` | culture (avec Kc FAO-56, température de base et cycle min / max du seed `ref_cultures`) | 12 |
| `dim_variete` | variété documentée | 3 |
| `dim_intrant` | intrant de référence (seed `ref_intrants`) | 9 |

Zone et région sont deux regroupements **parallèles** des départements (Louga, Matam et Tambacounda couvrent deux zones) : il n'y a pas de hiérarchie zone → région. `dim_organisation` et `dim_scenario_allocation` sont désactivées en attendant les tables de l'application.

## Faits

| Module | Modèle | Grain | Lignes |
|---|---|---|---|
| A | `fact_saison_departement` | département × campagne (référence des variables de saison) | 2 025 |
| A | `fact_pluviometrie_decadaire` | département × année × décade | 71 280 |
| A | `fact_climatologie_decadaire` | niveau (département ou zone) × territoire × décade, normales 1991-2020 | 1 800 |
| B | `fact_adequation_culture` | département × culture × classe de cycle (colonnes de la source + couverture en eau par cycle : brute `_calc`, finale `_final` ancrée sur le cycle moyen de la source) | 1 620 |
| B | `fact_adequation_variete` | département × variété | 90 |
| C | `fact_rendement_departement` | département × campagne × culture | 22 905 |
| C | `fact_facteurs_limitants` | zone × culture | 72 |
| C | `fact_reference_agronomique` | zone × culture × intrant × source (doses de référence) | 141 |
| C | `fact_besoin_reference` | département × culture (besoins de référence historiques) | 367 |
| E | `fact_eau_departement` | département (eau de surface, nappes, irrigation ; actif si `eau_chargee`) | 45 |

## Marts

| Module | Modèle | Grain | Lignes |
|---|---|---|---|
| A | `mart_carte_agroclimat` | département × campagne | 2 025 |
| A | `mart_suivi_decadaire` | département × année × décade | 71 280 |
| B | `mart_choix_cultures` | département × culture × option (cycle ou variété) | 1 710 |
| C | `mart_besoins` | département × culture (45 départements) | 369 |
| D | `mart_territoires_agrodistrib` | département × culture cultivée | 345 |
| D | `mart_vulnerabilite_departement` | département (score relatif) | 45 |
| ML | `mart_ml_prevision_pluie` | département × année | 2 025 |
| E | `mart_carte_opportunites` | département : jaune / vert (saison), bleu (eau mobilisable) | 45 |

Les anciens marts `mart_saisons`, `mart_profil_agro`, `mart_adequation`, `mart_adequation_varietes`, `mart_rendements`, `mart_facteurs_limitants` et `mart_agrodistrib` (copies du staging) ont été supprimés ; `mart_besoins` a été reconstruit sur les faits. Les marts ne fabriquent pas de prévisions : l'adéquation est celle calculée dans les données d'entrée, et la vulnérabilité est un score relatif et indicatif.

## Limites à garder en tête

- Les prévisions saisonnières ne sont pas encore produites par un modèle ML ; le jeu de données est prêt (`mart_ml_prevision_pluie`).
- Les variétés référencées sont incomplètes et les doses de plusieurs cultures restent à documenter ou faire valider par l'ISRA et l'ANCAR (aucune dose validée aujourd'hui).
- Les besoins sont des besoins de référence historiques, pas prévisionnels. Les stocks, scénarios et allocations d'AgroDistrib attendent les tables de l'application ; les anciennes simulations (`D_SCENARIOS_REPARTITION`) ne sont pas de vrais scénarios.
- Les rendements historiques ont leurs propres limites de couverture : campagnes observées de 1981 à 2021, superficie récoltée jusqu'en 2015 puis semée.
- Les contours des départements (GADM 4.1) ne sont pas encore chargés ; tout est prêt derrière la variable `geo_departements_charge`.
- La couche bleue de `mart_carte_opportunites` attend les sources eau (`SALTIS.RAW.E_*`) ; tout est prêt derrière la variable `eau_chargee`. Voir [`docs/technique/carte-opportunites.md`](../docs/technique/carte-opportunites.md).
- Pour fonctionner, chaque table de `SALTIS.RAW` doit avoir des colonnes portant les noms des en-têtes du CSV correspondant. Si Snowflake crée des colonnes comme `C1`, `C2`, le chargement du fichier doit être corrigé avant d'exécuter le modèle `stg_` associé.

## Exécuter les modèles

Depuis la racine du dépôt, après avoir défini les variables Snowflake nécessaires dans l'environnement PowerShell :

```powershell
.\dbt\dbt.ps1 debug --profiles-dir . --target snowflake
.\dbt\dbt.ps1 seed  --profiles-dir . --target snowflake
.\dbt\dbt.ps1 run   --profiles-dir . --target snowflake
.\dbt\dbt.ps1 test  --profiles-dir . --target snowflake
```

`dbt/dbt.ps1` lance dbt par l'interpréteur Python du venv (`python -c "from dbt.cli.main import cli; cli()"`), depuis le dossier `dbt/`, avec les arguments passés tels quels. Il remplace `dbt.exe`, que la stratégie de contrôle des applications de Windows peut bloquer.

Pour reconstruire uniquement les vues staging ou un mart et ses dépendances :

```powershell
.\dbt\dbt.ps1 run   --profiles-dir . --target snowflake --select path:models/staging
.\dbt\dbt.ps1 build --profiles-dir . --target snowflake --select +fact_saison_departement
```

Le profil du projet utilise l'authentification Snowflake par mot de passe. Ne partagez et ne versionnez jamais le mot de passe ou le fichier local `.env`.
