"""Routes /opportunites : carte des opportunités (MART_CARTE_OPPORTUNITES), mart facultatif."""

import asyncio

import pytest
from fastapi.testclient import TestClient

from api.cache.construction import ErreurContrat, valider
from api.main import creer_app

from .conftest import service_test
from . import donnees_test
from .donnees_test import GUEDIAWAYE, KOLDA, SAINT_LOUIS, ligne, marts_synthetiques

COORDONNEES = getattr(donnees_test, "COORDONNEES", {})
from .donnees_test import COORDONNEES, GUEDIAWAYE, KOLDA, SAINT_LOUIS, ligne, marts_synthetiques

V1 = "/api/v1/opportunites"


def carte_opportunites(eau_chargee: bool = True) -> list[dict]:
    kolda = ligne(
        "opportunites", **KOLDA, **COORDONNEES.get(KOLDA["code_departement"], {}), couleur_carte="bleu", couleur_fond="vert", couche_eau=True,
        "opportunites", **KOLDA, **COORDONNEES[KOLDA["code_departement"]], couleur_carte="bleu", couleur_fond="vert", couche_eau=True,
        classe_saison_pluie="longue", cycle_max_conseille_j=120.0, cultures_cycle_long="ARACHIDE, MAÏS",
        varietes_conseillees="MIL (SOUNA) : Sanio (120 j)", nb_varietes_conseillees=1, categorie_eau="eau de surface peu exploitée",
        potentiel_contre_saison_ha="6000.0", rang_opportunite_eau=1, surface_proche_eau_cultivable_ha=9000.0,
        surface_proche_eau_inexploitee_ha=6000.0, part_proche_eau_exploitee_pct=33.3,
        conseil_agriculteur="Saison des pluies longue…", conseil_investisseur="Environ 6000 ha…",
    )
    saint_louis = ligne(
        "opportunites", **SAINT_LOUIS, couleur_carte="bleu", couleur_fond="jaune", couche_eau=True, classe_saison_pluie="courte",
        cycle_max_conseille_j=75.0, nb_varietes_conseillees=0, categorie_eau="nappe accessible", rang_opportunite_eau=2,
        part_nappe_accessible_pct=60.0, conseil_agriculteur="Saison des pluies courte…", conseil_investisseur="Nappe à 25 m au plus…",
    )
    guediawaye = ligne(
        "opportunites", **GUEDIAWAYE, couleur_carte="jaune", couleur_fond="jaune", couche_eau=False, classe_saison_pluie="courte",
        nb_varietes_conseillees=0, categorie_eau="pas d'eau mobilisable identifiée", conseil_agriculteur="Saison des pluies très courte…",
    )
    lignes = [kolda, saint_louis, guediawaye]
    if not eau_chargee:
        for x in lignes:
            x.update(couleur_carte=x["couleur_fond"], couche_eau=False, categorie_eau="non évaluée", rang_opportunite_eau=None,
                     potentiel_contre_saison_ha=None, conseil_investisseur=None)
    return lignes


def client_avec(lignes: list[dict]) -> TestClient:
    s = service_test(lecteur=lambda: {**marts_synthetiques(), "opportunites": lignes})
    asyncio.run(s.precharger("test"))
    return TestClient(creer_app(s.p, s))


def test_carte_complete_et_par_couleur():
    with client_avec(carte_opportunites()) as c:
        corps = c.get(V1).json()
        assert corps["meta"]["source"] == "SALTIS.MARTS.MART_CARTE_OPPORTUNITES"
        assert corps["meta"]["nb_elements"] == 3
        assert "non évaluée" not in " ".join(corps["meta"]["avertissements"])
        kolda = next(d for d in corps["donnees"] if d["code_departement"] == KOLDA["code_departement"])
        assert kolda["potentiel_contre_saison_ha"] == 6000.0
        if COORDONNEES:
            assert kolda["latitude"] == pytest.approx(12.8939)
        assert kolda["potentiel_contre_saison_ha"] == 6000.0 and kolda["latitude"] == pytest.approx(12.8939)

        bleu = c.get(V1, params={"couleur": "bleu"}).json()
        assert [d["rang_opportunite_eau"] for d in bleu["donnees"]] == [1, 2]
        assert bleu["meta"]["filtres"] == {"couleur": "bleu"}
        assert [d["departement"] for d in c.get(V1, params={"couleur": "jaune"}).json()["donnees"]] == ["Guédiawaye"]
        assert c.get(V1, params={"couleur": "vert"}).json()["donnees"] == []
        assert c.get(V1, params={"couleur": "rouge"}).status_code == 422


def test_departement():
    with client_avec(carte_opportunites()) as c:
        corps = c.get(f"{V1}/{SAINT_LOUIS['code_departement']}").json()
        assert corps["donnees"]["categorie_eau"] == "nappe accessible"
        assert corps["donnees"]["potentiel_contre_saison_ha"] is None  # NULL conservé, jamais 0
        r = c.get(f"{V1}/SEN.99.9_1")
        assert r.status_code == 404 and r.json()["erreur"]["code"] == "departement_inconnu"


def test_avant_chargement_de_l_eau():
    with client_avec(carte_opportunites(eau_chargee=False)) as c:
        corps = c.get(V1).json()
        assert corps["meta"]["avertissements"][0].startswith("Couche bleue non évaluée")
        assert c.get(V1, params={"couleur": "bleu"}).json()["donnees"] == []


def test_mart_absent_404_sans_casser_les_autres_routes(client):
    r = client.get(V1)
    assert r.status_code == 404 and r.json()["erreur"]["code"] == "opportunites_indisponible"
    assert client.get(f"{V1}/{KOLDA['code_departement']}").json()["erreur"]["code"] == "opportunites_indisponible"
    assert client.get("/api/v1/vulnerabilite").status_code == 200


def test_valeur_hors_contrat_refusee():
    lignes = carte_opportunites()
    lignes[0]["couleur_carte"] = "rouge"
    with pytest.raises(ErreurContrat, match="MART_CARTE_OPPORTUNITES"):
        valider({**marts_synthetiques(), "opportunites": lignes})
