"""Routes /previsions : résultats des modèles d'IA (SALTIS.ML), facultatifs."""

import asyncio
from datetime import date

import pytest
from fastapi.testclient import TestClient

from api.main import creer_app

from .conftest import service_test
from .donnees_test import GUEDIAWAYE, KOLDA, SAINT_LOUIS, ligne, marts_synthetiques

V1 = "/api/v1/previsions"
TRACE = {"version_modele": "m-test", "date_calcul": date(2026, 11, 13)}


def resultats_ml() -> dict[str, list[dict]]:
    saison = [
        ligne("prev_saison", **t, **TRACE, annee=a, type_prevision="RETROSPECTIVE_TEST", proba_seche_pct="31.4", proba_normale_pct=40.0,
             proba_humide_pct=28.6, classe_prevue="normale", pluie_prevue_mm=700.0, pluie_basse_mm=550.0, pluie_haute_mm=860.0,
             pluie_normale_mm=720.0, pluie_observee_mm=None, classe_observee=None)
        for t in (KOLDA, SAINT_LOUIS, GUEDIAWAYE) for a in (2023, 2024)
    ]
    semblables = [
        ligne("semblables", **KOLDA, **TRACE, annee=2024, moment_prevision=m, variables_utilisees="océan" if m == "FIN_MAI" else "océan + pluie tombée",
             rang=r, annee_semblable=2010 + r, ressemblance_pct=90 - r, classe_saison_semblable="humide",
             alerte_secheresse_semblable=False, proba_seche_pct=None if m == "FIN_MAI" else 15.4,
             classe_prevue=None if m == "FIN_MAI" else "humide")
        for m in ("FIN_MAI", "FIN_JUILLET") for r in (1, 2, 3)
    ]
    rendement = [
        ligne("prev_rendement", **t, **TRACE, culture=c, annee=2012, moment_prevision="FIN_JUILLET", type_prevision="RETROSPECTIVE_TEST",
             tendance_kg_ha=800.0, rendement_bas_kg_ha=500.0, rendement_median_kg_ha=780.0, rendement_haut_kg_ha=1050.0,
             proba_chute_pct=p, proba_chute_reference_pct=25.0, explication="cumul de juillet −30 %",
             rendement_fiable=False, alerte_fiable=c == "ARACHIDE")
        for t, p in ((KOLDA, 12.0), (SAINT_LOUIS, 41.0)) for c in ("ARACHIDE", "MIL (SOUNA)")
    ]
    semis = [
        ligne("semis", **t, **TRACE, annee=a, type_prevision="ANNEE_TYPE" if a is None else "RETROSPECTIVE_TEST", culture="ARACHIDE",
             cycle_jours=105.0, decade_semis=d, libelle_decade=f"décade {d}", chance_pluie_semis_pct=60.0,
             risque_faux_depart_pct=10.0, risque_fin_trop_tot_pct=5.0, risque_total_pct=14.5, decade_conseillee=d == 20)
        for t in (KOLDA, SAINT_LOUIS) for a in (None, 2024) for d in range(16, 24)
    ]
    evaluation = [
        ligne("evaluation", modele="M1", version_modele="m1-v1", periode="test 2016-2025", mesure="rpss_vs_climatologie", valeur=0.172),
        ligne("evaluation", modele="M4", version_modele="m4-v1", periode="test 2016-2025", risque="faux départ", mesure="auc_modele", valeur=0.83),
    ]
    return {"prev_saison": saison, "semblables": semblables, "prev_rendement": rendement, "semis": semis, "evaluation": evaluation}


@pytest.fixture
def client_ml():
    s = service_test(lecteur=lambda: {**marts_synthetiques(), **resultats_ml()})
    asyncio.run(s.precharger("test"))
    with TestClient(creer_app(s.p, s)) as c:
        yield c


def test_sans_resultats_ml_les_marts_restent_servis(client):
    assert client.get("/api/v1/vulnerabilite").status_code == 200
    r = client.get(f"{V1}/saison/2024")
    assert r.status_code == 404 and r.json()["erreur"]["code"] == "prevision_indisponible"
    assert client.get(f"{V1}/fiabilite").json()["erreur"]["code"] == "prevision_indisponible"


def test_saison_par_annee_et_par_departement(client_ml):
    corps = client_ml.get(f"{V1}/saison/2024").json()
    assert corps["meta"]["nb_elements"] == 3
    assert corps["meta"]["source"] == "SALTIS.ML.PREVISION_SAISONNIERE"
    assert corps["donnees"][0]["proba_seche_pct"] == 31.4  # texte numérique converti
    assert corps["meta"]["avertissements"]
    assert client_ml.get(f"{V1}/saison/1950").json()["erreur"]["code"] == "annee_inconnue"
    histo = client_ml.get(f"{V1}/saison/departements/SEN.7.1_1").json()
    assert [d["annee"] for d in histo["donnees"]] == [2023, 2024]


