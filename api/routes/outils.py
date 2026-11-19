"""Service d'une réponse précalculée : un GET dans le cache, ETag / 304, gzip, en-têtes de diagnostic."""

import gzip
import time
from typing import Annotated, Callable

from fastapi import Path, Query, Request, Response

from ..cache import ServiceCache
from ..cache.construction import Index
from ..erreurs import ErreurApi

AIDE_DEPARTEMENTS = "Liste : GET /api/v1/referentiels/departements"
AIDE_CULTURES = "Liste : GET /api/v1/referentiels/cultures"
AIDE_PERIODES = "Liste : GET /api/v1/referentiels/periodes"

CodeDepartement = Annotated[
    str,
    Path(
        description="Code GADM du département",
        pattern=r"^SEN\.\d{1,2}\.\d{1,2}_1$",
        examples=["SEN.7.1_1"],
        openapi_examples={
            "kolda": {"summary": "Kolda", "value": "SEN.7.1_1"},
            "dakar": {"summary": "Dakar", "value": "SEN.1.1_1"},
            "saint_louis": {"summary": "Saint-Louis", "value": "SEN.10.3_1"},
            "kaffrine": {"summary": "Kaffrine", "value": "SEN.4.2_1"},
        },
    ),
]
FiltreCulture = Annotated[
    str | None,
    Query(
        description="Culture, sans tenir compte des accents ni de la casse (« mais » = « MAÏS »)",
        min_length=2,
        max_length=60,
        openapi_examples={
            "mil": {"summary": "Mil", "value": "MIL (SOUNA)"},
            "mais": {"summary": "Maïs (sans accent)", "value": "mais"},
        },
    ),
]


def service(request: Request) -> ServiceCache:
    return request.app.state.cache


def exiger_departement(index: Index, code: str) -> None:
    if code not in index.departements:
        raise ErreurApi(404, "departement_inconnu", f"Département {code} inconnu.", AIDE_DEPARTEMENTS)


def resoudre_culture(index: Index, culture: str | None) -> str | None:
    if culture is None:
        return None
    canonique = index.resoudre_culture(culture)
    if canonique is None:
        raise ErreurApi(404, "culture_inconnue", f"Culture « {culture} » inconnue.", f"{AIDE_CULTURES} ({', '.join(index.cultures)})")
    return canonique


async def servir(
    request: Request,
    cle: Callable[[Index], str] | str,
    valider: Callable[[Index], None] | None = None,
    transformer: Callable[[bytes], bytes] | None = None,
    suffixe_etag: str = "",
) -> Response:
    """Valide les paramètres avec l'index de la version active, puis sert la réponse stockée.

    `transformer` (facultatif) réécrit le JSON stocké à la requête (ex. un état qui dépend de la date du jour) ;
    `suffixe_etag` distingue alors les variantes dans l'ETag."""
    debut = time.perf_counter()
    cache = service(request)
    version, index = await cache.etat_actif()
    if valider:
        valider(index)
    cle_finale = cle(index) if callable(cle) else cle

    max_age = request.app.state.parametres.http_max_age_s
    entetes = {
        "ETag": f'W/"{version}{suffixe_etag}"',
        "Cache-Control": f"public, max-age={max_age}, stale-while-revalidate={max_age * 5}",
        "Vary": "Accept-Encoding",
        "X-Data-Version": version,
        "X-Cache-Mode": cache.stockage.mode,
    }
    if entetes["ETag"] in request.headers.get("if-none-match", ""):
        entetes["X-Cache"] = "NOT-MODIFIED"
        return Response(status_code=304, headers=entetes)

    trouve = await cache.lire(version, cle_finale)
    if trouve is None:
        raise ErreurApi(404, "aucune_donnee", "Aucune donnée pour cette combinaison de paramètres.", AIDE_DEPARTEMENTS)
    contenu, compresse, version_servie = trouve
    if version_servie != version:
        entetes["ETag"], entetes["X-Data-Version"] = f'W/"{version_servie}{suffixe_etag}"', version_servie

    if transformer:
        contenu = transformer(gzip.decompress(contenu) if compresse else contenu)
        compresse = False
    if compresse and "gzip" in request.headers.get("accept-encoding", "").lower():
        entetes["Content-Encoding"] = "gzip"
    elif compresse:
        contenu = gzip.decompress(contenu)
    entetes["X-Cache"] = "HIT"
    entetes["Server-Timing"] = f"cache;desc=\"{cache.stockage.mode}\";dur={(time.perf_counter() - debut) * 1000:.2f}"
    return Response(content=contenu, media_type="application/json", headers=entetes)
