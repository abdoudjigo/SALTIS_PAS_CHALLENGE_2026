"""Module C : besoins de référence en intrants."""

from typing import Literal

from pydantic import Field

from .commun import Coherence, LibelleProduit, StatutValidation, Territoire


class Besoin(Territoire):
    """MART_BESOINS : un département, une culture. Besoins de référence **historiques, pas prévisionnels**."""

    culture: str | None = Field(description="Culture ; NULL pour Guédiawaye et Pikine (aucune superficie)", examples=["MIL (SOUNA)"])
    message_departement: str | None = Field(description="« pas de superficie agricole de référence » pour Guédiawaye et Pikine")
    superficie_reference_ha: float | None = Field(description="Superficie de référence (ha)", examples=[7936.0])
    annees_reference: str | None = Field(description="Années de référence", examples=["2019-2021"])
    type_superficie: Literal["semée", "récoltée"] | None = Field(description="Type de superficie")
    reference_anterieure_2015: bool | None = Field(description="Référence ancienne (dernière année < 2015)")
    besoin_azote_n_t: float | None = Field(description="Azote N (t) — élément", examples=[491.08])
    besoin_phosphate_p2o5_t: float | None = Field(description="Phosphate P2O5 (t) — élément")
    besoin_potasse_k2o_t: float | None = Field(description="Potasse K2O (t) — élément")
    besoin_npk_15_15_15_t: float | None = Field(description="NPK 15-15-15 (t) — produit")
    besoin_npk_15_10_10_t: float | None = Field(None, description="NPK 15-10-10 (t) — produit, additif")
    besoin_npk_6_20_10_t: float | None = Field(None, description="NPK 6-20-10 (t) — produit, additif", examples=[8249.95])
    besoin_uree_t: float | None = Field(description="Urée (t) — produit")
    besoin_dap_t: float | None = Field(description="DAP 18-46-0 (t) — produit")
    besoin_fumier_t: float | None = Field(description="Fumier (t) : toujours NULL (non chiffré), hors totaux, budget et répartition")
    libelle_npk_15_15_15: LibelleProduit | None = Field(None, description="État du besoin en NPK 15-15-15")
    libelle_npk_15_10_10: LibelleProduit | None = Field(None, description="État du besoin en NPK 15-10-10")
    libelle_npk_6_20_10: LibelleProduit | None = Field(None, description="État du besoin en NPK 6-20-10")
    libelle_uree: LibelleProduit | None = Field(None, description="État du besoin en urée")
    libelle_dap: LibelleProduit | None = Field(None, description="État du besoin en DAP")
    note_dap: str | None = Field(None, description="Phosphate de fond exclu du besoin annuel, quand c'est le cas")
    libelle_fumier: str | None = Field(None, description="« non chiffré : fumure organique conseillée si possible »")
    libelle_besoin_engrais: Literal["calculé", "dose à saisir", "superficie de référence nulle"] | None
    besoin_semences_t: float | None = Field(description="Semences, valeur de la source (t)")
    besoin_semences_applicable: bool | None = Field(description="Vrai partout depuis la dose PIA du riz pluvial ; faux = dose de semis non applicable")
    besoin_semences_retenu_t: float | None = Field(description="Semences à totaliser (t)")
    libelle_semences: Literal["calculé", "dose à saisir", "non applicable (riz pluvial)", "superficie de référence nulle"] | None
    besoin_irrigation_mm: float | None = Field(description="Besoin d'irrigation de la zone (mm, FAO-56), non additif")
    volume_irrigation_m3_ha: float | None = Field(description="Volume d'irrigation de la zone (m³/ha), non additif")
    irrigation_requise: bool | None = Field(description="Culture en « irrigation requise »")
    irrigation_totale_m3: float | None = Field(description="Volume total (m³), seulement si irrigation requise")
    statut_validation_engrais: StatutValidation | None = Field(description="Statut de la dose d'engrais retenue")
    source_reference_engrais: str | None = Field(description="Source de la dose d'engrais retenue (recherche de la zone, catalogue PIA…)")
    statut_validation_semis: StatutValidation | None = Field(description="Statut de la dose de semis retenue")
    source_reference_semis: str | None = Field(description="Source de la dose de semis retenue")
    coherence_dose_n: Coherence | None
    coherence_dose_semis: Coherence | None
