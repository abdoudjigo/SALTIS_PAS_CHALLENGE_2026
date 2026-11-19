"""Prix des intrants (DIM_PRIX_INTRANT), par produit et par campagne."""

from typing import Literal

from pydantic import Field

from .commun import Modele

StatutPrix = Literal["VALIDEE", "A_CONFIRMER", "A_SAISIR"]


class PrixIntrant(Modele):
    """DIM_PRIX_INTRANT : un produit, une campagne. Prix NULL = « à saisir », jamais 0."""

    code_intrant: str = Field(examples=["NPK_6_20_10"])
    nom_intrant: str | None = Field(None, description="Nom du produit (référentiel des intrants de l'API)", examples=["NPK 6-20-10"])
    campagne: int = Field(examples=[2026])
    prix_cession_sac_50kg_fcfa: float | None = Field(description="Prix payé par le producteur, subventionné (FCFA / sac de 50 kg)",
                                                     examples=[6000.0])
    subvention_tonne_fcfa: float | None = Field(description="Subvention de l'État (FCFA / t)", examples=[265000.0])
    cout_reel_sac_50kg_fcfa: float | None = Field(description="Prix de cession + subvention / 20 (FCFA / sac de 50 kg)",
                                                  examples=[19250.0])
    statut_validation: StatutPrix = Field(description="`A_SAISIR` : prix non trouvé, valeurs NULL")
    source: str | None = Field(description="Source citée du prix ou motif de l'absence")
