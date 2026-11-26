"""Routes de l'Observatoire Sénégal 2050 (MART_OBSERVATOIRE_SERIES et MART_OBSERVATOIRE_OBJECTIFS).

Réponses précalculées dans le cache : aucune requête Snowflake pendant une requête. Marts facultatifs : tant que dbt
ne les a pas construits, les routes répondent 404 `observatoire_indisponible`.
Règles : valeur absente = null (jamais 0) ; FAOSTAT est une série distincte ; aucune prévision.
"""

from typing import Annotated

from fastapi import APIRouter, Query, Request

from ..cache import cles
from ..cache.construction import Index
from ..cache.cles import normaliser
from ..erreurs import ErreurApi, reponses_erreurs
from ..schemas import Reponse
from ..schemas.observatoire import (
    CarteDepartement,
    ClassementDepartement,
    FiltresObservatoire,
    Indicateur,
    IndicateursObservatoire,
    ObjectifsObservatoire,
    SerieObservatoireReponse,
)
from .outils import servir

ERREURS = reponses_erreurs(404, 503)
observatoire = APIRouter(prefix="/observatoire", tags=["G · Observatoire"])

CultureObligatoire = Annotated[
    str,
    Query(min_length=2, max_length=60, description="Culture, sans tenir compte des accents ni de la casse (« mil », « mais », « riz »)",
          openapi_examples={"mil": {"summary": "Mil", "value": "mil"}, "arachide": {"summary": "Arachide", "value": "arachide"},
                            "riz": {"summary": "Riz", "value": "riz"}}),
]
Zone = Annotated[
    str,
    Query(min_length=3, max_length=20, description="`SEN` (pays), code région (`SEN.4_1`) ou code département (`SEN.4.2_1`)",
          openapi_examples={"pays": {"summary": "Pays", "value": "SEN"}, "kaffrine": {"summary": "Kaffrine (département)", "value": "SEN.4.2_1"}}),
]
Annee = Annotated[int, Query(ge=1981, le=2024, description="Année (campagne agricole) : 1981-2021 par département, FAOSTAT jusqu'en 2024")]
IndicateurRequis = Annotated[Indicateur, Query(description="production (t), surface (ha) ou rendement (kg/ha)")]


def _disponible(index: Index) -> None:
    if not index.a_observatoire:
        raise ErreurApi(404, "observatoire_indisponible", "L'Observatoire n'est pas encore construit dans SALTIS.MARTS.",
                        "Marts construits par dbt : mart_observatoire_series et mart_observatoire_objectifs.")


def _culture(index: Index, texte: str) -> str:
    cible = normaliser(texte)
    # « mil » = « MIL (SOUNA) » : correspondance exacte, sinon début de nom
    trouvees = [c for c in index.cultures_observatoire if normaliser(c) == cible] or [
        c for c in index.cultures_observatoire if normaliser(c).startswith(cible)
    ]
    if len(trouvees) != 1:
        if normaliser(texte) in ("OIGNON", "FONIO"):
            raise ErreurApi(404, "culture_sans_donnees", f"Culture « {texte} » : pas de données disponibles.",
                            "Oignon, fonio : pas de données disponibles")
        raise ErreurApi(404, "culture_inconnue", f"Culture « {texte} » inconnue dans l'Observatoire.",
                        "Liste : GET /api/v1/observatoire/filtres (" + ", ".join(index.cultures_observatoire) + ")")
    return trouvees[0]


def _zone(index: Index, culture: str, zone: str) -> str:
    if zone != "SEN" and zone not in index.regions and zone not in index.departements:
        raise ErreurApi(404, "zone_inconnue", f"Zone {zone} inconnue.", "Liste : GET /api/v1/observatoire/filtres (zones)")
    if zone not in index.zones_observatoire.get(culture, []):
        raise ErreurApi(404, "aucune_donnee_zone", f"Pas de donnée pour {culture} dans la zone {zone}.",
                        "Totaux région et pays : seulement pour les cultures avec totaux (voir `a_totaux` dans /observatoire/filtres).")
    return zone


@observatoire.get("/filtres", response_model=Reponse[FiltresObservatoire], responses=ERREURS,
                  summary="Filtres : cultures avec années couvertes, années, zones, encadré de couverture")
async def filtres(request: Request):
    """Cultures avec leurs années couvertes et leur mention (sésame : « données jusqu'en 2016 »), cultures sans données
    (oignon, fonio), toutes les années, zones (pays, régions, départements), lignes de l'encadré « Couverture des données »
    et sources."""
    return await servir(request, cles.obs_filtres(), _disponible)


