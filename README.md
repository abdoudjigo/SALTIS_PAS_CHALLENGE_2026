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
| E. Opportunités | Où semer court ou long, où produire en saison sèche ? | `mart_carte_opportunites` ([`docs/technique/carte-opportunites.md`](./docs/technique/carte-opportunites.md)) |
| F. Cadre harmonisé | Où l'insécurité alimentaire est-elle forte ? | `mart_cadre_harmonise_departement` |

Modèles d'IA (`ml/`, entraînés sur `mart_ml_prevision_pluie` et les faits) : prévision de la saison (modèle 1), rendement et alerte récolte (modèle 3), date de semis (modèle 4) et moteur AgroDistrib ; résultats dans `SALTIS.ML`, fiabilité dans [`ml/MODELES.md`](./ml/MODELES.md), comparaison des algorithmes dans [`docs/technique/rapport-comparaison-modeles.md`](./docs/technique/rapport-comparaison-modeles.md). Détail des colonnes : [`docs/technique/contrat-donnees.md`](./docs/technique/contrat-donnees.md).

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

## Structure du dépôt
```
api/          API FastAPI : routes, cache précalculé (Redis), voix wolof, tests        → api/README.md
app/          Site et PWA (React, Vite, Tailwind, Mapbox)                               → app/README.md
dbt/          Transformations Snowflake : staging → intermediate → marts, seeds, tests → dbt/README.md
ml/           Modèles : saison (M1), rendement (M3), semis (M4), AgroDistrib            → ml/README.md, ml/MODELES.md
ingestion/    Collecte et chargement des sources dans SALTIS.RAW                        → ingestion/collecte/README.md
snowflake/    Scripts SQL à exécuter à la main (tables RAW et ML), numérotés
voix/         Space Hugging Face de la voix wolof (facultatif)                          → voix/README.md
deploy/       Production : Dockerfiles, Caddyfile, guide du VPS                         → deploy/README.md
docs/         Documentation : technique, projet, audit, visuels                        → docs/README.md
data/         Référentiels versionnés (data/referentiels/) ; données lourdes hors Git
```
Fichiers de la racine : `Makefile` (commandes), `docker-compose.yml` (PostgreSQL et Redis en local), `docker-compose.prod.yml` (production), `requirements*.txt` (Python : tout, API seule, voix), `.env.example` (variables, à copier en `.env`), `.python-version` et `.nvmrc` (versions).

## Démarrage rapide

Prérequis : Python **3.12**, Node **22** (20.19 au minimum), et, pour les vraies données, un accès Snowflake.

**Le site seul, avec les données d'exemple (aucun accès nécessaire, environ 10 minutes) :**
```bash
make front-install && make front   # http://localhost:5173
```

**Toute la chaîne (Linux, macOS) :**
```bash
cp .env.example .env               # renseigner au moins SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PASSWORD
make install                       # crée venv/ et installe requirements.txt
make dbt-run                       # construit staging et marts dans Snowflake, puis les tests dbt
make api                           # charge les marts puis sert l'API → http://localhost:8080/docs (Ctrl + C pour arrêter)
make front-install && make front   # dans app/.env.local : VITE_USE_MOCK=false pour lire l'API
```

**Avant une Pull Request :** `make verifier` (ruff, tests Python, lint et build du front).

### Windows (PowerShell)

`make` n'est pas installé par défaut sous Windows : on lance les mêmes étapes à la main.
```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env        # puis renseigner les variables Snowflake
# Charger .env dans la session PowerShell
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
    }
}
.\dbt\dbt.ps1 debug --profiles-dir . --target snowflake
.\dbt\dbt.ps1 seed  --profiles-dir . --target snowflake
.\dbt\dbt.ps1 run   --profiles-dir . --target snowflake
.\dbt\dbt.ps1 test  --profiles-dir . --target snowflake
.\venv\Scripts\python.exe -m api
```
`dbt/dbt.ps1` lance dbt par l'interpréteur Python du venv, depuis le dossier `dbt/`, avec les arguments passés tels quels. Il remplace `dbt.exe`, que la stratégie de contrôle des applications de Windows peut bloquer.

### Snowflake

L'identifiant du compte (`SNOWFLAKE_ACCOUNT`) est celui attendu par le connecteur, pas l'URL de Snowsight. Le profil dbt utilise l'authentification par mot de passe ; ne jamais commiter de mot de passe. Par défaut : entrepôt `SALTIS_WH`, base `SALTIS`. Les modèles `+schema: staging`, `intermediate` et `marts` sont créés dans `SALTIS.STAGING`, `SALTIS.INTERMEDIATE` et `SALTIS.MARTS` ; le schéma `RAW` est une source, jamais modifiée par dbt. Détail des transformations, des grains et des limites : [`dbt/README.md`](./dbt/README.md).

Déploiement en production (VPS, Docker, HTTPS) : [`deploy/README.md`](./deploy/README.md).

**État de la modélisation** (décisions validées, règles, état des modèles, points à signaler, questions pour l'ISRA) : [`docs/technique/etat-modelisation.md`](./docs/technique/etat-modelisation.md).

## Données
Les gros fichiers ne vont **pas** dans Git (voir `.gitignore`). Les tables `a_*`, `b_*`, `c_*`, `d_*` se partagent via un dossier Drive commun, à déposer dans `data/modules/`. Détail des colonnes : `docs/technique/data-dictionary.md`.

## Équipe
Voir `docs/projet/team.md`. Conventions et workflow Git : voir `CONTRIBUTING.md`.

## Honnêteté du prototype
Estimations indicatives, pas des garanties. Doses d'engrais et variétés encore partielles (à valider ISRA/ANCAR). Ne présenter comme "opérationnel" que ce qui tourne vraiment.

## Licence
Tous droits réservés, équipe AKAI : voir [`LICENSE`](./LICENSE). Les données et logiciels de tiers gardent leur propre licence (page « Données » du site, `docs/technique/contrat-donnees.md`).
