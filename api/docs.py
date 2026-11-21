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
| **C** · Besoins | Combien d'intrants, à quel prix ? | `/besoins`, `/prix-intrants` |
| **D** · AgroDistrib | Comment répartir les intrants ? | `/agrodistrib`, `/vulnerabilite` |
| **F** · Cadre harmonisé | Où l'insécurité alimentaire est-elle forte ? | `/cadre-harmonise` |
| **E** · Opportunités | Où semer court ou long, où produire toute l'année, où investir ? | `/opportunites` |

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

Contrat détaillé des colonnes : `docs/technique/contrat-donnees.md`. Estimations indicatives, pas des garanties.
"""

TAGS = [
    {"name": "Référentiels", "description": "Départements, régions, zones, cultures et périodes valides, tirés des marts."},
    {"name": "A · Carte agroclimatique", "description": "Bilan de chaque saison (`MART_CARTE_AGROCLIMAT`), département × campagne."},
    {"name": "A · Suivi décadaire", "description": "Suivi en cours de campagne (`MART_SUIVI_DECADAIRE`), décade par décade."},
    {"name": "B · Choix des cultures", "description": "Adéquation des cycles et des variétés (`MART_CHOIX_CULTURES`)."},
    {"name": "C · Besoins en intrants", "description": "Besoins de référence (`MART_BESOINS`), totaux additifs et prix des "
     "intrants (`DIM_PRIX_INTRANT`, facultatif : 404 `prix_indisponible` tant qu'il n'est pas construit)."},
    {"name": "D · AgroDistrib", "description": "Critères de répartition des intrants (`MART_TERRITOIRES_AGRODISTRIB`)."},
    {"name": "D · Vulnérabilité", "description": "Score relatif et indicatif (`MART_VULNERABILITE_DEPARTEMENT`, méthode v1)."},
    {"name": "E · Opportunités", "description": "Carte à trois couleurs (`MART_CARTE_OPPORTUNITES`) : jaune saison courte, "
     "vert saison longue, bleu eau mobilisable en saison sèche. Conseils agriculteur et investisseur. "
     "Voir `docs/technique/carte-opportunites.md`."},
    {"name": "F · Cadre harmonisé", "description": "Phase d'insécurité alimentaire (CILSS) par département, dernier cycle "
     "(`MART_CADRE_HARMONISE_DEPARTEMENT`, facultatif : 404 `cadre_harmonise_indisponible`). Licence CC BY. "
     "Couleurs : `/referentiels/phases-cadre-harmonise`."},
    {"name": "IA · Prévisions", "description": "Résultats des 3 modèles d'IA (`SALTIS.ML`) : saison qui vient, "
     "rendement et alerte récolte, date de semis, et leur fiabilité. Voir `ml/MODELES.md`."},
    {"name": "IA · Voix", "description": "Question parlée (wolof) ou écrite (français) → réponse courte tirée des données, "
     "en français et en wolof, avec la vue de la carte à afficher. Voir `voix/README.md`."},
    {"name": "Avis", "description": "`POST /avis` : avis des ONG envoyé à l'équipe par e-mail (SMTP), sans stockage. "
     "Tout est facultatif ; 5 envois par adresse et par 10 minutes ; 503 si l'envoi n'est pas configuré, 502 s'il échoue."},
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

