"""Éléments communs : territoire, enveloppe de réponse, valeurs contrôlées."""

from datetime import datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")

# Valeurs contrôlées (vérifiées dans SALTIS.MARTS le 11/11/2026). Une valeur inattendue fait échouer
# le préchargement : l'API garde alors la version précédente du cache au lieu de servir une donnée hors contrat.
ClasseSaison = Literal["très sèche", "sèche", "normale", "humide", "très humide"]
RisqueSaison = Literal["sécheresse et excès de pluie", "sécheresse", "excès de pluie", "normal"]
ClasseVulnerabilite = Literal[
    "très faible (relatif)", "faible (relatif)", "moyenne (relatif)", "élevée (relatif)", "très élevée (relatif)"
]
NiveauAdequation = Literal["adaptée", "à risque", "déconseillée", "irrigation requise", "non évaluée (culture pluriannuelle)"]
StatutValidation = Literal["VALIDEE", "A_CONFIRMER", "NON_VERIFIEE", "A_COMPLETER"]
LibelleProduit = Literal["calculé", "pas dans la formule", "dose à saisir", "superficie de référence nulle"]
Coherence = Literal["COHERENT", "ECART", "A_VERIFIER"]
Confiance = Literal["normale", "faible"]
NiveauAgregat = Literal["NATIONAL", "REGION", "ZONE"]


class Modele(BaseModel):
    """Base des lignes de mart : colonnes supplémentaires ignorées (et signalées au préchargement)."""

    model_config = ConfigDict(extra="ignore")


class Territoire(Modele):
    code_departement: str = Field(description="Code GADM du département", examples=["SEN.7.1_1"])
    departement: str = Field(description="Nom du département", examples=["Kolda"])
    code_region: str = Field(description="Code GADM de la région", examples=["SEN.7_1"])
    region: str = Field(description="Nom de la région", examples=["Kolda"])
    zone_agroecologique: str = Field(
        description="Zone agroécologique (majuscules). Zone et région sont parallèles, pas emboîtées.",
        examples=["CASAMANCE"],
    )


class Meta(BaseModel):
    version: str = Field(description="Version du cache qui a servi la réponse (= ETag)", examples=["v20261111T103000Z"])
    genere_le: datetime = Field(description="Date du préchargement depuis Snowflake (UTC)")
    source: str = Field(description="Table d'origine", examples=["SALTIS.MARTS.MART_CARTE_AGROCLIMAT"])
    nb_elements: int = Field(description="Nombre d'éléments dans `donnees`")
    filtres: dict[str, str | int | bool | None] = Field(default_factory=dict, description="Filtres appliqués")
    avertissements: list[str] = Field(default_factory=list, description="Limites d'usage à afficher ou à respecter")


class Reponse(BaseModel, Generic[T]):
    """Enveloppe de toutes les réponses de données."""

    meta: Meta
    donnees: T


class CorpsErreur(BaseModel):
    code: str = Field(examples=["departement_inconnu"])
    message: str = Field(examples=["Département SEN.99.1_1 inconnu."])
    aide: str | None = Field(default=None, examples=["Liste : GET /api/v1/referentiels/departements"])


class ReponseErreur(BaseModel):
    erreur: CorpsErreur
