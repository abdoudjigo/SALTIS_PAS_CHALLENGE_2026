"""Présentation de la documentation interactive : description, tags, page Swagger aux couleurs du projet."""

from fastapi import FastAPI, Request
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse

TITRE = "Assaman & Suuf — API SALTIS"

RESUME = "Données agroclimatiques et agronomiques du Sénégal, par département, servies depuis un cache Redis complet."

DESCRIPTION = """
Plateforme d'aide à la décision agricole au Sénégal — **équipe AKAI**, SALTIS PAS Challenge 2026.
45 départements, 14 régions, 6 zones agroécologiques.

| Module Contradiction avec le README | Question | Routes |
|---|---|---|
| **A** · Agroclimat | Quelle pluie, quelle saison ? | `/agroclimat`, `/suivi-decadaire` |
| **B** · Cultures | Que semer, avec quel cycle ? | `/choix-cultures` |
| **C** · Besoins | Combien d'intrants ? | `/besoins` |
| **D** · AgroDistrib | Comment répartir les intrants ? | `/agrodistrib`, `/vulnerabilite` |

### Comment les données sont servies

```
Snowflake SALTIS.MARTS ──(préchargement, après dbt build)──► Redis ──► API ──► front
```

Toutes les réponses possibles sont **précalculées** au préchargement : environ 5 200 réponses JSON, compressées en gzip,
publiées dans Redis sous une **version**. Une requête fait un seul `GET` Redis, sans SQL ni sérialisation :
Snowflake n'est jamais appelé pendant une requête. La bascule d'une version à la suivante est atomique et la version
précédente est conservée pour un retour arrière instantané.

| En-tête de réponse | Rôle |
|---|---|
| `ETag` / `If-None-Match` | égal à la version : le navigateur reçoit `304 Not Modified` si rien n'a changé |
| `X-Data-Version` | version du cache qui a servi la réponse |
| `X-Cache`, `X-Cache-Mode` | `HIT` / `NOT-MODIFIED` ; `redis` ou `memoire` (repli si Redis est injoignable) |
| `Server-Timing`, `X-Temps-Traitement-ms` | temps de lecture du cache et temps total côté API |

### Règles d'usage des données

- **NULL veut dire « inconnu ou non applicable », jamais 0.** Un 0 est une vraie valeur (besoin nul). Ne jamais remplacer un NULL par 0.
- Seules les **quantités** s'additionnent (superficies, besoins en t, volumes en m³). Moyennes, probabilités, scores, rangs et valeurs de zone, jamais.
- **Zone et région sont parallèles**, pas emboîtées : agréger par l'une ou l'autre, jamais zone → région.
- Les besoins sont des **références historiques**, pas des prévisions. Aucune dose n'est encore validée par un spécialiste.
- Chaque réponse porte ses limites dans `meta.avertissements`.

Contrat détaillé des colonnes : `docs/contrat-donnees.md`. Estimations indicatives, pas des garanties.
"""

TAGS = [
    {"name": "Référentiels", "description": "Départements, régions, zones, cultures et périodes valides, tirés des marts."},
    {"name": "A · Carte agroclimatique", "description": "Bilan de chaque saison (`MART_CARTE_AGROCLIMAT`), département × campagne."},
    {"name": "A · Suivi décadaire", "description": "Suivi en cours de campagne (`MART_SUIVI_DECADAIRE`), décade par décade."},
    {"name": "B · Choix des cultures", "description": "Adéquation des cycles et des variétés (`MART_CHOIX_CULTURES`)."},
    {"name": "C · Besoins en intrants", "description": "Besoins de référence (`MART_BESOINS`) et totaux additifs."},
    {"name": "D · AgroDistrib", "description": "Critères de répartition des intrants (`MART_TERRITOIRES_AGRODISTRIB`)."},
    {"name": "D · Vulnérabilité", "description": "Score relatif et indicatif (`MART_VULNERABILITE_DEPARTEMENT`, méthode v1)."},
    {"name": "Système et cache", "description": "Santé, état du cache Redis, rafraîchissement et retour arrière (jeton d'administration)."},
]

PARAMETRES_SWAGGER = {
    "docExpansion": "list",
    "defaultModelsExpandDepth": 0,
    "defaultModelExpandDepth": 2,
    "displayRequestDuration": True,
    "filter": True,
    "tryItOutEnabled": True,
    "persistAuthorization": True,
    "requestSnippetsEnabled": True,
    "syntaxHighlight": {"theme": "obsidian"},
}


def installer_swagger(app: FastAPI) -> None:
    @app.get("/docs", include_in_schema=False)
    async def swagger(request: Request) -> HTMLResponse:
        page = get_swagger_ui_html(
            openapi_url=app.openapi_url,
            title=f"{TITRE} · Documentation",
            swagger_ui_parameters=PARAMETRES_SWAGGER,
        )
        html = page.body.decode().replace(
            "</head>", '<link rel="stylesheet" type="text/css" href="/static/swagger-saltis.css"></head>', 1
        )
        return HTMLResponse(html)

