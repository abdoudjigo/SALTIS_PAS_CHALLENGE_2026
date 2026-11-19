from datetime import datetime, timezone

import pytest

from api.cache import cles
from api.cache.construction import ErreurContrat, agreger, construire, valider

from .donnees_test import marts_synthetiques


def _valides():
    valides, _ = valider(marts_synthetiques())
    return valides


def test_valider_convertit_les_types():
    valides = _valides()
    s = valides["suivi"][0]
    assert isinstance(s.pluie_mm, float) and s.pluie_mm == 12.5  # TEXT dans Snowflake
    assert isinstance(valides["carte"][0].pluie_saison_mm, float)


def test_colonne_hors_contrat_signalee_et_ignoree():
    bruts = marts_synthetiques()
    for ligne in bruts["carte"]:
        ligne["nouvelle_colonne"] = 1
    _, ignorees = valider(bruts)
    assert ignorees == {"carte": ["nouvelle_colonne"]}


def test_colonne_manquante_refusee():
    bruts = marts_synthetiques()
    for ligne in bruts["besoins"]:
        del ligne["besoin_uree_t"]
    with pytest.raises(ErreurContrat, match="MART_BESOINS"):
        valider(bruts)


def test_valeur_hors_enumeration_refusee():
    bruts = marts_synthetiques()
    bruts["carte"][0]["risque_saison"] = "inconnu"
    with pytest.raises(ErreurContrat, match="MART_CARTE_AGROCLIMAT"):
        valider(bruts)


def test_mart_vide_refuse():
    bruts = marts_synthetiques()
    bruts["vulnerabilite"] = []
    with pytest.raises(ErreurContrat, match="aucune ligne"):
        valider(bruts)


def _non_applicables(valides):
    return {(b.code_departement, b.culture) for b in valides["besoins"] if b.culture and b.besoin_semences_applicable is False}


def test_agregat_national_null_jamais_compte_comme_zero():
    valides = _valides()
    lignes = [b for b in valides["besoins"] if b.culture]
    (national,) = agreger(lignes, "NATIONAL", None, True, _non_applicables(valides))
    assert national.code == "SEN" and national.nb_departements == 2 and national.nb_lignes == 4
    assert national.superficie_reference_ha == 2000.0
    assert national.besoin_uree_t == 142.5  # 75 + 30 + 37,5 ; la dose à saisir est exclue…
    assert national.valeurs_manquantes["besoin_uree_t"] == 1  # …et comptée
    # Semences : le riz pluvial (non applicable) n'est pas une valeur manquante.
    assert national.besoin_semences_retenu_t == 3.5
    assert national.valeurs_manquantes["besoin_semences_retenu_t"] == 1
    # Irrigation : seulement les cultures en irrigation requise.
    assert national.irrigation_totale_m3 == 1_000_000.0
    assert "irrigation_totale_m3" not in national.valeurs_manquantes
    # Aucune valeur connue → NULL, pas 0.
    assert national.besoin_dap_t is None and national.valeurs_manquantes["besoin_dap_t"] == 4


def test_agregat_par_region_et_par_zone():
    valides = _valides()
    lignes = [b for b in valides["besoins"] if b.culture]
    regions = agreger(lignes, "REGION", None, True, set())
    assert [(r.code, r.libelle) for r in regions] == [("SEN.7_1", "Kolda"), ("SEN.10_1", "Saint-Louis")]
    zones = agreger(lignes, "ZONE", "MIL (SOUNA)", False, set())
    assert {z.code for z in zones} == {"CASAMANCE", "VALLÉE DU FLEUVE SÉNÉGAL"}
    assert all(z.irrigation_totale_m3 is None and z.culture == "MIL (SOUNA)" for z in zones)


def test_construction_cles_et_index():
    valides = _valides()
    instant = datetime(2026, 11, 11, tzinfo=timezone.utc)
    c = construire(valides, "vTEST", instant, "SALTIS.MARTS")
    stockees = {k.removesuffix(cles.SUFFIXE_GZIP) for k in c.reponses}
    for cle in [
        cles.ref("departements"), cles.carte_campagne(2024), cles.carte_departement("SEN.7.1_1"),
        cles.suivi("SEN.7.1_1", 2024, False), cles.suivi("SEN.7.1_1", 2024, True),
        cles.cultures("SEN.7.1_1", None), cles.cultures("SEN.7.1_1", "MAÏS"),
        cles.besoins("SEN.1.2_1", None), cles.besoins_totaux("ZONE", "RIZ (IRRIGUÉ)"),
        cles.agrodistrib_territoires(None), cles.agrodistrib_agregats("REGION", "MIL (SOUNA)"),
        cles.vulnerabilite_classement(), cles.vulnerabilite_departement("SEN.1.2_1"),
    ]:
        assert cle in stockees, cle
    assert c.nb_cles == len(c.reponses)
    assert c.index.departements_suivi == ["SEN.10.3_1", "SEN.7.1_1"]
    assert c.index.resoudre_culture("mais") == "MAÏS"
    assert c.index.resoudre_culture("  riz (irrigue) ") == "RIZ (IRRIGUÉ)"
    assert c.index.resoudre_culture("banane") is None
