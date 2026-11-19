"""Module D : critères de répartition AgroDistrib, vulnérabilité, agrégats additifs."""

from pydantic import BaseModel, Field

from .commun import ClasseVulnerabilite, Confiance, LibelleProduit, NiveauAdequation, NiveauAgregat, StatutValidation, Territoire


class TerritoireAgrodistrib(Territoire):
    """MART_TERRITOIRES_AGRODISTRIB : un département, une culture cultivée (superficie > 0)."""

    culture: str = Field(examples=["MIL (SOUNA)"])
    # Additifs
    superficie_reference_ha: float | None = Field(description="Additif (ha)")
    besoin_azote_n_t: float | None = Field(description="Additif (t)")
    besoin_phosphate_p2o5_t: float | None = Field(description="Additif (t)")
    besoin_potasse_k2o_t: float | None = Field(description="Additif (t)")
    besoin_npk_15_15_15_t: float | None = Field(description="Additif (t)")
    besoin_npk_15_10_10_t: float | None = Field(None, description="Additif (t)")
    besoin_npk_6_20_10_t: float | None = Field(None, description="Additif (t)")
    besoin_uree_t: float | None = Field(description="Additif (t)")
    besoin_dap_t: float | None = Field(description="Additif (t)")
    besoin_fumier_t: float | None = Field(description="Toujours NULL (non chiffré) : hors totaux, budget et répartition")
    besoin_semences_retenu_t: float | None = Field(description="Additif (t) ; NULL si la dose de semis n'est pas applicable")
    besoin_semences_applicable: bool | None = Field(None, description="Vrai partout depuis la dose PIA du riz pluvial ; faux = non applicable")
    libelle_npk_15_15_15: LibelleProduit | None = None
    libelle_npk_15_10_10: LibelleProduit | None = None
    libelle_npk_6_20_10: LibelleProduit | None = None
    libelle_uree: LibelleProduit | None = None
    libelle_dap: LibelleProduit | None = None
    note_dap: str | None = Field(None, description="Phosphate de fond exclu du besoin annuel, quand c'est le cas")
    libelle_fumier: str | None = Field(None, description="« non chiffré : fumure organique conseillée si possible »")
    statut_validation_engrais: StatutValidation | None
    source_reference_engrais: str | None = Field(None, description="Source de la dose d'engrais retenue")
    statut_validation_semis: StatutValidation | None
    source_reference_semis: str | None = Field(None, description="Source de la dose de semis retenue")
    # Potentiel de gain (valeurs de zone, non additives)
    niveau_source_potentiel: str | None = Field(description="`ZONE` : valeur de zone portée sur le département")
    rendement_moyen_kg_ha: float | None
    rendement_atteignable_kg_ha: float | None
    ecart_rendement_kg_ha: float | None
    potentiel_evalue: bool | None
    potentiel_gain_kg_ha: float | None = Field(description="NULL quand le rendement est national (non évalué au niveau de la zone)")
    # Capacité à valoriser
    meilleur_niveau_adequation: NiveauAdequation | None
    proba_cycle_couvert_moyen_pct: float | None
    facteur_limitant_principal: str | None = Field(description="Valeur de zone")
    proba_saison_seche_pct: float | None
    # Sol
    classe_texture: str | None
    ph_eau: float | None
    reserve_utile_mm: float | None
    carbone_organique_g_kg: float | None
    amendement_ph_recommande: bool | None = Field(description="Valeur de zone")
    fractionnement_azote_recommande: bool | None = Field(description="Valeur de zone")
    # Vulnérabilité
    score_vulnerabilite: float | None
    classe_vulnerabilite: ClasseVulnerabilite | None
    score_alea_secheresse: float | None
    confiance_rendement: Confiance | None
    methode_version_vulnerabilite: str | None
    part_cultures_pct: float | None


class Vulnerabilite(Territoire):
    """MART_VULNERABILITE_DEPARTEMENT : un département. Score **relatif et indicatif** (méthode v1)."""

    score_vulnerabilite: float | None = Field(description="0-100, 100 = le plus vulnérable", examples=[23.7])
    rang_vulnerabilite: int | None = Field(description="1 = le plus vulnérable", examples=[39])
    classe_vulnerabilite: ClasseVulnerabilite | None
    score_alea_secheresse: float | None = Field(description="Sous-score aléa sécheresse (60 %)")
    score_sensibilite_rendement: float | None = Field(description="Sous-score sensibilité des rendements (40 %)")
    nb_dimensions_disponibles: int | None
    confiance_rendement: Confiance | None
    freq_alerte_secheresse_pct: float | None
    variabilite_pluie_cv_pct: float | None
    pluie_saison_annee_seche_mm: float | None
    variabilite_rendement_pct: float | None
    tendance_rendement_pct_an: float | None
    nb_cultures_rendement: int | None
    nb_campagnes_rendement: int | None
    rang_alerte_secheresse: float | None
    rang_variabilite_pluie: float | None
    rang_pluie_annee_seche: float | None
    rang_variabilite_rendement: float | None
    rang_tendance_rendement: float | None
    freq_alerte_exces_pct: float | None = Field(description="Hors score")
    proba_saison_seche_pct: float | None = Field(description="Hors score")
    proba_sequence_seche_15j_pct: float | None = Field(description="Hors score")
    part_cultures_pct: float | None = Field(description="Hors score")
    methode_version: str | None
    periode_climat: str | None
    periode_rendement: str | None
    nb_saisons_1991_2020: int | None


class Agregat(BaseModel):
    """Somme des **seules colonnes additives** sur un territoire (national, région ou zone).

    Les besoins d'une zone ou d'une région sont la somme de ses départements ; aucune valeur
    de zone n'est recopiée puis additionnée. Un NULL (dose à saisir, non applicable) n'est
    jamais compté comme 0 : il est exclu de la somme et compté dans `valeurs_manquantes`.
    """

    niveau: NiveauAgregat
    code: str = Field(description="`SEN` (national), code GADM de la région, ou nom de la zone", examples=["SEN.7_1"])
    libelle: str = Field(examples=["Kolda"])
    culture: str | None = Field(description="NULL = toutes cultures")
    nb_departements: int
    nb_lignes: int = Field(description="Lignes département × culture agrégées")
    superficie_reference_ha: float | None
    besoin_azote_n_t: float | None
    besoin_phosphate_p2o5_t: float | None
    besoin_potasse_k2o_t: float | None
    besoin_npk_15_15_15_t: float | None
    besoin_npk_15_10_10_t: float | None
    besoin_npk_6_20_10_t: float | None
    besoin_uree_t: float | None
    besoin_dap_t: float | None
    besoin_semences_retenu_t: float | None
    irrigation_totale_m3: float | None = Field(default=None, description="Besoins seulement : cultures en irrigation requise")
    valeurs_manquantes: dict[str, int] = Field(
        description="Par colonne, nombre de lignes à NULL exclues de la somme : si > 0, le total est partiel",
        examples=[{"besoin_semences_retenu_t": 9}],
    )
