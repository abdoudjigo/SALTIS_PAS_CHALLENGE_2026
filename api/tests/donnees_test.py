"""Marts synthétiques, au format rendu par Snowflake (clés en minuscules, Decimal, textes numériques)."""

from decimal import Decimal

from api.marts import MARTS

KOLDA = dict(code_departement="SEN.7.1_1", departement="Kolda", code_region="SEN.7_1", region="Kolda", zone_agroecologique="CASAMANCE")
SAINT_LOUIS = dict(
    code_departement="SEN.10.3_1", departement="Saint-Louis", code_region="SEN.10_1", region="Saint-Louis",
    zone_agroecologique="VALLÉE DU FLEUVE SÉNÉGAL",
)
GUEDIAWAYE = dict(code_departement="SEN.1.2_1", departement="Guédiawaye", code_region="SEN.1_1", region="Dakar", zone_agroecologique="NIAYES")
TERRITOIRES = [KOLDA, SAINT_LOUIS, GUEDIAWAYE]
COORDONNEES = {
    "SEN.7.1_1": dict(latitude=Decimal("12.8939"), longitude=Decimal("-14.9406")),
    "SEN.10.3_1": dict(latitude=Decimal("16.0179"), longitude=Decimal("-16.4896"), zone_secondaire="Niayes (frange côtière)"),
    "SEN.1.2_1": dict(latitude=Decimal("14.7722"), longitude=Decimal("-17.3979")),
}


def ligne(cle_mart: str, **valeurs):
    """Toutes les colonnes du contrat à NULL, puis les valeurs données."""
    base = {nom: None for nom in MARTS[cle_mart].modele.model_fields}
    base.update(valeurs)
    return base


def marts_synthetiques() -> dict[str, list[dict]]:
    carte = [
        ligne("carte", **t, campagne_agricole=c, pluie_saison_mm=Decimal("800.50"), classe_saison="normale", risque_saison="normal",
              alerte_secheresse=False, alerte_exces_pluie=False, **COORDONNEES[t["code_departement"]])
        for t in TERRITOIRES for c in (2023, 2024)
    ]
    suivi = [
        ligne("suivi", **t, annee=2024, campagne_agricole=2024 if d >= 16 else 2023, numero_decade_annee=d,
              libelle_decade=f"décade {d}", est_decade_saison=16 <= d <= 30, pluie_mm="12.5", pluie_normale_mm="10.25",
              ecart_pluie_mm=2.25, decade_seche=False)
        for t in (KOLDA, SAINT_LOUIS) for d in range(36, 0, -1)  # ordre inversé : la construction doit trier
    ]
    cultures = [
        ligne("cultures", **t, culture=c, type_option="CYCLE", option=o, cycle_jours=Decimal("90.0"),
              proba_cycle_couvert_pct=Decimal(str(p)), rang_option=r, niveau_adequation="adaptée",
              methode_niveau="FAO décadaire v1, ancrage sur le cycle moyen de la source", niveau_adequation_source="à risque")
        for t in TERRITOIRES
        for c in ("MIL (SOUNA)", "MAÏS")
        for o, p, r in (("courte", 100, 1), ("moyenne", 90, 2), ("longue", 40, 3))
    ] + [
        ligne("cultures", **KOLDA, culture="MIL (SOUNA)", type_option="VARIETE", option="Mil sanio (variété locale, type tardif)",
              proba_cycle_couvert_pct=Decimal("96.67"), rang_option=1, niveau_adequation="adaptée", zones_recommandees="Casamance")
    ]
    commun_besoin = dict(annees_reference="2019-2021", type_superficie="semée", reference_anterieure_2015=False,
                         statut_validation_engrais="NON_VERIFIEE", statut_validation_semis="A_COMPLETER")
    besoins = [
        ligne("besoins", **KOLDA, **commun_besoin, culture="MIL (SOUNA)", superficie_reference_ha=Decimal("1000.00"),
              besoin_uree_t=Decimal("75.00"), besoin_semences_retenu_t=None, besoin_semences_applicable=True,
              libelle_besoin_engrais="calculé", libelle_semences="dose à saisir", irrigation_requise=False),
        ligne("besoins", **KOLDA, **commun_besoin, culture="RIZ (IRRIGUÉ)", superficie_reference_ha=Decimal("200.00"),
              besoin_uree_t=Decimal("30.00"), besoin_semences_t=Decimal("8.00"), besoin_semences_retenu_t=None,
              besoin_semences_applicable=False, libelle_semences="non applicable (riz pluvial)", irrigation_requise=False),
        ligne("besoins", **SAINT_LOUIS, **commun_besoin, culture="MIL (SOUNA)", superficie_reference_ha=Decimal("500.00"),
              besoin_uree_t=Decimal("37.50"), besoin_semences_retenu_t=Decimal("2.50"), besoin_semences_applicable=True,
              irrigation_requise=False),
        ligne("besoins", **SAINT_LOUIS, **commun_besoin, culture="RIZ (IRRIGUÉ)", superficie_reference_ha=Decimal("300.00"),
              besoin_uree_t=None, besoin_semences_retenu_t=Decimal("1.00"), besoin_semences_applicable=True,
              libelle_besoin_engrais="dose à saisir", irrigation_requise=True, irrigation_totale_m3=Decimal("1000000.0000")),
        ligne("besoins", **GUEDIAWAYE, culture=None, message_departement="pas de superficie agricole de référence"),
    ]
    agrodistrib = [
        ligne("agrodistrib", **{k: v for k, v in b.items() if k in MARTS["agrodistrib"].modele.model_fields},
              niveau_source_potentiel="ZONE", potentiel_evalue=True)
        for b in besoins if b["culture"]
    ]
    vulnerabilite = [
        ligne("vulnerabilite", **SAINT_LOUIS, score_vulnerabilite=Decimal("90.1"), rang_vulnerabilite=1,
              classe_vulnerabilite="très élevée (relatif)", confiance_rendement="normale", methode_version="v1"),
        ligne("vulnerabilite", **KOLDA, score_vulnerabilite=Decimal("23.7"), rang_vulnerabilite=2,
              classe_vulnerabilite="très faible (relatif)", confiance_rendement="normale", methode_version="v1"),
        ligne("vulnerabilite", **GUEDIAWAYE, methode_version="v1"),
    ]
    return {"carte": carte, "suivi": suivi, "cultures": cultures, "besoins": besoins, "agrodistrib": agrodistrib,
            "vulnerabilite": vulnerabilite}
