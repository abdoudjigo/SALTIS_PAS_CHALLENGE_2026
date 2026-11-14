"""Routes de données : chaque route sert une réponse précalculée du cache (aucun appel à Snowflake)."""

from typing import Annotated

from fastapi import APIRouter, Path, Query, Request

from ..cache import cles
from ..cache.construction import Index
from ..erreurs import ErreurApi, reponses_erreurs
from ..schemas import (
    Agregat,
    Besoin,
    CarteAgroclimat,
    ChoixCulture,
    CultureRef,
    DepartementRef,
    Periodes,
    RegionRef,
    Reponse,
    SuiviDecadaire,
    TerritoireAgrodistrib,
    Vulnerabilite,
    ZoneRef,
)
from ..schemas.commun import NiveauAgregat
from .outils import AIDE_PERIODES, CodeDepartement, FiltreCulture, exiger_departement, resoudre_culture, servir

ERREURS = reponses_erreurs(404, 503)
Niveau = Annotated[
    NiveauAgregat,
    Query(description="Niveau d'agrégation : `NATIONAL`, `REGION` (code GADM) ou `ZONE` agroécologique"),
]

# ============================================================ Référentiels

referentiels = APIRouter(prefix="/referentiels", tags=["Référentiels"])


@referentiels.get("/departements", response_model=Reponse[list[DepartementRef]], responses=reponses_erreurs(503),
                  summary="Les 45 départements")
async def lister_departements(request: Request):
    """Codes GADM, noms, région et zone de chaque département, avec la disponibilité du suivi décadaire et du score de vulnérabilité."""
    return await servir(request, cles.ref("departements"))


@referentiels.get("/regions", response_model=Reponse[list[RegionRef]], responses=reponses_erreurs(503),
                  summary="Les 14 régions")
async def lister_regions(request: Request):
    """Une région peut couvrir deux zones agroécologiques (Louga, Matam, Tambacounda) : zone et région sont parallèles."""
    return await servir(request, cles.ref("regions"))


@referentiels.get("/zones", response_model=Reponse[list[ZoneRef]], responses=reponses_erreurs(503),
                  summary="Les 6 zones agroécologiques")
async def lister_zones(request: Request):
    return await servir(request, cles.ref("zones"))


@referentiels.get("/cultures", response_model=Reponse[list[CultureRef]], responses=reponses_erreurs(503),
                  summary="Les cultures documentées")
async def lister_cultures(request: Request):
    """Libellés exacts des cultures. Les filtres `culture` acceptent aussi une saisie sans accent (« mais », « niebe »)."""
    return await servir(request, cles.ref("cultures"))


@referentiels.get("/periodes", response_model=Reponse[Periodes], responses=reponses_erreurs(503),
                  summary="Campagnes et années disponibles")
async def lister_periodes(request: Request):
    return await servir(request, cles.ref("periodes"))


# ============================================================ Module A : carte agroclimatique

agroclimat = APIRouter(prefix="/agroclimat", tags=["A · Carte agroclimatique"])


def _exiger_campagne(campagne: int):
    def valider(index: Index) -> None:
        if campagne not in index.campagnes:
            raise ErreurApi(404, "campagne_inconnue", f"Campagne {campagne} absente ({index.campagnes[0]}-{index.campagnes[-1]}).",
                            AIDE_PERIODES)

    return valider


@agroclimat.get("/campagnes/{campagne}", response_model=Reponse[list[CarteAgroclimat]], responses=ERREURS,
                summary="Carte d'une campagne (45 départements)")
async def carte_campagne(request: Request, campagne: Annotated[int, Path(ge=1900, le=2100, examples=[2024])]):
    """Bilan de la saison pour chaque département : pluie, anomalie, démarrage, séquences sèches, alertes, `risque_saison`,
    vulnérabilité. **Source de référence pour le bilan d'une saison.**"""
    return await servir(request, cles.carte_campagne(campagne), _exiger_campagne(campagne))


@agroclimat.get("/departements/{code_departement}", response_model=Reponse[list[CarteAgroclimat]], responses=ERREURS,
                summary="Historique des saisons d'un département (1981-2025)")
async def carte_departement(request: Request, code_departement: CodeDepartement):
    return await servir(request, cles.carte_departement(code_departement), lambda i: exiger_departement(i, code_departement))


# ============================================================ Module A : suivi décadaire

suivi = APIRouter(prefix="/suivi-decadaire", tags=["A · Suivi décadaire"])


@suivi.get("/{code_departement}/{annee}", response_model=Reponse[list[SuiviDecadaire]], responses=ERREURS,
           summary="Pluie décade par décade, comparée à la normale")
