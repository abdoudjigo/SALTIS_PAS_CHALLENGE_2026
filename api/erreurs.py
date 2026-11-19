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


async def gerer_erreur_inattendue(_: Request, exc: Exception) -> JSONResponse:
    # Le détail (trace) part dans les journaux du serveur, jamais dans la réponse.
    return _reponse(500, "erreur_interne", "Erreur interne du serveur.", "Réessayer ; si l'erreur persiste, prévenir l'équipe.")


def reponses_erreurs(*statuts: int) -> dict[int | str, dict]:
    descriptions = {
        401: "Jeton d'administration absent ou invalide",
        403: "Administration désactivée (API_ADMIN_TOKEN non défini)",
        404: "Territoire, culture ou période inconnu",
        409: "Préchargement déjà en cours",
        413: "Audio trop long (30 secondes au plus)",
        429: "Trop de requêtes depuis cette adresse (voir l'en-tête Retry-After)",
        422: "Audio vide ou rien d'entendu",
        502: "Envoi de l'avis par e-mail échoué",
        503: "Cache pas encore prêt (préchargement en cours) ou indisponible ; voix wolof non configurée ; envoi des avis non configuré",
    }
    return {s: {"model": ReponseErreur, "description": descriptions[s]} for s in statuts}
