"""POST /export/explications : configuration, validation et réponse du service de rédaction."""

import importlib

from fastapi.testclient import TestClient

from api.main import creer_app

from .conftest import parametres_test, service_test

URL = "/api/v1/export/explications"
DEMANDE = {"sections": [{"id": "etape-1", "titre": "Priorités", "contexte": "Phase 3 dans le département."}]}


def _client(**p):
    s = service_test(parametres_test(**p))
    return TestClient(creer_app(s.p, s))


def test_ia_non_configuree():
    with _client() as c:
        r = c.post(URL, json=DEMANDE)
    assert r.status_code == 503
    assert r.json()["erreur"]["code"] == "ia_non_configuree"


def test_redaction(monkeypatch):
    route_explications = importlib.import_module("api.routes.explications")
    monkeypatch.setattr(route_explications, "_rediger", lambda _p, sections: [f"Lecture de {sections[0].titre}."])
    with _client(llm_api_key="cle-de-test") as c:
        r = c.post(URL, json=DEMANDE)
    assert r.status_code == 200
    assert r.json() == {"explications": ["Lecture de Priorités."]}


def test_sections_invalides():
    with _client(llm_api_key="cle-de-test") as c:
        doublon = c.post(URL, json={"sections": [DEMANDE["sections"][0], DEMANDE["sections"][0]]})
        trop_long = c.post(URL, json={"sections": [{"id": "a", "titre": "A", "contexte": "x" * 1_801}]})
    assert doublon.status_code == 422
    assert trop_long.status_code == 422


def test_reponse_json_entouree_de_balises():
    """Les modèles gratuits (FreeLLMAPI, etc.) entourent souvent le JSON de ```json : il est quand même lu."""
    route_explications = importlib.import_module("api.routes.explications")
    assert route_explications._lire_json('```json\n{"explications": ["A."]}\n```') == {"explications": ["A."]}
    assert route_explications._lire_json('Voici : {"explications": ["B."]}') == {"explications": ["B."]}
