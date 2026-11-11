"""Registre des marts exposés : table Snowflake, schéma Pydantic, ordre de lecture.

`MART_ML_PREVISION_PLUIE` n'est volontairement pas exposé : il le sera avec les prévisions du modèle ML.
"""

from dataclasses import dataclass

from pydantic import BaseModel

from .schemas import Besoin, CarteAgroclimat, ChoixCulture, SuiviDecadaire, TerritoireAgrodistrib, Vulnerabilite


@dataclass(frozen=True)
class DefinitionMart:
    cle: str
    table: str
    modele: type[BaseModel]
    ordre: str


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
    ]
}


def tables_a_lire() -> dict[str, tuple[str, str]]:
    return {cle: (d.table, d.ordre) for cle, d in MARTS.items()}
