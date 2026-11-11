"""Référentiels (tirés des marts) et état du cache."""

from datetime import datetime

from pydantic import BaseModel, Field


class DepartementRef(BaseModel):
    code_departement: str = Field(examples=["SEN.7.1_1"])
    departement: str = Field(examples=["Kolda"])
    code_region: str
    region: str
    zone_agroecologique: str
    zone_secondaire: str | None = Field(None, description="Département de transition entre deux zones ; jamais une clé d'agrégation")
    latitude: float | None = Field(None, description="Degrés décimaux (WGS 84)", examples=[12.89])
    longitude: float | None = Field(None, description="Degrés décimaux (WGS 84)", examples=[-14.94])
    a_suivi_decadaire: bool = Field(description="Faux pour Guédiawaye (absent du suivi décadaire)")
    a_score_vulnerabilite: bool = Field(description="Faux pour Dakar, Guédiawaye et Pikine")


class RegionRef(BaseModel):
    code_region: str
    region: str
    nb_departements: int
    zones_agroecologiques: list[str] = Field(description="Une région peut couvrir deux zones")
    departements: list[str] = Field(description="Codes des départements")


class ZoneRef(BaseModel):
    zone_agroecologique: str
    nb_departements: int
    regions: list[str] = Field(description="Codes des régions touchées par la zone")
    departements: list[str]


class CultureRef(BaseModel):
    culture: str = Field(examples=["MAÏS"])
    nb_departements_cultivee: int = Field(description="Départements avec une superficie de référence > 0")
    dans_choix_cultures: bool
    dans_besoins: bool


class Periodes(BaseModel):
    campagnes_agroclimat: list[int]
    annees_suivi_decadaire: list[int]
    derniere_campagne: int


class InfoVersion(BaseModel):
    version: str
    genere_le: datetime
    declencheur: str = Field(description="`demarrage`, `cli`, `api`…")
    source: str = Field(examples=["SALTIS.MARTS"])
    lignes_par_mart: dict[str, int]
    colonnes_ignorees: dict[str, list[str]] = Field(description="Colonnes présentes dans Snowflake mais pas dans le contrat")
    nb_cles: int
    taille_octets: int = Field(description="Taille JSON non compressée de toutes les réponses")
    taille_stockee_octets: int = Field(description="Taille réellement stockée (gzip au-delà de 1 Ko)")
    duree_lecture_s: float
    duree_construction_s: float
    duree_publication_s: float


class EtatCache(BaseModel):
    mode: str = Field(description="`redis` ou `memoire` (repli si Redis est injoignable)")
    statut: str = Field(description="`pret`, `en_preparation`, `vide`, `erreur`")
    version_active: str | None
    versions_conservees: list[str]
    info: InfoVersion | None
    derniere_erreur: str | None


class Sante(BaseModel):
    statut: str = Field(description="`ok` (données servies) ou `degrade`")
    cache: str
    mode: str
    version_active: str | None
    redis_joignable: bool | None


class Tache(BaseModel):
    message: str
    statut: str
