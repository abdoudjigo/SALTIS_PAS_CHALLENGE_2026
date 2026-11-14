"""Erreurs de l'API, toutes au format `{"erreur": {"code", "message", "aide"}}`."""

from fastapi import Request
from fastapi.responses import JSONResponse

from .cache import CacheIndisponible
from .schemas import ReponseErreur


class ErreurApi(Exception):
    def __init__(self, statut: int, code: str, message: str, aide: str | None = None, entetes: dict[str, str] | None = None):
        self.statut, self.code, self.message, self.aide, self.entetes = statut, code, message, aide, entetes


def _reponse(statut: int, code: str, message: str, aide: str | None, entetes: dict[str, str] | None = None) -> JSONResponse:
    corps = {"erreur": {"code": code, "message": message, "aide": aide}}
    return JSONResponse(corps, status_code=statut, headers=entetes)


async def gerer_erreur_api(_: Request, exc: ErreurApi) -> JSONResponse:
    return _reponse(exc.statut, exc.code, exc.message, exc.aide, exc.entetes)


async def gerer_cache_indisponible(_: Request, exc: CacheIndisponible) -> JSONResponse:
    return _reponse(503, "cache_indisponible", str(exc), "Réessayer dans quelques secondes ; état : GET /api/v1/systeme/cache",
                    {"Retry-After": "10"})


def reponses_erreurs(*statuts: int) -> dict[int | str, dict]:
    descriptions = {
        401: "Jeton d'administration absent ou invalide",
        403: "Administration désactivée (API_ADMIN_TOKEN non défini)",
        404: "Territoire, culture ou période inconnu",
        409: "Préchargement déjà en cours",
        503: "Cache pas encore prêt (préchargement en cours) ou indisponible",
    }
    return {s: {"model": ReponseErreur, "description": descriptions[s]} for s in statuts}