@observatoire.get("/indicateurs", response_model=Reponse[IndicateursObservatoire], responses=ERREURS,
                  summary="Chiffres clés : production, superficie, rendement d'une zone pour une année")
async def indicateurs(request: Request, annee: Annee, culture: CultureObligatoire, zone: Zone = "SEN"):
    """Valeur, variation sur un an, écart à la moyenne des 10 années précédentes, rang ou part nationale et source.
    Valeur manquante = `null` avec `derniere_annee_disponible`. Le rendement national FAOSTAT est dans `rendement_faostat`
    (pays seulement), séparé des sommes de départements."""
    etat = {}

    def valider(index: Index) -> None:
        _disponible(index)
        etat["culture"] = _culture(index, culture)
        _zone(index, etat["culture"], zone)

    return await servir(request, lambda i: cles.obs_indicateurs(annee, etat["culture"], zone), valider)


@observatoire.get("/serie", response_model=Reponse[SerieObservatoireReponse], responses=ERREURS,
                  summary="Série 1981-2021 d'une zone, série FAOSTAT séparée, points officiels")
async def serie(request: Request, culture: CultureObligatoire, indicateur: IndicateurRequis, zone: Zone = "SEN"):
    """Série par département, région ou pays (1981-2021, `null` quand il n'y a pas de donnée, jamais d'interpolation), le
    rendement national FAOSTAT dans `serie_faostat` (série distincte), les chiffres officiels 2019 et 2023 et les rendements
    de référence de la SSA dans `points_officiels` (pays seulement), et `derniere_annee_departements` (2021)."""
    etat = {}

    def valider(index: Index) -> None:
        _disponible(index)
        etat["culture"] = _culture(index, culture)
        _zone(index, etat["culture"], zone)

    return await servir(request, lambda i: cles.obs_serie(etat["culture"], zone, indicateur), valider)


@observatoire.get("/carte", response_model=Reponse[list[CarteDepartement]], responses=ERREURS,
                  summary="Carte : un indicateur pour les 45 départements")
async def carte(request: Request, annee: Annee, culture: CultureObligatoire, indicateur: IndicateurRequis):
    """Une ligne par département (45) ; `a_donnee` faux et `valeur` null = département à hachurer (« Pas de donnée »)."""
    etat = {}

    def valider(index: Index) -> None:
        _disponible(index)
        etat["culture"] = _culture(index, culture)

    return await servir(request, lambda i: cles.obs_carte(annee, etat["culture"], indicateur), valider)


@observatoire.get("/classement", response_model=Reponse[list[ClassementDepartement]], responses=ERREURS,
                  summary="Classement des départements avec progression sur 10 ans")
async def classement(request: Request, annee: Annee, culture: CultureObligatoire, indicateur: IndicateurRequis):
    """Départements ayant une valeur, du plus élevé au plus faible, avec la valeur 10 ans plus tôt et la progression (%)."""
    etat = {}

    def valider(index: Index) -> None:
        _disponible(index)
        etat["culture"] = _culture(index, culture)

    return await servir(request, lambda i: cles.obs_classement(annee, etat["culture"], indicateur), valider)


@observatoire.get("/objectifs", response_model=Reponse[ObjectifsObservatoire], responses=ERREURS,
                  summary="Objectifs officiels (SSA 2025-2034, LPSAE 2025-2029) avec document et page")
async def objectifs(request: Request, culture: Annotated[str | None, Query(min_length=2, max_length=60, description="Culture ; absente = tous")] = None,
                    zone: Zone = "SEN"):
    """Seuls les objectifs existants sont servis. Sans objectif : `objectifs` vide et message
    « Pas d'objectif chiffré dans la SSA 2025-2034 ». Les objectifs sont nationaux : une région ou un département renvoie
    un message, pas d'objectif."""
    etat = {}

    def valider(index: Index) -> None:
        _disponible(index)
        etat["culture"] = _culture(index, culture) if culture else None
        if zone != "SEN" and zone not in index.regions and zone not in index.departements:
            raise ErreurApi(404, "zone_inconnue", f"Zone {zone} inconnue.", "Liste : GET /api/v1/observatoire/filtres (zones)")

    return await servir(request, lambda i: cles.obs_objectifs(etat["culture"], zone == "SEN"), valider)
