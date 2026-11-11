"""Santé de l'API, état du cache Redis et administration (rafraîchissement, retour arrière)."""

import secrets
from typing import Annotated

from fastapi import APIRouter, Request, Security
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader

from ..erreurs import ErreurApi, reponses_erreurs
from ..schemas import EtatCache, Sante, Tache
from .outils import service

systeme = APIRouter(prefix="/systeme", tags=["Système et cache"])

entete_admin = APIKeyHeader(
    name="X-Admin-Token", auto_error=False, scheme_name="Jeton d'administration",
    description="Valeur de `API_ADMIN_TOKEN` (fichier `.env`). Sans cette variable, l'administration est désactivée.",
)


async def exiger_admin(request: Request, jeton: Annotated[str | None, Security(entete_admin)]) -> None:
    attendu = request.app.state.parametres.api_admin_token.get_secret_value()
    if not attendu:
        raise ErreurApi(403, "administration_desactivee", "Administration désactivée : API_ADMIN_TOKEN n'est pas défini.")
    if not jeton or not secrets.compare_digest(jeton.encode(), attendu.encode()):
        raise ErreurApi(401, "jeton_invalide", "Jeton d'administration absent ou invalide.", "En-tête X-Admin-Token")


@systeme.get("/sante", response_model=Sante, summary="Santé de l'API",
             responses={503: {"model": Sante, "description": "Aucune donnée servie pour l'instant"}})
async def sante(request: Request):
    """200 quand des données sont servies, 503 sinon. Ne contacte jamais Snowflake."""
    cache = service(request)
    etat = await cache.etat()
    redis_ok = None
    if etat.mode == "redis":
        try:
            redis_ok = await cache.stockage.ping()
        except Exception:  # noqa: BLE001
            redis_ok = False
    pret = etat.version_active is not None
    corps = Sante(statut="ok" if pret else "degrade", cache=etat.statut, mode=etat.mode,
                  version_active=etat.version_active, redis_joignable=redis_ok)
    return JSONResponse(corps.model_dump(), status_code=200 if pret else 503)


@systeme.get("/cache", response_model=EtatCache, summary="État du cache")
async def etat_cache(request: Request):
    """Version active, versions conservées pour le retour arrière, nombre de réponses précalculées, volume,
    durées de lecture Snowflake, de construction et de publication dans Redis."""
    return await service(request).etat()


@systeme.post("/cache/rafraichir", response_model=Tache, status_code=202, dependencies=[Security(exiger_admin)],
              responses=reponses_erreurs(401, 403, 409), summary="Relire les marts et publier une nouvelle version")
async def rafraichir(request: Request):
    """À lancer après un `dbt build`. Le préchargement tourne en tâche de fond : la version en place reste servie
    jusqu'à la bascule atomique. Si l'API était en repli mémoire, Redis est d'abord retenté."""
    cache = service(request)
    if cache.prechargement_en_cours():
        raise ErreurApi(409, "prechargement_en_cours", "Un préchargement est déjà en cours.", "Suivi : GET /api/v1/systeme/cache")
    retour_redis = await cache.reessayer_redis()
    cache.lancer_prechargement("api")
    message = "Préchargement lancé" + (" (retour sur Redis)" if retour_redis else "")
    return Tache(message=message, statut="en_cours")


@systeme.post("/cache/retour-arriere", response_model=EtatCache, dependencies=[Security(exiger_admin)],
              responses=reponses_erreurs(401, 403, 404), summary="Revenir à la version précédente")
async def retour_arriere(request: Request):
    """Réactive instantanément la version précédente (conservée dans Redis), sans relire Snowflake."""
    cache = service(request)
    if await cache.retour_arriere() is None:
        raise ErreurApi(404, "aucune_version_precedente", "Aucune version précédente n'est conservée.")
    return await cache.etat()
