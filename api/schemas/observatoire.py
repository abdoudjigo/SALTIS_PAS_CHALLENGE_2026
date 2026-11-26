"""Observatoire Sénégal 2050 : séries de production, superficie et rendement (1981-2021), rendement national FAOSTAT
(série distincte) et objectifs officiels. Aucune prévision.

Règles : mesure absente = null (jamais 0) ; région et pays = somme des départements attendus ; rendement = production x 1000
/ superficie ; FAOSTAT jamais additionné ni mélangé aux sommes des départements."""

from typing import Literal

from pydantic import BaseModel, Field

from .commun import Modele

Indicateur = Literal["production", "surface", "rendement"]
UNITES: dict[str, str] = {"production": "t", "surface": "ha", "rendement": "kg/ha"}
LIBELLES_INDICATEURS: dict[str, str] = {"production": "Production", "surface": "Superficie", "rendement": "Rendement"}
DERNIERE_ANNEE_DEPARTEMENTS = 2021
PREMIERE_ANNEE = 1981
MESSAGE_SANS_OBJECTIF = "Pas d'objectif chiffré dans la SSA 2025-2034"
MESSAGE_OBJECTIF_NATIONAL = (
    "Les objectifs officiels sont nationaux : pas d'objectif chiffré par région ou par département dans la SSA 2025-2034."
)


# ---------------------------------------------------------------- lignes des marts


class SerieObservatoire(Modele):
    """MART_OBSERVATOIRE_SERIES : un département, une région ou le pays, une culture, une campagne."""

    niveau: Literal["DEPARTEMENT", "REGION", "PAYS"]
    code_zone: str
    zone: str
    code_region: str | None = None
    region: str | None = None
    culture: str
    campagne_agricole: int
    production_t: float | None = None
    superficie_ha: float | None = None
    rendement_kg_ha: float | None = None
    nb_departements_observes: int | None = None
    nb_departements_attendus: int | None = None
    est_complet: bool | None = None
    type_superficie: Literal["récoltée", "semée", "mixte"] | None = None
    serie: Literal["DAPSA", "FAOSTAT"]
    source: str
    note: str | None = None


class ObjectifObservatoire(Modele):
    """MART_OBSERVATOIRE_OBJECTIFS : une valeur officielle et son document (copie typée du seed)."""

    indicateur: str
    perimetre: str
    culture: str | None = None
    cultures_concernees: str | None = None
    unite: str | None = None
    valeur_reference: float | None = None
    annee_reference: int | None = None
    cible: float | None = None
    annee_cible: int | None = None
    document: str
    page: str
    url: str | None = None
    note: str | None = None


# ---------------------------------------------------------------- réponses


class CultureObservatoire(BaseModel):
    culture: str
    annees_couvertes: list[int] = Field(description="Années avec au moins une valeur par département (1981-2021)")
    premiere_annee: int
    derniere_annee: int
    mention: str | None = Field(None, description="Ex. « données jusqu'en 2016 » (sésame)")
    a_totaux: bool = Field(description="Vrai si les totaux région et pays existent (somme des départements attendus)")
    faostat_annees: list[int] = Field(description="Années du rendement national FAOSTAT (série distincte), vide si absent")


class ZoneObservatoire(BaseModel):
    code: str
    nom: str
    niveau: Literal["PAYS", "REGION", "DEPARTEMENT"]
    code_region: str | None = None


class FiltresObservatoire(BaseModel):
    cultures: list[CultureObservatoire]
    sans_donnees: list[str] = Field(description="Cultures sans aucune donnée (oignon, fonio)")
    mention_sans_donnees: str
    annees: list[int] = Field(description="Toutes les années proposées (1981-2024) ; voir `annees_couvertes` par culture")
    derniere_annee_departements: int
    derniere_annee_faostat: int | None
    zones: list[ZoneObservatoire]
    couverture: list[str] = Field(description="Lignes de l'encadré « Couverture des données »")
    sources: list[str]


class IndicateurZone(BaseModel):
    indicateur: Indicateur
    libelle: str
    unite: str
    valeur: float | None = Field(description="null = non disponible (jamais 0)")
    derniere_annee_disponible: int | None = Field(None, description="Quand `valeur` est null : dernière année avec une valeur, jusqu'à l'année demandée")
    variation_n1_pct: float | None = Field(None, description="Variation par rapport à l'année précédente (%), null si l'une des deux manque")
    comparable_n1: bool | None = Field(None, description="Faux si le nombre de départements observés ou le type de superficie diffère d'une année à l'autre")
    ecart_moyenne_10_ans_pct: float | None = Field(None, description="Écart à la moyenne des 10 années précédentes disponibles (%), au moins 5 années")
    nb_annees_moyenne: int | None = None
    rang: int | None = Field(None, description="Rang parmi les départements (ou régions) avec une valeur, 1 = plus élevé ; null pour le pays")
    nb_classes: int | None = None
    part_nationale_pct: float | None = Field(None, description="Part de la somme nationale (production et superficie seulement)")
    est_complet: bool | None = None
    nb_departements_observes: int | None = None
    nb_departements_attendus: int | None = None
    type_superficie: str | None = None
    serie: Literal["DAPSA"] | None = None
    source: str | None = Field(None, description="Toujours renseignée quand `valeur` ne l'est pas null")
    note: str | None = None


