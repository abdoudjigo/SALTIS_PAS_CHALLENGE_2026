"""Tests du moteur AgroDistrib.  Lancer : venv/bin/python -m pytest ml/tests"""

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from ml.agrodistrib.moteur import STATUT_SAISIE, au_prorata, proposer_scenarios

RACINE = Path(__file__).resolve().parents[2]
COPIE = RACINE / "ml" / "donnees" / "mart_territoires_agrodistrib.parquet"
SORTIES = RACINE / "ml" / "sorties"


def territoires_exemple() -> pd.DataFrame:
    """6 couples département × culture, sur 2 zones et 2 régions qui ne s'emboîtent pas."""
    l = [  # dept, région, zone, culture, superficie, besoin NPK, vulnérabilité, potentiel, cycle, sèche
        ("D1", "R1", "Z1", "MIL", 1000, 120.0, 80, 300, 90, 30),
        ("D2", "R1", "Z1", "MIL", 2000, 250.0, 60, 300, 85, 25),
        ("D3", "R2", "Z1", "MIL", 500, 60.0, 20, 300, 95, 20),
        ("D4", "R2", "Z2", "MIL", 1500, 180.0, None, 500, 70, 15),   # vulnérabilité vide
        ("D1", "R1", "Z1", "NIEBE", 800, None, 80, 150, 80, 30),     # pas de dose
        ("D3", "R2", "Z1", "NIEBE", 400, None, 20, 150, 90, 20),     # pas de dose
    ]
    t = pd.DataFrame(l, columns=["code_departement", "code_region", "zone_agroecologique", "culture",
                                 "superficie_reference_ha", "besoin_npk_15_15_15_t", "score_vulnerabilite",
                                 "potentiel_gain_kg_ha", "proba_cycle_couvert_moyen_pct", "proba_saison_seche_pct"])
    t["departement"] = "Dép. " + t.code_departement
    t["region"] = "Région " + t.code_region
    t["statut_validation_engrais"] = np.where(t.besoin_npk_15_15_15_t.notna(), "NON_VERIFIEE", "A_COMPLETER")
    t["potentiel_evalue"] = True
    t["niveau_source_potentiel"] = "ZONE"
    return t


def test_contraintes_respectees():
    r = proposer_scenarios(territoires_exemple(), "NPK_15_15_15", ["MIL"], 300, niveau="ZONE")
    assert set(r.scenarios.scenario) == {"Équité", "Équilibré", "Rendement"}
    for nom, d in r.departements.groupby("scenario"):
        assert d.quantite_proposee_t.sum() == pytest.approx(300, abs=1e-6), nom
        assert (d.quantite_proposee_t <= d.besoin_t + 1e-9).all(), nom
        assert (d.quantite_proposee_t > 0).all(), nom          # tout couple avec un besoin est servi
    assert r.scenarios.choisi_par_le_decideur.sum() == 1


@pytest.mark.parametrize("niveau,attendus", [("ZONE", {"Z1", "Z2"}), ("REGION", {"R1", "R2"}),
                                             ("DEPARTEMENT", {"D1", "D2", "D3", "D4"})])
def test_agregation_par_somme(niveau, attendus):
    r = proposer_scenarios(territoires_exemple(), "NPK_15_15_15", ["MIL"], 300, niveau=niveau)
    assert set(r.territoires.code_territoire) == attendus
    for nom, d in r.departements.groupby("scenario"):
        t = r.territoires[r.territoires.scenario == nom]
        assert t.quantite_proposee_t.sum() == pytest.approx(d.quantite_proposee_t.sum())
        assert t.besoin_t.sum() == pytest.approx(d.besoin_t.sum())


def test_alpha_deplace_vers_le_critere():
    r = proposer_scenarios(territoires_exemple(), "NPK_15_15_15", ["MIL"], 300)
    s = r.scenarios.set_index("scenario")
    assert s.loc["Équité", "vulnerabilite_moyenne_d_une_tonne"] > s.loc["Rendement", "vulnerabilite_moyenne_d_une_tonne"]
    assert s.loc["Rendement", "valeur_indicative_d_une_tonne"] > s.loc["Équité", "valeur_indicative_d_une_tonne"]


def test_alpha_personnalise_ajoute_un_scenario():
    r = proposer_scenarios(territoires_exemple(), "NPK_15_15_15", ["MIL"], 300, alpha=0.3)
    assert "Personnalisé" in set(r.scenarios.scenario)
    assert r.scenarios.set_index("scenario").loc["Personnalisé", "choisi_par_le_decideur"]


def test_critere_vide_remplace_par_la_mediane_et_signale():
    r = proposer_scenarios(territoires_exemple(), "NPK_15_15_15", ["MIL"], 300)
    d = r.departements[r.departements.scenario == "Équilibré"].set_index("code_departement")
    assert d.loc["D4", "critere_impute"] == "vulnérabilité"
    assert d.loc["D4", "vulnerabilite"] == pytest.approx(np.median([0.8, 0.6, 0.2]))
    assert pd.isna(d.loc["D4", "score_vulnerabilite"])         # la valeur source reste vide
    assert d.drop("D4").critere_impute.isna().all()


