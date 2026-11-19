"""Phase ONG : besoins avec les NPK 15-10-10 et 6-20-10, prix des intrants, Cadre harmonisé (marts facultatifs)."""

import asyncio
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from api.cache.construction import COLONNES_ADDITIVES, ErreurContrat, valider
from api.main import creer_app
from api.routes import cadre_prix as route_ch

from .conftest import service_test
from .donnees_test import GUEDIAWAYE, KOLDA, SAINT_LOUIS, ligne, marts_synthetiques

V1 = "/api/v1"
SOURCE_PRIX = "APS, 30 sept. 2025"


def prix() -> list[dict]:
    return [
        ligne("prix", code_intrant="NPK_6_20_10", campagne=2026, prix_cession_sac_50kg_fcfa=Decimal("6000"),
              subvention_tonne_fcfa=Decimal("265000"), cout_reel_sac_50kg_fcfa=Decimal("19250"), statut_validation="A_CONFIRMER",
              source=SOURCE_PRIX),
        ligne("prix", code_intrant="UREE", campagne=2026, statut_validation="A_SAISIR", source="prix non trouvé : à saisir"),
    ]


def cadre() -> list[dict]:
    commun = dict(annee_cycle=2026, code_cycle=2, libelle_cycle_source="Jan-May", libelle_cycle="mars 2026",
                  type_periode_retenue="projected", libelle_periode_retenue="mars 2026, projection juin-août 2026",
                  date_debut_periode_retenue=date(2026, 6, 1), date_fin_periode_retenue=date(2026, 8, 31), periode_terminee=False,
                  source="Cadre harmonisé, CILSS", licence="CC BY", fusion_keur_massar=False)
    return [
        ligne("cadre_harmonise", **KOLDA, **commun, phase_retenue=3, libelle_phase_retenue="crise",
              population_phase3_5_retenue=90593.14000000001, phase_courante=2, phase_projetee=3, population_phase3_5_projetee=90593.14),
        ligne("cadre_harmonise", **SAINT_LOUIS, **commun, phase_retenue=1, libelle_phase_retenue="minimale", phase_projetee=1),
        ligne("cadre_harmonise", **GUEDIAWAYE, **{**commun, "fusion_keur_massar": True, "date_fin_periode_retenue": None},
              note_fusion="Pikine et Keur Massar réunis"),
    ]


def marts_ong() -> dict[str, list[dict]]:
    marts = marts_synthetiques()
    for b in marts["besoins"] + marts["agrodistrib"]:
        if b["code_departement"] == KOLDA["code_departement"] and b["culture"] == "MIL (SOUNA)":
            b.update(besoin_npk_6_20_10_t=Decimal("8249.9505"), besoin_npk_15_10_10_t=Decimal("0"), libelle_npk_6_20_10="calculé",
                     libelle_npk_15_10_10="pas dans la formule", libelle_fumier="non chiffré : fumure organique conseillée si possible",
                     source_reference_engrais="IFDC-CORAF, catalogue PIA")
    return {**marts, "prix": prix(), "cadre_harmonise": cadre()}


def client_avec(marts: dict) -> TestClient:
    s = service_test(lecteur=lambda: marts)
    asyncio.run(s.precharger("test"))
    return TestClient(creer_app(s.p, s))


def test_colonnes_additives_npk_sans_fumier():
    assert {"besoin_npk_15_10_10_t", "besoin_npk_6_20_10_t"} <= set(COLONNES_ADDITIVES)
    assert "besoin_fumier_t" not in COLONNES_ADDITIVES


def test_besoins_nouveaux_npk_et_totaux():
    with client_avec(marts_ong()) as c:
        d = c.get(f"{V1}/besoins/departements/{KOLDA['code_departement']}", params={"culture": "MIL (SOUNA)"}).json()["donnees"][0]
        assert d["besoin_npk_6_20_10_t"] == pytest.approx(8249.9505)
        assert d["libelle_npk_15_10_10"] == "pas dans la formule" and d["besoin_fumier_t"] is None
        assert d["source_reference_engrais"] == "IFDC-CORAF, catalogue PIA"
        total = c.get(f"{V1}/besoins/totaux").json()["donnees"][0]
        assert total["besoin_npk_6_20_10_t"] == pytest.approx(8249.95)
        assert "besoin_fumier_t" not in total
        agro = c.get(f"{V1}/agrodistrib/territoires", params={"culture": "MIL (SOUNA)"}).json()["donnees"]
        assert any(x["libelle_npk_6_20_10"] == "calculé" for x in agro)
        intrants = {x["code_intrant"]: x for x in c.get(f"{V1}/referentiels/intrants").json()["donnees"]}
        assert intrants["NPK_6_20_10"]["colonne_besoin"] == "besoin_npk_6_20_10_t"
        assert intrants["NPK_15_10_10"]["colonne_besoin"] == "besoin_npk_15_10_10_t"
        assert intrants["FUMIER"]["dans_totaux"] is False


