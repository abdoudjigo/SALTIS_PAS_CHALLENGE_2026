"""Application FastAPI : exposition des marts SALTIS servis depuis Redis.

    uvicorn api.main:app --reload            (développement)
    uvicorn api.main:app --workers 4         (plusieurs workers partagent le même cache Redis)
"""

import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from . import __version__
from .cache import CacheIndisponible, ServiceCache
from .config import Parametres, parametres
from .docs import DESCRIPTION, RESUME, TAGS, TITRE, installer_swagger
from .erreurs import ErreurApi, gerer_cache_indisponible, gerer_erreur_api
from .marts import tables_a_lire
from .routes import ROUTEURS, systeme
from .source_snowflake import creer_lecteur

PREFIXE = "/api/v1"
ENTETES_EXPOSES = ["ETag", "X-Data-Version", "X-Cache", "X-Cache-Mode", "Server-Timing", "X-Temps-Traitement-ms"]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s : %(message)s")
logging.getLogger("snowflake").setLevel(logging.ERROR)


def creer_app(p: Parametres | None = None, cache: ServiceCache | None = None) -> FastAPI:
    p = p or parametres()

    @asynccontextmanager
    async def cycle_de_vie(app: FastAPI):
        app.state.cache = cache or ServiceCache(p, creer_lecteur(p, tables_a_lire()))
        await app.state.cache.demarrer()
        yield
        await app.state.cache.arreter()

    app = FastAPI(
        title=TITRE,
        summary=RESUME,
        description=DESCRIPTION,
        version=__version__,
        openapi_tags=TAGS,
        contact={"name": "Équipe AKAI — Assaman & Suuf"},
        docs_url=None,
        redoc_url="/redoc",
        lifespan=cycle_de_vie,
    )
    app.state.parametres = p

    app.add_middleware(
        CORSMiddleware,
        allow_origins=p.cors_origines,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
        expose_headers=ENTETES_EXPOSES,
    )

    @app.middleware("http")
    async def chronometrer(request: Request, call_next):
        debut = time.perf_counter()
        reponse = await call_next(request)
        reponse.headers["X-Temps-Traitement-ms"] = f"{(time.perf_counter() - debut) * 1000:.2f}"
        return reponse

    app.add_exception_handler(ErreurApi, gerer_erreur_api)
    app.add_exception_handler(CacheIndisponible, gerer_cache_indisponible)

    for routeur in ROUTEURS:
        app.include_router(routeur, prefix=PREFIXE)
    app.include_router(systeme, prefix=PREFIXE)

    app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")
    installer_swagger(app)

    @app.get("/", include_in_schema=False)
    async def accueil() -> RedirectResponse:
        return RedirectResponse("/docs")

    return app


app = creer_app()