def test_dose_manquante_listee_et_non_servie():
    r = proposer_scenarios(territoires_exemple(), "NPK_15_15_15", ["MIL", "NIEBE"], 300)
    assert set(r.departements.culture) == {"MIL"}
    assert len(r.doses_a_saisir) == 2 and set(r.doses_a_saisir.culture) == {"NIEBE"}


def test_dose_saisie_complete_sans_ecraser():
    r = proposer_scenarios(territoires_exemple(), "NPK_15_15_15", ["MIL", "NIEBE"], 300,
                           doses_saisies={"NIEBE": 100, "MIL": 999})
    d = r.departements[r.departements.scenario == "Équilibré"].set_index(["code_departement", "culture"])
    assert d.loc[("D1", "NIEBE"), "besoin_t"] == pytest.approx(80)       # 800 ha × 100 kg/ha
    assert d.loc[("D1", "NIEBE"), "statut_dose"] == STATUT_SAISIE
    assert d.loc[("D1", "MIL"), "besoin_t"] == pytest.approx(120)        # dose existante conservée
    assert r.doses_a_saisir.empty


def test_stock_superieur_au_besoin():
    r = proposer_scenarios(territoires_exemple(), "NPK_15_15_15", ["MIL"], 1000)
    s = r.scenarios.iloc[0]
    assert s.stock_reparti_t == pytest.approx(610) and s.stock_non_reparti_t == pytest.approx(390)
    assert (r.departements.couverture_pct == 100).all()


@pytest.mark.parametrize("args,message", [
    (dict(code_intrant="N"), "intrant"), (dict(code_intrant="EAU_IRRIGATION"), "intrant"),
    (dict(stock_t=0), "stock"), (dict(alpha=1.5), "α"), (dict(niveau="PAYS"), "niveau"),
    (dict(cultures=["RIZ"]), "absente"), (dict(cultures=["NIEBE"]), "aucun besoin"),
    (dict(doses_saisies={"NIEBE": -1}), "dose saisie"),
])
def test_entrees_refusees(args, message):
    base = dict(code_intrant="NPK_15_15_15", cultures=["MIL"], stock_t=300)
    with pytest.raises(ValueError, match=message):
        proposer_scenarios(territoires_exemple(), **{**base, **args})


def test_prorata_plafonne_redistribue():
    x = au_prorata(np.array([10.0, 100.0]), np.array([1000.0, 1.0]), 50)
    assert x == pytest.approx([10, 40])


# --- Sur les vraies données : le cas du rapport de comparaison ----------------------------------

@pytest.mark.skipif(not COPIE.exists(), reason="copie locale de MART_TERRITOIRES_AGRODISTRIB absente")
def test_reproduit_la_comparaison_du_rapport():
    """20 000 t de NPK pour le mil : mêmes quantités que ml/comparaison/agrodistrib.py."""
    r = proposer_scenarios(pd.read_parquet(COPIE), "NPK_15_15_15", ["MIL (SOUNA)"], 20_000)
    reference = pd.read_csv(SORTIES / "comparaison_agrodistrib_departements.csv").set_index("code_departement")
    correspondance = {"Équité": "Prorata pondéré par la vulnérabilité",
                      "Rendement": "Prorata pondéré par la valeur indicative",
                      "Équilibré": "Prorata multicritère (valeur et vulnérabilité)"}
    for scenario, methode in correspondance.items():
        d = r.departements[r.departements.scenario == scenario].set_index("code_departement")
        assert len(d) == 41
        ecart = (d.quantite_proposee_t - reference.loc[d.index, methode]).abs()
        assert ecart.max() < 0.051, scenario                    # la référence est arrondie à 0,1 t
    # Indicateurs : moyennes et Gini identiques. Les gains de la comparaison partent de moyennes
    # déjà arrondies à 3 décimales ; le moteur les calcule sans arrondi (écart ≤ 0,2 point).
    comparaison = pd.read_csv(SORTIES / "comparaison_agrodistrib.csv").set_index("methode")
    for scenario, methode in correspondance.items():
        s, c = r.scenarios.set_index("scenario").loc[scenario], comparaison.loc[methode]
        for col in ["gini_couverture", "vulnerabilite_moyenne_d_une_tonne", "valeur_indicative_d_une_tonne"]:
            assert s[col] == pytest.approx(c[col], abs=1e-9), (scenario, col)
        for col in ["gain_ciblage_vulnerabilite_pct", "gain_valeur_indicative_pct"]:
            assert s[col] == pytest.approx(c[col], abs=0.3), (scenario, col)
    assert not r.departements.critere_impute.notna().any()
