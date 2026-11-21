"""Résultats des modèles d'IA (SALTIS.ML), produits par ml/. Voir ml/MODELES.md.

Chaque prévision porte des probabilités ou une fourchette, et sa fiabilité (`evaluation`).
"""

from datetime import date
from typing import Literal

from pydantic import Field

from .commun import Modele, Territoire

Classe3 = Literal["sèche", "normale", "humide"]
ClasseSaison = Literal["très sèche", "sèche", "normale", "humide", "très humide"]
Moment = Literal["FIN_MAI", "FIN_JUIN", "FIN_JUILLET", "FIN_AOUT"]


class Trace(Modele):
    version_modele: str = Field(description="Version du modèle", examples=["m1-v1"])
    date_calcul: date = Field(description="Date du calcul")


class PrevisionSaison(Territoire, Trace):
    """ML.PREVISION_SAISONNIERE — modèle 1, « La saison qui vient » : prévision faite fin mai."""

    annee: int = Field(examples=[2024])
    type_prevision: Literal["RETROSPECTIVE_VALIDATION", "RETROSPECTIVE_TEST", "PREVISION_OCEAN", "PREVISION_TENDANCE"] = Field(
        description="VALIDATION : 1981-2015, chaque année prévue sans elle-même ; TEST : 2016-2025, modèle appris sur ≤ 2015 ; "
        "PREVISION_OCEAN : année à venir dont l'océan de mars-mai est connu (2026) ; PREVISION_TENDANCE : années saisies sans océan connu (2027-2035), moyenne des 15 dernières saisons"
    )
    proba_seche_pct: float | None = Field(description="Probabilité d'une saison sèche (%)", examples=[31.4])
    proba_normale_pct: float | None = Field(description="Probabilité d'une saison normale (%)")
    proba_humide_pct: float | None = Field(description="Probabilité d'une saison humide (%)")
    classe_prevue: Classe3 | None = Field(description="Classe la plus probable (toujours afficher les 3 probabilités)")
    pluie_prevue_mm: float | None = Field(description="Pluie de saison prévue (mm)")
    pluie_basse_mm: float | None = Field(description="Bas de la fourchette (8 chances sur 10 d'être dedans)")
    pluie_haute_mm: float | None = Field(description="Haut de la fourchette")
    pluie_normale_mm: float | None = Field(description="Normale 1991-2020 du département (mm)")
    pluie_observee_mm: float | None = Field(description="Pluie réellement tombée (mm), pour comparer")
    classe_observee: Classe3 | None = Field(description="Classe réellement observée")


class PrevisionRendement(Territoire, Trace):
    """ML.PREVISION_RENDEMENT — modèle 3, « Quelle culture » et « Alerte récolte »."""

    culture: str = Field(examples=["ARACHIDE"])
    annee: int = Field(examples=[2012])
    moment_prevision: Moment
    type_prevision: Literal["RETROSPECTIVE_VALIDATION", "RETROSPECTIVE_TEST", "PROJECTION_NON_EVALUEE"] = Field(
        description="PROJECTION_NON_EVALUEE : 2022-2025, invérifiable (superficies semées après 2016)"
    )
    tendance_kg_ha: float | None = Field(description="Rendement habituel : moyenne des 10 campagnes précédentes")
    rendement_bas_kg_ha: float | None = Field(description="Année difficile (1 chance sur 10 de faire moins)")
    rendement_median_kg_ha: float | None = None
    rendement_haut_kg_ha: float | None = Field(description="Bonne année (1 chance sur 10 de faire plus)")
    proba_chute_pct: float | None = Field(description="Probabilité que le rendement passe sous 80 % de la tendance")
    proba_chute_reference_pct: float | None = Field(description="Même probabilité selon la fréquence passée (référence)")
    explication: str | None = Field(description="Les variables qui poussent le plus la prévision")
    rendement_fiable: bool | None = Field(description="Le modèle bat la référence pour ce moment et cette culture")
    alerte_fiable: bool | None = Field(description="Faux : présenter comme un risque habituel, pas une prévision de l'année")
    rendement_observe_kg_ha: float | None = None
    chute_observee: bool | None = None


class RisqueSemis(Territoire, Trace):
    """ML.RISQUE_SEMIS — modèle 4, « Quand semer » : risque de chaque décade de semis."""

    annee: int | None = Field(description="Vide pour l'année type", examples=[2024])
    type_prevision: Literal["RETROSPECTIVE_TEST", "PREVISION_OCEAN", "PREVISION_TENDANCE", "ANNEE_TYPE"]
    culture: str = Field(examples=["ARACHIDE"])
    cycle_jours: float | None = None
    decade_semis: int = Field(ge=16, le=23, description="16 = 1re décade de juin … 23 = 2e décade d'août")
    libelle_decade: str = Field(examples=["2e décade de juillet"])
    chance_pluie_semis_pct: float | None = Field(description="Part des années avec une pluie de semis (≥ 20 mm) à cette décade")
    risque_faux_depart_pct: float | None = None
    risque_fin_trop_tot_pct: float | None = None
    risque_total_pct: float | None = None
    decade_conseillee: bool = Field(description="La décade la plus sûre (une par département × année × culture)")
    proba_saison_seche_m1_pct: float | None = Field(description="Prévision du modèle 1 utilisée")


class EvaluationModele(Modele):
    """ML.EVALUATION_MODELES — fiabilité des modèles comparée à une prévision simple."""

    modele: Literal["M1", "M3", "M4"]
    version_modele: str
    periode: str = Field(examples=["test 2016-2025"])
    moment: str | None = None
    culture: str | None = None
    risque: str | None = None
    variables: str | None = None
    mesure: str = Field(examples=["rpss_vs_climatologie"])
    valeur: float | None = None
