"""Module B : choix des cultures, des cycles et des variétés."""

from typing import Literal

from pydantic import Field

from .commun import NiveauAdequation, Territoire


class ChoixCulture(Territoire):
    """MART_CHOIX_CULTURES : un département, une culture, un type d'option, une option."""

    culture: str = Field(description="Culture (majuscules)", examples=["MIL (SOUNA)"])
    type_option: Literal["CYCLE", "VARIETE"] = Field(description="`CYCLE` (courte / moyenne / longue) ou `VARIETE`")
    option: str = Field(description="Cycle ou nom de la variété", examples=["moyenne"])
    cycle_jours: float | None = Field(description="Durée du cycle (jours)", examples=[90])
    proba_cycle_couvert_pct: float | None = Field(
        description="Part des années 1991-2020 où la saison couvre le cycle (%). **Critère de comparaison des options.**",
        examples=[100.0],
    )
    rang_option: int | None = Field(description="1 = meilleure probabilité au sein du département × culture × type d'option")
    score_adequation: float | None = Field(description="Cycles seulement : 0,6 × proba cycle + 0,4 × proba eau **du cycle**")
    proba_besoin_eau_couvert_pct: float | None = Field(
        description="Cycles seulement : part des années 1991-2020 où la pluie efficace couvre au moins 80 % du besoin en eau du cycle (%). "
        "Cycle moyen : valeur de la source ; cycles court et long : cycle moyen de la source + écart décadaire FAO entre cycles"
    )
    nb_annees_calc: int | None = Field(None, description="Années utilisées par le calcul décadaire (28 à 30)")
    niveau_adequation: NiveauAdequation | None = Field(description="Cultures : adaptée si score > 80, à risque si > 50 ; variétés : adaptée dès 80 %")
    methode_niveau: str | None = Field(
        None, description="Origine du niveau : calcul FAO décadaire de l'équipe (ancré sur le cycle moyen de la source) ou `source`"
    )
    note_score: str | None = Field(description="Précise l'origine de la probabilité eau du cycle")
    score_adequation_source: float | None = Field(None, description="Score de la source, pour comparaison")
    proba_besoin_eau_couvert_pct_source: float | None = Field(None, description="Probabilité eau de la source (cycle moyen recopié), pour comparaison")
    niveau_adequation_source: NiveauAdequation | None = Field(None, description="Niveau de la source, pour comparaison")
    tolerance_secheresse: str | None = Field(description="Variétés seulement")
    disponibilite_semences: str | None = Field(description="Variétés seulement")
    zones_recommandees: str | None = Field(description="Variétés seulement")
