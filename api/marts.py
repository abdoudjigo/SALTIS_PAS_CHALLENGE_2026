"""Registre des tables exposées : table Snowflake, schéma Pydantic, ordre de lecture.

Deux familles :
- les marts (`SALTIS.MARTS`), obligatoires : s'il en manque un, le préchargement échoue et l'ancienne version reste servie ;
- les résultats des modèles d'IA (`SALTIS.ML`), facultatifs : tant qu'ils ne sont pas chargés,
  l'API sert les marts et les routes `/previsions` répondent 404 `prevision_indisponible`.

`MART_ML_PREVISION_PLUIE` (table d'entraînement) n'est volontairement pas exposé : on expose ses prévisions.
"""

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel
from .schemas.opportunites import CarteOpportunite

from .schemas import (
    AnneeSemblable,
    Besoin,
    CarteAgroclimat,
    ChoixCulture,
    EvaluationModele,
    PrevisionRendement,
    PrevisionSaison,
    RisqueSemis,
    SuiviDecadaire,
    TerritoireAgrodistrib,
    Vulnerabilite,
)

Schema = Literal["marts", "ml"]


@dataclass(frozen=True)
class DefinitionMart:
    cle: str
    table: str
    modele: type[BaseModel]
    ordre: str
    schema: Schema = "marts"
    obligatoire: bool = True


MARTS: dict[str, DefinitionMart] = {
    d.cle: d
    for d in [
        DefinitionMart("carte", "MART_CARTE_AGROCLIMAT", CarteAgroclimat, "code_departement, campagne_agricole"),
        DefinitionMart("suivi", "MART_SUIVI_DECADAIRE", SuiviDecadaire, "code_departement, annee, numero_decade_annee"),
        DefinitionMart(
            "cultures", "MART_CHOIX_CULTURES", ChoixCulture, "code_departement, culture, type_option, rang_option nulls last, option"
        ),
        DefinitionMart("besoins", "MART_BESOINS", Besoin, "code_departement, culture nulls first"),
        DefinitionMart("agrodistrib", "MART_TERRITOIRES_AGRODISTRIB", TerritoireAgrodistrib, "code_departement, culture"),
        DefinitionMart("vulnerabilite", "MART_VULNERABILITE_DEPARTEMENT", Vulnerabilite, "rang_vulnerabilite nulls last, code_departement"),
        # ---- modèles d'IA (ml/), facultatifs
        # ---- carte des opportunités (pluie et eau), facultative
        DefinitionMart("opportunites", "MART_CARTE_OPPORTUNITES", CarteOpportunite, "code_departement", "marts", False),
        DefinitionMart("prev_saison", "PREVISION_SAISONNIERE", PrevisionSaison, "annee, code_departement", "ml", False),
        DefinitionMart("semblables", "ANNEES_SEMBLABLES", AnneeSemblable, "code_departement, annee, moment_prevision, rang", "ml", False),
        DefinitionMart("prev_rendement", "PREVISION_RENDEMENT", PrevisionRendement,
                       "code_departement, annee, culture, moment_prevision", "ml", False),
        DefinitionMart("semis", "RISQUE_SEMIS", RisqueSemis, "code_departement, annee nulls last, culture, decade_semis", "ml", False),
        DefinitionMart("evaluation", "EVALUATION_MODELES", EvaluationModele, "modele, periode, moment, culture, mesure", "ml", False),
    ]
}


def tables_a_lire() -> dict[str, tuple[str, str, Schema, bool]]:
    return {cle: (d.table, d.ordre, d.schema, d.obligatoire) for cle, d in MARTS.items()}