def test_annees_semblables_par_moment(client_ml):
    tous = client_ml.get(f"{V1}/annees-semblables/SEN.7.1_1/2024").json()
    assert tous["meta"]["nb_elements"] == 6
    fin_mai = client_ml.get(f"{V1}/annees-semblables/SEN.7.1_1/2024", params={"moment": "FIN_MAI"}).json()["donnees"]
    assert [d["rang"] for d in fin_mai] == [1, 2, 3] and fin_mai[0]["proba_seche_pct"] is None
    assert client_ml.get(f"{V1}/annees-semblables/SEN.7.1_1/2024", params={"moment": "MIDI"}).status_code == 422


def test_rendement_et_alerte(client_ml):
    kolda = client_ml.get(f"{V1}/rendement/SEN.7.1_1/2012", params={"culture": "arachide"}).json()
    assert kolda["meta"]["nb_elements"] == 1 and kolda["donnees"][0]["alerte_fiable"] is True
    r = client_ml.get(f"{V1}/rendement/SEN.7.1_1/2012", params={"culture": "maïs"})
    assert r.status_code == 404 and r.json()["erreur"]["code"] == "culture_non_modelisee"
    alerte = client_ml.get(f"{V1}/alerte-recolte/2012").json()["donnees"]
    assert [d["proba_chute_pct"] for d in alerte] == [41.0, 41.0, 12.0, 12.0]  # du plus risqué au moins risqué
    mil = client_ml.get(f"{V1}/alerte-recolte/2012", params={"culture": "mil (souna)", "moment": "FIN_JUILLET"}).json()
    assert {d["culture"] for d in mil["donnees"]} == {"MIL (SOUNA)"}


def test_semis_annee_type_et_carte(client_ml):
    frise = client_ml.get(f"{V1}/semis/departements/SEN.7.1_1", params={"culture": "ARACHIDE"}).json()["donnees"]
    assert [d["decade_semis"] for d in frise] == list(range(16, 24)) and all(d["annee"] is None for d in frise)
    assert len(client_ml.get(f"{V1}/semis/departements/SEN.7.1_1", params={"annee": 2024}).json()["donnees"]) == 8
    carte = client_ml.get(f"{V1}/semis/carte", params={"culture": "arachide"}).json()["donnees"]
    assert {d["code_departement"] for d in carte} == {"SEN.7.1_1", "SEN.10.3_1"} and all(d["decade_conseillee"] for d in carte)
    assert client_ml.get(f"{V1}/semis/departements/SEN.1.2_1").status_code == 404  # Guédiawaye : pas de pluie décadaire


def test_fiabilite(client_ml):
    assert client_ml.get(f"{V1}/fiabilite").json()["meta"]["nb_elements"] == 2
    m4 = client_ml.get(f"{V1}/fiabilite", params={"modele": "M4"}).json()["donnees"]
    assert m4 == [{"modele": "M4", "version_modele": "m4-v1", "periode": "test 2016-2025", "moment": None, "culture": None,
                   "risque": "faux départ", "variables": None, "mesure": "auc_modele", "valeur": 0.83}]


def test_secours_local_des_previsions(tmp_path):
    """SALTIS.ML non chargé : les prévisions sont lues dans ml/sorties/*.csv, territoire complété par les marts."""
    from api.source_locale import lire_resultats_ml

    (tmp_path / "risque_semis.csv").write_text(
        "code_departement,departement,annee,type_prevision,culture,cycle_jours,decade_semis,libelle_decade,"
        "chance_pluie_semis_pct,risque_faux_depart_pct,risque_fin_trop_tot_pct,risque_total_pct,decade_conseillee,"
        "proba_saison_seche_m1_pct,version_modele,date_calcul\n"
        "SEN.7.1_1,Kolda,2016.0,RETROSPECTIVE_TEST,ARACHIDE,105.0,20,2e décade de juillet,60.0,,5.0,14.5,True,31.4,m4-v1,2026-11-13\n",
        encoding="utf-8",
    )
    (tmp_path / "evaluation_m4.csv").write_text(
        "version_modele,risque,periode,nb_cas\nm4-v1,faux départ,test 2016-2025,2111\n", encoding="utf-8"
    )
    lu = lire_resultats_ml({"semis", "evaluation", "prev_saison"}, [KOLDA], tmp_path)
    assert set(lu) == {"semis", "evaluation"}  # prev_saison : pas de fichier
    ligne = lu["semis"][0]
    assert ligne["region"] == "Kolda" and ligne["annee"] == "2016" and ligne["risque_faux_depart_pct"] is None
    assert lu["evaluation"] == [{"modele": "M4", "version_modele": "m4-v1", "periode": "test 2016-2025", "moment": None,
                                 "culture": None, "risque": "faux départ", "variables": None, "mesure": "nb_cas",
                                 "valeur": "2111"}]
