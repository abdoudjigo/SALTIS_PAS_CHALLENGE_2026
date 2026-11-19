"""Cadre harmonisé (CILSS) : phase d'insécurité alimentaire par département, dernier cycle."""

from datetime import date
from typing import Literal, get_args

from pydantic import BaseModel, Field, field_validator

from .commun import Territoire

Phase = Literal[1, 2, 3, 4, 5]
TypePeriode = Literal["current", "projected"]
LibellePhase = Literal["minimale", "sous pression", "crise", "urgence", "famine"]

# Textes du mart : doivent rester identiques à dbt/models/marts/mart_cadre_harmonise_departement.sql
# (case libelle_phase_retenue et iff mention_periode). Un libellé de phase différent fait échouer le préchargement.
LIBELLES_PHASES: dict[int, str] = dict(zip(get_args(Phase), get_args(LibellePhase)))
MENTION_TERMINEE = "période terminée, prochain cycle attendu"
COLONNES_POPULATION = (
    "population_retenue", "population_phase3_5_retenue", "population_courante", "population_phase3_5_courante",
    "population_projetee", "population_phase3_5_projetee",
)


class CadreHarmonise(Territoire):
    """MART_CADRE_HARMONISE_DEPARTEMENT : un département, dernier cycle. Hors score de vulnérabilité.

    Période retenue : celle que le Cadre harmonisé marque à utiliser (sinon la projection).
    `periode_terminee` est recalculée à chaque requête depuis `date_fin_periode_retenue`."""

    annee_cycle: int | None = Field(description="Année du cycle d'analyse", examples=[2026])
    code_cycle: int | None
    libelle_cycle_source: str | None = Field(description="Libellé de la source (`Jan-May`, `Sep-Dec`)")
    libelle_cycle: str | None = Field(description="Cycle d'analyse", examples=["mars 2026"])
    # Période retenue (à afficher)
    type_periode_retenue: TypePeriode | None
    libelle_periode_retenue: str | None = Field(examples=["mars 2026, projection juin-août 2026"])
    date_debut_periode_retenue: date | None
    date_fin_periode_retenue: date | None
    periode_terminee: bool | None = Field(description="Vrai si la période retenue est passée (recalculé à la requête)")
    mention_periode: str | None = Field(None, description="« période terminée, prochain cycle attendu » si la période est passée, "
                                        "NULL sinon (recalculé à la requête)")
    phase_retenue: Phase | None = Field(description="Phase 1 (minimale) à 5 (famine)", examples=[3])
    libelle_phase_retenue: LibellePhase | None
    population_retenue: float | None = Field(description="Population analysée (personnes), additive")
    population_phase3_5_retenue: float | None = Field(description="Personnes en phases 3 à 5, additive", examples=[90593.14])
    # Situation courante et projection du même cycle
    libelle_periode_courante: str | None
    phase_courante: Phase | None
    population_courante: float | None
    population_phase3_5_courante: float | None
    libelle_periode_projetee: str | None
    phase_projetee: Phase | None
    population_projetee: float | None
    population_phase3_5_projetee: float | None
    # Contexte
    fusion_keur_massar: bool = Field(description="Vrai pour Pikine : Pikine et Keur Massar réunis")
    note_fusion: str | None
    source: str
    licence: str = Field(examples=["CC BY"])

    @field_validator(*COLONNES_POPULATION)
    @classmethod
    def _arrondir_population(cls, v: float | None) -> float | None:
        """Personnes à 0,01 près (valeurs de la source, sans artefact de virgule flottante)."""
        return None if v is None else round(v, 2)


class PhaseCadreHarmonise(BaseModel):
    phase: Phase
    libelle: LibellePhase
    couleur: str = Field(description="Palette officielle du Cadre harmonisé", examples=["#E67800"])