async def suivi_decadaire(
    request: Request,
    code_departement: CodeDepartement,
    annee: Annotated[int, Path(ge=1900, le=2100, description="Année civile", examples=[2025])],
    saison_seulement: Annotated[bool, Query(description="Seulement les décades 16 à 30 (juin-octobre)")] = False,
):
    """Observé, normale 1991-2020 et écart, décade et cumul depuis juin, avec la fourchette climatologique
    (1 année sur 5, médiane, 4 années sur 5). Guédiawaye est absent de la source."""

    def valider(index: Index) -> None:
        exiger_departement(index, code_departement)
        if code_departement not in index.departements_suivi:
            raise ErreurApi(404, "suivi_indisponible",
                            f"{index.departements[code_departement]} est absent du suivi décadaire (aucune série dans la source).")
        if annee not in index.annees_suivi:
            raise ErreurApi(404, "annee_inconnue", f"Année {annee} absente ({index.annees_suivi[0]}-{index.annees_suivi[-1]}).",
                            AIDE_PERIODES)

    return await servir(request, cles.suivi(code_departement, annee, saison_seulement), valider)


# ============================================================ Module B : choix des cultures

cultures = APIRouter(prefix="/choix-cultures", tags=["B · Choix des cultures"])


@cultures.get("/{code_departement}", response_model=Reponse[list[ChoixCulture]], responses=ERREURS,
              summary="Cycles et variétés adaptés à un département")
async def choix_cultures(request: Request, code_departement: CodeDepartement, culture: FiltreCulture = None):
    """Pour chaque culture : options de cycle (courte, moyenne, longue) et variétés documentées, classées par
    `rang_option`. **Comparer les options sur `proba_cycle_couvert_pct`, pas sur le score.**"""

    def cle(index: Index) -> str:
        exiger_departement(index, code_departement)
        return cles.cultures(code_departement, resoudre_culture(index, culture))

    return await servir(request, cle)


# ============================================================ Module C : besoins

besoins = APIRouter(prefix="/besoins", tags=["C · Besoins en intrants"])


@besoins.get("/departements/{code_departement}", response_model=Reponse[list[Besoin]], responses=ERREURS,
             summary="Besoins de référence d'un département")
async def besoins_departement(request: Request, code_departement: CodeDepartement, culture: FiltreCulture = None):
    """Superficie de référence × dose de la zone. **Historique, pas prévisionnel.** Dose inconnue → NULL
    (« dose à saisir »), jamais 0. Guédiawaye et Pikine : une ligne « pas de superficie agricole de référence »."""

    def cle(index: Index) -> str:
        exiger_departement(index, code_departement)
        return cles.besoins(code_departement, resoudre_culture(index, culture))

    return await servir(request, cle)


@besoins.get("/totaux", response_model=Reponse[list[Agregat]], responses=ERREURS,
             summary="Totaux des besoins : national, par région ou par zone")
async def besoins_totaux(request: Request, niveau: Niveau = "NATIONAL", culture: FiltreCulture = None):
    """Somme des départements, **colonnes additives seulement** (superficie, besoins en t, irrigation en m³).
    Les NULL sont exclus de la somme et comptés dans `valeurs_manquantes` : le total est alors partiel."""
    return await servir(request, lambda index: cles.besoins_totaux(niveau, resoudre_culture(index, culture)))


# ============================================================ Module D : AgroDistrib

agrodistrib = APIRouter(prefix="/agrodistrib", tags=["D · AgroDistrib"])


@agrodistrib.get("/territoires", response_model=Reponse[list[TerritoireAgrodistrib]], responses=ERREURS,
                 summary="Critères de répartition par département × culture")
async def agrodistrib_territoires(request: Request, culture: FiltreCulture = None):
    """Besoin, potentiel de gain (valeur de zone), capacité à valoriser, sol et vulnérabilité, là où la culture
    existe (superficie > 0). Seuls superficie et besoins s'additionnent."""
    return await servir(request, lambda index: cles.agrodistrib_territoires(resoudre_culture(index, culture)))


@agrodistrib.get("/agregats", response_model=Reponse[list[Agregat]], responses=ERREURS,
                 summary="Besoins agrégés au niveau de répartition choisi")
async def agrodistrib_agregats(request: Request, niveau: Niveau = "REGION", culture: FiltreCulture = None):
    """Base de la répartition multi-niveaux : besoins de la zone ou de la région = **somme de ses départements**
    (jamais une valeur de zone recopiée puis additionnée)."""
    return await servir(request, lambda index: cles.agrodistrib_agregats(niveau, resoudre_culture(index, culture)))


# ============================================================ Module D : vulnérabilité

vulnerabilite = APIRouter(prefix="/vulnerabilite", tags=["D · Vulnérabilité"])


@vulnerabilite.get("", response_model=Reponse[list[Vulnerabilite]], responses=reponses_erreurs(503),
                   summary="Classement des départements")
async def vulnerabilite_classement(request: Request):
    """Du plus vulnérable au moins vulnérable (`rang_vulnerabilite`), départements non notés en fin de liste.
    Score **relatif et indicatif** : 60 % aléa sécheresse, 40 % sensibilité des rendements."""
    return await servir(request, cles.vulnerabilite_classement())


@vulnerabilite.get("/{code_departement}", response_model=Reponse[Vulnerabilite], responses=ERREURS,
                   summary="Détail de la vulnérabilité d'un département")
async def vulnerabilite_departement(request: Request, code_departement: CodeDepartement):
    return await servir(request, cles.vulnerabilite_departement(code_departement), lambda i: exiger_departement(i, code_departement))


ROUTEURS = [referentiels, agroclimat, suivi, cultures, besoins, agrodistrib, vulnerabilite]
