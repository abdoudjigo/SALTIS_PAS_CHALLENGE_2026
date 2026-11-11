"""Module A : carte agroclimatique et suivi décadaire."""

from pydantic import Field

from .commun import ClasseSaison, ClasseVulnerabilite, RisqueSaison, Territoire


class CarteAgroclimat(Territoire):
    """MART_CARTE_AGROCLIMAT : un département, une campagne. Source de référence pour le bilan d'une saison."""

    campagne_agricole: int = Field(description="Campagne (juin N à mai N+1 rattachés à N)", examples=[2024])
    latitude: float | None = Field(None, description="Point représentatif du département (degrés décimaux, WGS 84)", examples=[12.89])
    longitude: float | None = Field(None, description="Point représentatif du département (degrés décimaux, WGS 84)", examples=[-14.94])
    zone_secondaire: str | None = Field(
        None, description="Département de transition entre deux zones (8 départements) ; information seulement, jamais une clé d'agrégation"
    )
    pluie_saison_mm: float | None = Field(description="Cumul de pluie juin-octobre (mm)", examples=[1190.73])
    pluie_saison_normale_mm: float | None = Field(description="Normale 1991-2020 du département (mm)", examples=[1022.04])
    anomalie_pluie_saison_pct: float | None = Field(description="Écart à la normale (%)", examples=[16.51])
    spi_saison: float | None = Field(description="Indice standardisé de précipitations", examples=[1.43])
    classe_saison: ClasseSaison | None = Field(description="Classe SPI, relative au département")
    debut_saison_jour: float | None = Field(description="Démarrage de la saison (jour de l'année)", examples=[168])
    retard_debut_saison_j: float | None = Field(description="Retard du démarrage (jours)")
    fin_saison_jour: float | None = Field(description="Fin de la saison (jour de l'année)", examples=[303])
    duree_saison_j: float | None = Field(description="Durée de la saison (jours)")
    nb_jours_pluie: float | None = Field(description="Nombre de jours de pluie")
    plus_longue_sequence_seche_j: float | None = Field(description="Plus longue séquence sèche (jours)")
    nb_sequences_seches_7j: float | None = Field(description="Nombre de séquences sèches de 7 jours ou plus")
    nb_decades_seches: float | None = Field(description="Nombre de décades sèches")
    temp_max_moy_saison_c: float | None = Field(description="Température maximale moyenne (°C)")
    nb_jours_tmax_sup_40: int | None = Field(description="Jours à plus de 40 °C")
    ndvi_max_saison_zc: float | None = Field(description="NDVI maximal (à partir de 2000)")
    anomalie_ndvi_pct: float | None = Field(description="Anomalie de NDVI (%, à partir de 2000)")
    alerte_secheresse: bool | None = Field(description="Alerte sécheresse de la source")
    alerte_exces_pluie: bool | None = Field(description="Alerte excès de pluie de la source")
    risque_saison: RisqueSaison | None = Field(description="Combinaison des deux alertes")
    score_vulnerabilite: float | None = Field(description="Vulnérabilité relative 0-100 (même valeur pour toutes les campagnes)")
    classe_vulnerabilite: ClasseVulnerabilite | None = Field(description="Quintile de vulnérabilité")
    source_calendrier: str | None = Field(description="`CHIRPS journalier` ou `NASA POWER` (Guédiawaye)")


class SuiviDecadaire(Territoire):
    """MART_SUIVI_DECADAIRE : un département, une année civile, une décade."""

    annee: int = Field(description="Année civile", examples=[2025])
    campagne_agricole: int = Field(description="Campagne (janvier-mai rattachés à N-1)", examples=[2025])
    numero_decade_annee: int = Field(description="Décade 1 à 36 (saison des pluies : 16 à 30)", ge=1, le=36, examples=[22])
    libelle_decade: str | None = Field(description="Libellé de la décade", examples=["1-10 aout"])
    est_decade_saison: bool | None = Field(description="Décade 16 à 30")
    pluie_mm: float | None = Field(description="Pluie observée (mm)", examples=[98.32])
    pluie_normale_mm: float | None = Field(description="Normale 1991-2020, moyenne (mm)", examples=[93.65])
    ecart_pluie_mm: float | None = Field(description="Observé − normale (mm)")
    anomalie_pluie_pct: float | None = Field(description="Anomalie (%) ; NULL si la normale est < 1 mm")
    cumul_depuis_juin_mm: float | None = Field(description="Cumul depuis le 1er juin (décades 16-30)")
    cumul_normale_depuis_juin_mm: float | None = Field(description="Cumul normal depuis le 1er juin (décades 16-30)")
    ecart_cumul_normale_mm: float | None = Field(description="Cumul observé − cumul normal (mm)")
    part_saison_pct: float | None = Field(description="Part de la décade dans la saison (%)")
    pluie_1_annee_sur_5_mm: float | None = Field(description="Quantile bas 1991-2020 (mm)")
    pluie_mediane_mm: float | None = Field(description="Médiane 1991-2020 (mm)")
    pluie_4_annees_sur_5_mm: float | None = Field(description="Quantile haut 1991-2020 (mm)")
    proba_decade_seche_pct: float | None = Field(description="Probabilité d'une décade sèche, < 10 mm (%)")
    nb_jours_pluie: float | None = Field(description="Jours de pluie dans la décade")
    plus_longue_sequence_seche_j: float | None = Field(description="Plus longue séquence sèche de la décade (jours)")
    decade_seche: bool | None = Field(description="Décade sèche (n'a de sens qu'en saison)")