class FaostatPoint(BaseModel):
    annee: int
    rendement_kg_ha: float | None
    variation_n1_pct: float | None = None
    ecart_moyenne_10_ans_pct: float | None = None
    source: Literal["FAOSTAT"] = "FAOSTAT"


class IndicateursObservatoire(BaseModel):
    annee: int
    culture: str
    niveau: Literal["PAYS", "REGION", "DEPARTEMENT"]
    code_zone: str
    zone: str
    derniere_annee_departements: int = DERNIERE_ANNEE_DEPARTEMENTS
    indicateurs: list[IndicateurZone]
    rendement_faostat: FaostatPoint | None = Field(
        None, description="Rendement national FAOSTAT de l'année (pays seulement) : série distincte, jamais mélangée aux sommes"
    )


class PointSerie(BaseModel):
    annee: int
    valeur: float | None
    est_complet: bool | None = None
    nb_departements_observes: int | None = None
    nb_departements_attendus: int | None = None
    type_superficie: str | None = None
    source: str | None = None
    note: str | None = None


class PointOfficiel(BaseModel):
    indicateur: str
    annee: int | None
    valeur: float
    unite: str | None
    document: str
    page: str
    url: str | None = None
    note: str | None = None


class ReferenceRendement(BaseModel):
    valeur: float
    unite: str | None
    note: str
    document: str
    page: str


class SerieObservatoireReponse(BaseModel):
    culture: str
    indicateur: Indicateur
    unite: str
    niveau: Literal["PAYS", "REGION", "DEPARTEMENT"]
    code_zone: str
    zone: str
    derniere_annee_departements: int = DERNIERE_ANNEE_DEPARTEMENTS
    mention_arret: str = Field(description="Texte de la ligne verticale")
    rupture_type_superficie: int = Field(2016, description="Superficie récoltée jusqu'en 2015, semée ensuite : rendement 2016+ non comparable")
    points: list[PointSerie] = Field(description="1981-2021, une ligne par année ; valeur null si non disponible (pas d'interpolation)")
    serie_faostat: list[FaostatPoint] = Field(description="Rendement national FAOSTAT, série distincte (vide hors pays et hors rendement)")
    note_faostat: str | None = None
    reference_rendement: ReferenceRendement | None = Field(None, description="Ligne de référence du rendement (SSA, tableau 8, moyenne africaine), pays et rendement seulement")
    points_officiels: list[PointOfficiel] = Field(description="Chiffres officiels (SSA, LPSAE) du pays, avec document et page ; contradictions côte à côte")


class CarteDepartement(BaseModel):
    code_departement: str
    departement: str
    code_region: str | None = None
    region: str | None = None
    valeur: float | None
    a_donnee: bool
    rang: int | None = None
    est_complet: bool | None = None
    type_superficie: str | None = None
    source: str | None = None
    note: str | None = None


class ClassementDepartement(BaseModel):
    rang: int
    code_departement: str
    departement: str
    region: str | None = None
    valeur: float
    est_complet: bool | None = None
    annee_comparaison: int
    valeur_comparaison: float | None
    progression_10_ans_pct: float | None = Field(None, description="Évolution sur 10 ans (%), null si l'une des deux valeurs manque")
    rupture_type_superficie: bool = Field(False, description="Vrai si la comparaison traverse 2016 (superficie, rendement)")
    source: str | None = None


class ObjectifLigne(BaseModel):
    indicateur: str
    libelle: str
    portee: Literal["culture", "groupe", "national"]
    culture: str | None
    cultures_concernees: list[str]
    unite: str | None
    valeur_reference: float | None
    annee_reference: int | None
    cible: float | None
    annee_cible: int | None
    document: str
    page: str
    url: str | None = None
    note: str | None = None


class ObjectifsObservatoire(BaseModel):
    culture: str | None
    zone: str
    objectifs: list[ObjectifLigne]
    message: str | None = Field(None, description="Renseigné quand aucun objectif n'existe")
