# Modèles dbt

dbt transforme les tables agricoles chargées dans `SALTIS.RAW` en deux couches :

- `models/staging/` : un modèle `stg_` par table source. Ces modèles sélectionnent explicitement les colonnes attendues et gardent les noms de colonnes du fichier source.
- `models/marts/` : modèles métier `mart_` regroupés selon les quatre modules de la plateforme.

Les modèles `stg_` sont des vues dans `SALTIS.STAGING`. Les modèles `mart_` sont des tables dans `SALTIS.MARTS`. Les modèles ne chargent pas les CSV : les tables sources doivent déjà exister dans `SALTIS.RAW` avec leurs en-têtes correctement définis.

## Marts et leur contenu

| Module | Modèle | Grain (une ligne par...) | Utilité |
|---|---|---|---|
| A. Agroclimat | `mart_saisons` | département et année | Bilan de la saison, pluies, sécheresse et excès de pluie. `risque_saison` résume les alertes disponibles. |
| A. Agroclimat | `mart_profil_agro` | département | Normales de pluie, probabilités climatiques et caractéristiques des sols. |
| B. Cultures | `mart_adequation` | département, culture et classe de cycle | Comparaison des cultures et de leurs cycles selon l'adéquation calculée. |
| B. Cultures | `mart_adequation_varietes` | département, culture et variété | Adéquation des variétés documentées au climat local. |
| C. Besoins et rendements | `mart_besoins` | département et culture | Doses, besoins estimés en intrants, semences et irrigation. |
| C. Besoins et rendements | `mart_rendements` | département, année et culture | Historique des rendements avec les indicateurs climatiques disponibles. |
| C. Besoins et rendements | `mart_facteurs_limitants` | zone agroécologique et culture | Rendements atteignables, facteurs limitants et corrélations observées. |
| D. AgroDistrib | `mart_agrodistrib` | département, scénario et produit | Besoin, allocation, couverture et déficit pour les scénarios fournis. |

Les modèles de mart exposent les données utiles avec une liste explicite de colonnes, conservent les grains des tables sources et ne fabriquent pas de prévisions ou de recommandations nouvelles. L'adéquation et les scénarios sont ceux déjà calculés dans les données d'entrée.

## Évolution multidimensionnelle proposée

La constellation analytique est une évolution à construire à partir des modèles `stg_`. Son architecture cible, les dimensions, faits, grains et liaisons proposés sont décrits dans le [README de la modélisation multidimensionnelle](../docs/README-constellation.md). Les modèles `dim_` et `fct_` n'existent pas encore.

## Limites à garder en tête

- Les prévisions saisonnières ne sont pas encore produites par un modèle ML ; les tables de prédicteurs sont seulement disponibles dans la couche staging.
- Les variétés référencées sont incomplètes et les doses de plusieurs cultures restent à documenter ou faire valider par l'ISRA et l'ANCAR.
- Les besoins consolidés et les scénarios de répartition sont partiels. Le scénario fourni est une démonstration basée sur une disponibilité nationale estimée, et non un inventaire de stocks réels.
- Les rendements historiques ont leurs propres limites de couverture, notamment les campagnes disponibles et le type de superficie renseigné par la source.
- Pour fonctionner, chaque table de `SALTIS.RAW` doit avoir des colonnes portant les noms des en-têtes du CSV correspondant. Si Snowflake crée des colonnes comme `C1`, `C2`, le chargement du fichier doit être corrigé avant d'exécuter le modèle `stg_` associé.

## Exécuter les modèles

Depuis la racine du dépôt, après avoir défini les variables Snowflake nécessaires dans l'environnement PowerShell :

```powershell
Push-Location dbt
& ..\.venv\Scripts\dbt.exe debug --profiles-dir . --target snowflake
& ..\.venv\Scripts\dbt.exe run --profiles-dir . --target snowflake
& ..\.venv\Scripts\dbt.exe test --profiles-dir . --target snowflake
Pop-Location
```

Pour reconstruire uniquement les vues staging ou un mart et ses dépendances :

```powershell
& ..\.venv\Scripts\dbt.exe run --profiles-dir . --target snowflake --select path:models/staging
& ..\.venv\Scripts\dbt.exe run --profiles-dir . --target snowflake --select +mart_saisons
```

Le profil du projet utilise l'authentification Snowflake par mot de passe. Ne partagez et ne versionnez jamais le mot de passe ou le fichier local `.env`.
