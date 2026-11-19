# SALTIS PAS Challenge — Assaman & Suuf (Ciel & Terre)

Plateforme d'aide à la décision agricole au Sénégal — équipe **AKAI** (Alliance for Knowledge, Action & Innovation).
*BUILD. CONNECT. TRANSFORM.*

## Le problème en une phrase
Les agriculteurs doivent savoir **comment sera la pluie de la campagne** (courte/longue, abondante/faible) pour choisir culture, variété (cycle court ou long) et intrants. On croise climat, sol et rendements pour répondre à ça, département par département.

## Les 4 modules
| Module | Question | Tables (dbt marts) |
|---|---|---|
| A. Suivi & anticipation agroclimatique | Quelle pluie, quelle saison ? | `mart_saisons`, `mart_profil_agro` |
| B. Choix cultures & variétés | Que semer, avec quel cycle ? | `mart_adequation` |
| C. Besoins & rendements | Combien d'intrants, quels facteurs limitants ? | `mart_besoins`, `mart_rendements` |
| D. AgroDistrib | Comment répartir les intrants ? | `mart_agrodistrib` |

## Architecture (volontairement simple)
```
sources (CHIRPS, NASA POWER, SoilGrids, DAPSA…)
   └─ ingestion/  (Python)  ──►  PostgreSQL (schéma raw)
                                   └─ dbt/  (staging → marts)  ──►  PostgreSQL (schéma marts)
                                                                      ├─ ml/   (prévision pluie, rendement)
                                                                      ├─ api/  (FastAPI)
                                                                      └─ app/  (front carte Mapbox)
```
Pas de Redis, Airflow ni Kafka : on n'en a pas besoin pour une démo en une semaine. `make` suffit pour orchestrer.

## Démarrage rapide
```bash
cp .env.example .env
make up          # PostgreSQL via Docker
make install     # venv + dépendances
make load        # charge data/modules/*.csv dans le schéma raw
make dbt-run     # construit staging + marts
make api         # http://localhost:8000/docs
```

## Données
Les gros fichiers ne vont **pas** dans Git (voir `.gitignore`). Les tables `a_*`, `b_*`, `c_*`, `d_*` se partagent via un dossier Drive commun, à déposer dans `data/modules/`. Détail des colonnes : `docs/data-dictionary.md`.

## Équipe
Voir `docs/team.md`. Workflow Git : voir `CONTRIBUTING.md`.

## Honnêteté du prototype
Estimations indicatives, pas des garanties. Doses d'engrais et variétés encore partielles (à valider ISRA/ANCAR). Ne présenter comme "opérationnel" que ce qui tourne vraiment.
