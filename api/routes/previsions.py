"""Routes des modèles d'IA (SALTIS.ML) : réponses précalculées du cache, comme les marts.

Tant que les résultats ne sont pas chargés dans SALTIS.ML, chaque route répond 404 `prevision_indisponible`.
Méthodes et fiabilité : ml/MODELES.md.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Path, Query, Request

from ..cache import cles
from ..cache.construction import Index
from ..erreurs import ErreurApi, reponses_erreurs
from ..schemas import (
    EvaluationModele,
    PrevisionRendement,
    PrevisionSaison,
    Reponse,
    RisqueSemis,
)
from ..schemas.previsions import Moment
from .outils import CodeDepartement, FiltreCulture, exiger_departement, servir

ERREURS = reponses_erreurs(404, 503)
AIDE_ML = "Les résultats des modèles sont chargés par ml/charger_snowflake.py (voir ml/MODELES.md)."

Annee = Annotated[int, Path(ge=1900, le=2100, examples=[2024])]
MomentQuery = Annotated[Moment | None, Query(description="Moment de la prévision ; absent = les quatre")]

previsions = APIRouter(prefix="/previsions", tags=["IA · Prévisions"])


def _disponible(valeurs: list, modele: str) -> None:
    if not valeurs:
        raise ErreurApi(404, "prevision_indisponible", f"Résultats du {modele} non chargés dans SALTIS.ML.", AIDE_ML)


def _exiger_annee(annee: int, annees: list[int], modele: str) -> None:
    _disponible(annees, modele)
    if annee not in annees:
        raise ErreurApi(404, "annee_inconnue", f"Année {annee} absente du {modele} ({annees[0]}-{annees[-1]}).")


def _culture(culture: str | None, disponibles: list[str], modele: str) -> str | None:
    """Culture couverte par le modèle, sans tenir compte des accents ni de la casse (« mil (souna) » = « MIL (SOUNA) »)."""
    if culture is None:
        return None
    _disponible(disponibles, modele)
    canonique = next((c for c in disponibles if cles.normaliser(c) == cles.normaliser(culture)), None)
    if canonique is None:
        raise ErreurApi(404, "culture_non_modelisee", f"« {culture} » n'est pas couverte par le {modele}.",
                        f"Cultures couvertes : {', '.join(disponibles)}")
    return canonique


# ============================================================ Modèle 1 : la saison qui vient


@previsions.get("/saison/{annee}", response_model=Reponse[list[PrevisionSaison]], responses=ERREURS,
                summary="La saison qui vient : prévision de fin mai (45 départements)")
async def saison_annee(request: Request, annee: Annee):
    """Probabilités sèche / normale / humide et pluie prévue avec sa fourchette. **Modèle 1.**
    Les probabilités sont les mêmes pour tout le pays une année donnée ; la pluie prévue part de la normale du département."""
    return await servir(request, cles.prev_saison_annee(annee), lambda i: _exiger_annee(annee, i.annees_prev_saison, "modèle 1"))


@previsions.get("/saison/departements/{code_departement}", response_model=Reponse[list[PrevisionSaison]], responses=ERREURS,
                summary="Prévisions de saison d'un département, année par année")
async def saison_departement(request: Request, code_departement: CodeDepartement):
    def valider(index: Index) -> None:
        exiger_departement(index, code_departement)
        _disponible(index.annees_prev_saison, "modèle 1")

    return await servir(request, cles.prev_saison_departement(code_departement), valider)


# ============================================================ Modèle 3 : quelle culture / alerte récolte


@previsions.get("/rendement/{code_departement}/{annee}", response_model=Reponse[list[PrevisionRendement]], responses=ERREURS,
                summary="Quelle culture : rendement attendu par culture")
async def rendement(request: Request, code_departement: CodeDepartement, annee: Annee, culture: FiltreCulture = None):
    """Fourchette de rendement (année difficile / médiane / bonne année) aux quatre moments. **Modèle 3.**
    Là où `rendement_fiable` est faux, c'est la récolte habituelle du département, pas une prévision de l'année."""

    def cle(index: Index) -> str:
        exiger_departement(index, code_departement)
        _exiger_annee(annee, index.annees_prev_rendement, "modèle 3")
        return cles.rendement(code_departement, annee, _culture(culture, index.cultures_prev_rendement, "modèle 3"))

    return await servir(request, cle)


@previsions.get("/alerte-recolte/{annee}", response_model=Reponse[list[PrevisionRendement]], responses=ERREURS,
                summary="Alerte récolte : départements où la récolte risque de chuter")
async def alerte_recolte(
    request: Request,
    annee: Annee,
    moment: Annotated[Moment, Query(description="Moment de la prévision")] = "FIN_JUILLET",
    culture: FiltreCulture = None,
):
    """Tous les départements, du risque de chute le plus fort au plus faible. **Modèle 3.**
    Prévision de l'année seulement là où `alerte_fiable` est vrai (arachide, fin juillet et fin août) ; ailleurs, classement relatif."""

    def cle(index: Index) -> str:
        _exiger_annee(annee, index.annees_prev_rendement, "modèle 3")
        return cles.alerte_recolte(annee, moment, _culture(culture, index.cultures_prev_rendement, "modèle 3"))

    return await servir(request, cle)


# ============================================================ Modèle 4 : quand semer


AnneeSemis = Annotated[int | None, Query(ge=1900, le=2100, description="Année (2016-2025) ; absente = année type")]


@previsions.get("/semis/departements/{code_departement}", response_model=Reponse[list[RisqueSemis]], responses=ERREURS,
                summary="Quand semer : risque de chaque décade de semis")
async def semis_departement(request: Request, code_departement: CodeDepartement, annee: AnneeSemis = None,
                            culture: FiltreCulture = None):
    """Pour chaque culture pluviale et chaque décade (1re de juin → 2e d'août) : risque de faux départ,
    risque de fin de saison trop tôt, risque total et décade conseillée. **Modèle 4.**"""

    def cle(index: Index) -> str:
        exiger_departement(index, code_departement)
        _disponible(index.cultures_semis, "modèle 4")
        if annee is not None:
            _exiger_annee(annee, index.annees_semis, "modèle 4")
        return cles.semis(code_departement, annee, _culture(culture, index.cultures_semis, "modèle 4"))

    return await servir(request, cle)


@previsions.get("/semis/carte", response_model=Reponse[list[RisqueSemis]], responses=ERREURS,
                summary="Quand semer : la décade conseillée dans chaque département")
async def semis_carte(
    request: Request,
    culture: Annotated[str, Query(min_length=2, max_length=60, description="Culture (sans tenir compte des accents)",
                                  examples=["ARACHIDE"])],
    annee: AnneeSemis = None,
):
    def cle(index: Index) -> str:
        _disponible(index.cultures_semis, "modèle 4")
        if annee is not None:
            _exiger_annee(annee, index.annees_semis, "modèle 4")
        return cles.semis_carte(annee, _culture(culture, index.cultures_semis, "modèle 4"))

    return await servir(request, cle)


# ============================================================ Fiabilité


@previsions.get("/fiabilite", response_model=Reponse[list[EvaluationModele]], responses=ERREURS,
                summary="Fiabilité des modèles, comparée à une prévision simple")
async def fiabilite(request: Request,
                    modele: Annotated[Literal["M1", "M3", "M4"] | None, Query(description="Un seul modèle")] = None):
    return await servir(request, cles.evaluation(modele), lambda i: _disponible([True] if i.a_evaluation else [], "modèle"))
