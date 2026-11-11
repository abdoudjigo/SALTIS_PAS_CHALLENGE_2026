@docs/etat-modelisation.md

# CLAUDE.md — consignes de travail (projet SALTIS / Assaman & Suuf, équipe AKAI)

Le contexte du projet, les règles validées, l'état des modèles et les points ouverts sont dans [`docs/etat-modelisation.md`](docs/etat-modelisation.md), importé ci-dessus. Ce fichier ne contient que les consignes pour Claude.

## Façon de travailler

- Une tâche à la fois. À la fin de chaque tâche, donner : fichiers créés ou modifiés, volume, résultat des tests, points à trancher. Puis **attendre la validation** avant la tâche suivante.
- Quand une tâche demande une proposition (correspondance, méthode, liste de colonnes, répartition), **proposer d'abord, sans appliquer**, et attendre la validation.
- Aucun commit, aucun changement de branche, aucun push : l'utilisateur commite lui-même sur `dev/aby`.
- Ne pas toucher à `dbt/models.zip`.
- Tout script SQL qui modifie Snowflake (`drop`, `create`, `grant`…) est **écrit** dans `snowflake/`, jamais exécuté : c'est l'utilisateur qui l'exécute. Les requêtes de lecture (`select`, `show`, `information_schema`) sont permises.
- Ne rien modifier dans `api/` (partie d'Anthony) : signaler dans `docs/etat-modelisation.md`, rubrique « À signaler ».
- Vérifier dans les données avant d'écrire une règle (constance d'une colonne, sens d'un quantile, seuils réellement appliqués par la source) ; documenter ce que fait la source sans la corriger, sauf décision contraire.
- Mettre à jour `docs/etat-modelisation.md` à la fin de chaque tâche (état des modèles, règles d'usage, points à signaler, questions pour l'ISRA).

## Environnement

- Windows / PowerShell, venv à la racine (`.venv`) ; dbt se lance par `.\dbt.ps1` depuis la racine.
- dbt `1.13.0-rc1`, adaptateur Snowflake `1.12.5`, profil `saltis`, target `snowflake`, `--profiles-dir .`
- Les avertissements `FutureWarning` / `UserWarning` du connecteur Snowflake sont sans effet.
- `dbt.exe` est bloqué par la stratégie de contrôle des applications de Windows (constaté le 10/11/2026) : toujours passer par `dbt.ps1` à la racine, qui lance `python -c "from dbt.cli.main import cli; cli()"` du venv.

```powershell
# depuis la racine du dépôt (dbt.ps1 se place dans dbt/ et passe les arguments tels quels)
.\dbt.ps1 build --profiles-dir . --target snowflake --select <modele>
.\dbt.ps1 test  --profiles-dir . --target snowflake --select <modele>
```

## Conventions dbt

- `dbt_project.yml` :
  - `staging` → vues, schéma `staging` ;
  - `intermediate` → vues, schéma `intermediate` ;
  - `marts` → tables, schéma `marts` ;
  - seeds (`seeds/`) → schéma `staging`.
- Les dimensions, les faits et les marts sont dans `models/marts/`.
- **Clés partagées** : toujours utiliser les macros de `macros/cles.sql` dans les faits :
  - `{{ cle_departement('code_departement') }}` = `md5(trim(...))`
  - `{{ cle_zone('zone_agroecologique') }}` = `md5(upper(trim(...)))`
  - `{{ cle_culture('culture') }}` = `md5(upper(trim(...)))`
  - `{{ cle_region('region') }}` = `md5(upper(trim(...)))`
  - `{{ cle_variete('culture', 'variete') }}` = `md5(concat(upper(trim(culture)), '|', upper(trim(variete))))`, identique à `dim_variete.id_variete`
  - `{{ code_region_depuis_departement('code_departement') }}` : code GADM de la région (`SEN.10.1_1` → `SEN.10_1`), pas une clé md5.
- **Statuts des doses** : toujours passer par `macros/statuts_doses.sql` (`statut_validation_engrais`, `source_reference_engrais`, `statut_validation_semis`, `source_reference_semis`), jamais une correspondance recopiée à la main. Un texte non prévu renvoie NULL et fait échouer les tests `not_null`.
- **Scores** : rang centile 0-100 par `macros/scores.sql` (`rang_centile`, ex aequo au rang moyen, NULL conservé). Les macros vont dans `macros/`, jamais dans un modèle (dbt refuse).
- Le lien au temps se fait par `campagne_agricole` (année) ou `numero_decade_annee` (1 à 36), pas par `id_temps` journalier.
- Une source à venir : modèle désactivé (`enabled=false`), ou piloté par une variable quand plusieurs objets dépendent du chargement (ex. `geo_departements_charge` pour GADM : staging, colonnes de `dim_geographie` et test).
- Marts destinés à l'API et au front : à plat, noms lisibles et codes (`code_departement`, région, zone), sans clé md5 exposée.
- Tests YAML : clé `data_tests:`, paramètres des tests génériques sous `arguments:` (exigé par dbt 1.13).
- Tests des dimensions et des marts dans `models/marts/_marts.yml`, tests des faits dans `models/marts/_facts.yml`, seeds dans `seeds/_seeds.yml`, tests métier dans `tests/*.sql`.
- Snowflake : `<> not (...)` est refusé, écrire `<> (not (...))` ; les sous-requêtes corrélées sont souvent refusées, préférer une jointure.
