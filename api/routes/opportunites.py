"""Routes de la carte des opportunités (MART_CARTE_OPPORTUNITES) : réponses précalculées du cache, comme les autres marts.

Tant que dbt n'a pas construit le mart, chaque route répond 404 `opportunites_indisponible`.
Méthode, seuils et limites : docs/technique/carte-opportunites.md.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Query, Request

from ..cache import cles
from ..cache.construction import Index
from ..erreurs import ErreurApi, reponses_erreurs
from ..schemas import CarteOpportunite, Reponse
from .outils import CodeDepartement, exiger_departement, servir

ERREURS = reponses_erreurs(404, 503)
AIDE = "Le mart est construit par dbt (mart_carte_opportunites) : voir docs/technique/carte-opportunites.md."

FiltreCouleur = Annotated[
    Literal["bleu", "jaune", "vert"] | None,
    Query(description="`bleu` : opportunités eau, classées par `rang_opportunite_eau` ; `jaune` : saison courte ; `vert` : saison longue"),
]

opportunites = APIRouter(prefix="/opportunites", tags=["E · Opportunités"])


def _disponible(index: Index) -> None:
    if not index.a_opportunites:
        raise ErreurApi(404, "opportunites_indisponible", "La carte des opportunités n'est pas encore construite dans SALTIS.MARTS.", AIDE)


@opportunites.get("", response_model=Reponse[list[CarteOpportunite]], responses=ERREURS,
                  summary="Carte des opportunités : une couleur par département")
async def carte_opportunites(request: Request, couleur: FiltreCouleur = None):
    """**Jaune** : saison des pluies courte, semences à cycle court. **Vert** : saison longue, cycle long possible.
    **Bleu** : eau mobilisable et peu exploitée en saison sèche (contre-saison, aménagement, forage).

    `couleur_carte` donne la couleur à peindre (bleu prioritaire) ; `couleur_fond` et `couche_eau` permettent d'afficher
    le fond jaune / vert avec la couche bleue par-dessus. Chaque ligne porte un `conseil_agriculteur` et, en zone bleue,
    un `conseil_investisseur` prêts à afficher."""
    return await servir(request, cles.opportunites(couleur), _disponible)


@opportunites.get("/{code_departement}", response_model=Reponse[CarteOpportunite], responses=ERREURS,
                  summary="Opportunités d'un département")
async def opportunites_departement(request: Request, code_departement: CodeDepartement):
    """Cycle maximal conseillé, variétés qui passent 4 années sur 5, eau de surface et nappe, conseils."""

    def valider(index: Index) -> None:
        _disponible(index)
        exiger_departement(index, code_departement)

    return await servir(request, cles.opportunites_departement(code_departement), valider)
