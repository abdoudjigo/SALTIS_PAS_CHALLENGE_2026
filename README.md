# SALTIS PAS Challenge — Assaman & Suuf (Ciel & Terre)

Plateforme d'aide à la décision agricole au Sénégal — équipe **AKAI** (Alliance for Knowledge, Action & Innovation).
*BUILD. CONNECT. TRANSFORM.*

## Le problème en une phrase
Les agriculteurs doivent savoir **comment sera la pluie de la campagne** (courte/longue, abondante/faible) pour choisir culture, variété (cycle court ou long) et intrants. On croise climat, sol et rendements pour répondre à ça, département par département.

## Les modules
| Module | Question | Tables (dbt marts) |
|---|---|---|
| A. Suivi & anticipation agroclimatique | Quelle pluie, quelle saison ? | `mart_carte_agroclimat`, `mart_suivi_decadaire` |
| B. Choix cultures & variétés | Que semer, avec quel cycle ? | `mart_choix_cultures` |
| C. Besoins & rendements | Combien d'intrants, quels facteurs limitants ? | `mart_besoins` (et les faits `fact_rendement_departement`, `fact_facteurs_limitants`) |
| D. AgroDistrib | Comment répartir les intrants ? | `mart_territoires_agrodistrib`, `mart_vulnerabilite_departement` (prix des intrants : `dim_prix_intrant`) |
| E. Opportunités | Où semer court ou long, où produire en saison sèche ? | `mart_carte_opportunites` ([`docs/carte-opportunites.md`](./docs/carte-opportunites.md)) |
| F. Cadre harmonisé | Où l'insécurité alimentaire est-elle forte ? | `mart_cadre_harmonise_departement` |

Modèles d'IA (`ml/`, entraînés sur `mart_ml_prevision_pluie` et les faits) : prévision de la saison (modèle 1), rendement et alerte récolte (modèle 3), date de semis (modèle 4) et moteur AgroDistrib ; résultats dans `SALTIS.ML`, fiabilité dans [`ml/MODELES.md`](./ml/MODELES.md), comparaison des algorithmes dans [`docs/rapport-comparaison-modeles.md`](./docs/rapport-comparaison-modeles.md). Détail des colonnes : [`docs/contrat-donnees.md`](./docs/contrat-donnees.md).

## Architecture
```
sources (CHIRPS, NASA POWER, SoilGrids, DAPSA…)
   └─ CSV ──► Snowflake SALTIS.RAW
                 └─ dbt/ (staging → intermediate → faits, dimensions, marts) ──► Snowflake SALTIS.STAGING / INTERMEDIATE / MARTS
                                                   ├─ ml/   (saison, rendement, semis, AgroDistrib) ──► SALTIS.ML
                                                   └─ api/  (FastAPI + cache Redis) ──► app/ (front carte Mapbox)
```
L'API (`api/`) lit les marts de `SALTIS.MARTS` une seule fois, précalcule toutes ses réponses et les sert depuis un cache complet (en mémoire, ou **Redis** en option ; versionné, compressé) : Snowflake n'est jamais appelé pendant une requête. Détail : [`api/README.md`](./api/README.md). Le chargeur Python historique (`ingestion/`) utilise encore PostgreSQL.

Pas d'Airflow ni de Kafka : on n'en a pas besoin pour une démo en une semaine. `make` suffit pour orchestrer.

## Démarrage rapide
```bash
cp .env.example .env
make install     # venv + dépendances
make dbt-run     # construit staging + marts dans Snowflake
python -m api    # charge les marts puis sert l'API → http://localhost:8080/docs (Ctrl + C pour arrêter)
make front-install && make front   # front React (données d'exemple) : http://localhost:5173
```

Front (React, Tailwind, PWA, Mapbox), contrat d'API attendu et **déploiement gratuit du front, de l'API et du modèle ML** : [`app/README.md`](./app/README.md).

## Cible Snowflake pour dbt

dbt cible Snowflake. Pour exécuter les modèles dans le compte où les CSV sont déjà chargés :

1. Installer les dépendances du projet (`python -m venv .venv`, puis `.\.venv\Scripts\python.exe -m pip install -r requirements.txt` sous Windows).
2. Copier `.env.example` vers `.env`, puis renseigner `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER` et `SNOWFLAKE_PASSWORD`. L'identifiant du compte est celui attendu par le connecteur Snowflake, pas l'URL complète de Snowsight.
3. Le profil utilise l'authentification Snowflake par mot de passe. Ne pas configurer l'authentification par navigateur pour ce profil et ne jamais commiter de mot de passe.
4. Depuis PowerShell, charger les variables locales, puis vérifier la connexion et lancer dbt :

```powershell
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
    }
}
.\dbt.ps1 debug --profiles-dir . --target snowflake
.\dbt.ps1 seed  --profiles-dir . --target snowflake
.\dbt.ps1 run   --profiles-dir . --target snowflake
.\dbt.ps1 test  --profiles-dir . --target snowflake
```

`dbt.ps1` (à la racine) lance dbt par l'interpréteur Python du venv (`python -c "from dbt.cli.main import cli; cli()"`), depuis le dossier `dbt/`, avec les arguments passés tels quels. Il remplace `dbt.exe`, que la stratégie de contrôle des applications de Windows peut bloquer.

Le profil Snowflake utilise par défaut le rôle `SYSADMIN`, l'entrepôt `SALTIS_WH` et la base `SALTIS`. Les modèles configurés avec `+schema: staging` et `+schema: marts` sont créés dans `SALTIS.STAGING` et `SALTIS.MARTS`; le schéma `RAW` est déclaré comme source et n'est pas modifié par dbt. La description des transformations, des grains et des limites des modèles est dans [`dbt/README.md`](./dbt/README.md).

**État de la modélisation** (décisions validées, règles, état des modèles, points à signaler, questions pour l'ISRA) : [`docs/etat-modelisation.md`](./docs/etat-modelisation.md).

## Données
Les gros fichiers ne vont **pas** dans Git (voir `.gitignore`). Les tables `a_*`, `b_*`, `c_*`, `d_*` se partagent via un dossier Drive commun, à déposer dans `data/modules/`. Détail des colonnes : `docs/data-dictionary.md`.

## Équipe
Voir `docs/team.md`. Workflow Git : voir `CONTRIBUTING.md`.

## Honnêteté du prototype
Estimations indicatives, pas des garanties. Doses d'engrais et variétés encore partielles (à valider ISRA/ANCAR). Ne présenter comme "opérationnel" que ce qui tourne vraiment.
