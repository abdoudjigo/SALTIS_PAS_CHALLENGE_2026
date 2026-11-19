"""Routes du Cadre harmonisé (MART_CADRE_HARMONISE_DEPARTEMENT) et des prix des intrants (DIM_PRIX_INTRANT).

Marts facultatifs : tant que dbt ne les a pas construits, les routes répondent 404 (`cadre_harmonise_indisponible`,
`prix_indisponible`) sans gêner les autres routes.
"""

import json
from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Query, Request

from ..cache import cles
from ..cache.construction import Index
from ..erreurs import ErreurApi, reponses_erreurs
from ..schemas import CadreHarmonise, PrixIntrant, Reponse
from ..schemas.cadre_harmonise import MENTION_TERMINEE
from .outils import CodeDepartement, exiger_departement, servir

ERREURS = reponses_erreurs(404, 503)

# ============================================================ Cadre harmonisé

cadre_harmonise = APIRouter(prefix="/cadre-harmonise", tags=["F · Cadre harmonisé"])


def _ch_disponible(index: Index) -> None:
    if not index.a_cadre_harmonise:
        raise ErreurApi(404, "cadre_harmonise_indisponible", "Le Cadre harmonisé n'est pas encore construit dans SALTIS.MARTS.",
                        "Mart construit par dbt : mart_cadre_harmonise_departement.")


def _aujourdhui() -> date:
    return datetime.now(timezone.utc).date()  # heure du Sénégal = UTC


def _periode_terminee(aujourdhui: date):
    """Recalcule `periode_terminee` à la requête (le cache peut dater de plusieurs jours)."""

    def recalculer(ligne: dict) -> None:
        fin = ligne.get("date_fin_periode_retenue")
        terminee = None if fin is None else date.fromisoformat(fin) < aujourdhui
        ligne["periode_terminee"] = terminee
        ligne["mention_periode"] = MENTION_TERMINEE if terminee else None

    def transformer(contenu: bytes) -> bytes:
        corps = json.loads(contenu)
        donnees = corps["donnees"]
        for ligne in donnees if isinstance(donnees, list) else [donnees]:
            recalculer(ligne)
        return json.dumps(corps, ensure_ascii=False, separators=(",", ":")).encode()

    return transformer


@cadre_harmonise.get("", response_model=Reponse[list[CadreHarmonise]], responses=ERREURS,
                     summary="Cadre harmonisé : phase de chaque département, dernier cycle")
async def cadre_harmonise_carte(request: Request):
    """Phase courante, phase projetée et période retenue (phase, personnes en phases 3 à 5, libellé), par département.
    Couleurs officielles des phases : `GET /referentiels/phases-cadre-harmonise`."""
    jour = _aujourdhui()
    return await servir(request, cles.cadre_harmonise(None), _ch_disponible, _periode_terminee(jour), f"-{jour:%Y%m%d}")


@cadre_harmonise.get("/{code_departement}", response_model=Reponse[CadreHarmonise], responses=ERREURS,
                     summary="Cadre harmonisé d'un département")
async def cadre_harmonise_departement(request: Request, code_departement: CodeDepartement):
    def valider(index: Index) -> None:
        _ch_disponible(index)
        exiger_departement(index, code_departement)

    jour = _aujourdhui()
    return await servir(request, cles.cadre_harmonise(code_departement), valider, _periode_terminee(jour), f"-{jour:%Y%m%d}")


# ============================================================ Prix des intrants

prix = APIRouter(prefix="/prix-intrants", tags=["C · Besoins en intrants"])


@prix.get("", response_model=Reponse[list[PrixIntrant]], responses=ERREURS, summary="Prix des intrants (cession, subvention, coût réel)")
async def prix_intrants(
    request: Request,
    campagne: Annotated[int | None, Query(ge=1900, le=2100, description="Campagne ; absente = toutes", examples=[2026])] = None,
):
    """Prix de cession, subvention et coût réel par sac de 50 kg, avec statut et source. Prix NULL = à saisir."""

    def valider(index: Index) -> None:
        if not index.campagnes_prix:
            raise ErreurApi(404, "prix_indisponible", "Les prix des intrants ne sont pas encore construits dans SALTIS.MARTS.",
                            "Table construite par dbt : dim_prix_intrant.")
        if campagne is not None and campagne not in index.campagnes_prix:
            raise ErreurApi(404, "campagne_inconnue", f"Aucun prix pour la campagne {campagne}.",
                            f"Campagnes disponibles : {', '.join(map(str, index.campagnes_prix))}")

    return await servir(request, cles.prix_intrants(campagne), valider)