def test_prix_intrants():
    with client_avec(marts_ong()) as c:
        corps = c.get(f"{V1}/prix-intrants", params={"campagne": 2026}).json()
        assert corps["meta"]["source"] == "SALTIS.MARTS.DIM_PRIX_INTRANT"
        npk = next(x for x in corps["donnees"] if x["code_intrant"] == "NPK_6_20_10")
        assert npk["cout_reel_sac_50kg_fcfa"] == 19250 and npk["nom_intrant"] == "NPK 6-20-10" and npk["source"] == SOURCE_PRIX
        uree = next(x for x in corps["donnees"] if x["code_intrant"] == "UREE")
        assert uree["statut_validation"] == "A_SAISIR" and uree["prix_cession_sac_50kg_fcfa"] is None  # jamais 0
        assert c.get(f"{V1}/prix-intrants").json()["meta"]["nb_elements"] == 2
        r = c.get(f"{V1}/prix-intrants", params={"campagne": 2020})
        assert r.status_code == 404 and r.json()["erreur"]["code"] == "campagne_inconnue"


def test_cadre_harmonise_et_periode_recalculee(monkeypatch):
    with client_avec(marts_ong()) as c:
        corps = c.get(f"{V1}/cadre-harmonise").json()
        assert corps["meta"]["nb_elements"] == 3
        monkeypatch.setattr(route_ch, "_aujourdhui", lambda: date(2026, 11, 19))
        r = c.get(f"{V1}/cadre-harmonise/{KOLDA['code_departement']}")
        d = r.json()["donnees"]
        assert d["phase_retenue"] == 3 and d["population_phase3_5_retenue"] == 90593.14  # arrondi à 0,01
        assert d["periode_terminee"] is True  # 31/08/2026 < 19/11/2026, quoi que dise le cache
        assert d["mention_periode"] == "période terminée, prochain cycle attendu"
        assert r.headers["etag"].endswith('-20261119"')
        monkeypatch.setattr(route_ch, "_aujourdhui", lambda: date(2026, 7, 1))
        d = c.get(f"{V1}/cadre-harmonise/{KOLDA['code_departement']}").json()["donnees"]
        assert d["periode_terminee"] is False and d["mention_periode"] is None
        gued = c.get(f"{V1}/cadre-harmonise/{GUEDIAWAYE['code_departement']}").json()["donnees"]
        assert gued["periode_terminee"] is None and gued["fusion_keur_massar"] is True
        assert c.get(f"{V1}/cadre-harmonise/SEN.99.9_1").json()["erreur"]["code"] == "departement_inconnu"
        phases = c.get(f"{V1}/referentiels/phases-cadre-harmonise").json()["donnees"]
        assert [p["couleur"] for p in phases] == ["#CDFACD", "#FAE61E", "#E67800", "#C80000", "#640000"]


def test_marts_absents_404(client):
    r = client.get(f"{V1}/prix-intrants")
    assert r.status_code == 404 and r.json()["erreur"]["code"] == "prix_indisponible"
    r = client.get(f"{V1}/cadre-harmonise")
    assert r.status_code == 404 and r.json()["erreur"]["code"] == "cadre_harmonise_indisponible"
    assert client.get(f"{V1}/cadre-harmonise/{KOLDA['code_departement']}").status_code == 404
    assert client.get(f"{V1}/referentiels/phases-cadre-harmonise").status_code == 200
    assert client.get(f"{V1}/besoins/totaux").status_code == 200


def test_phase_hors_contrat_refusee():
    marts = marts_ong()
    marts["cadre_harmonise"][0]["phase_retenue"] = 6
    with pytest.raises(ErreurContrat, match="MART_CADRE_HARMONISE_DEPARTEMENT"):
        valider(marts)


def test_voix_nouveaux_npk_et_produits_hors_formule():
    from api.voix.comprendre import Intention
    from api.voix.repondre import INTRANTS, _besoins

    assert {"besoin_npk_15_10_10_t", "besoin_npk_6_20_10_t"} <= {c for c, _, _ in INTRANTS}
    assert "besoin_fumier_t" not in {c for c, _, _ in INTRANTS}
    ligne_besoin = dict(superficie_reference_ha=1000.0, besoin_npk_6_20_10_t=150.0, besoin_npk_15_10_10_t=0.0,
                        libelle_npk_15_10_10="pas dans la formule", besoin_npk_15_15_15_t=0.0, libelle_npk_15_15_15="pas dans la formule",
                        besoin_uree_t=None, besoin_dap_t=None, besoin_semences_retenu_t=100.0, besoin_fumier_t=None)

    class Lecteur:
        async def donnees(self, cle):
            return [ligne_besoin]

    i = Intention(fonctionnalite="besoins", code_departement="SEN.4.2_1", culture="ARACHIDE", annee=2026, surface_ha=1.0)
    r = asyncio.run(_besoins(i, "Kaffrine", Lecteur()))
    assert "NPK 6-20-10 150 kg" in r.texte_fr
    assert "15-10-10" not in r.texte_fr and "15-15-15" not in r.texte_fr  # absents de la formule : non cités
    assert "fumier" not in r.texte_fr
