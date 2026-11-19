"""POST /avis : envoi par SMTP (remplacé par un faux), piège à robots, configuration absente, limite de débit."""
import smtplib

import pytest
from fastapi.testclient import TestClient

from api.main import creer_app

from .conftest import parametres_test, service_test

SMTP_OK = dict(smtp_host="smtp.test", smtp_port=587, smtp_user="equipe@test.sn", smtp_password="secret", avis_destinataire="akai@test.sn")
AVIS = {"Nom de l'organisation": "ONG Test", "Type d'organisation": "ONG nationale", "Un problème rencontré ?": "x" * 3000,
        "annee": 2026, "etape": "Où agir en priorité ?"}


class FauxSMTP:
    envoyes: list = []

    def __init__(self, hote, port, timeout=None):
        self.hote, self.port = hote, port

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def starttls(self):
        pass

    def login(self, user, mdp):
        assert mdp == "secret"

    def send_message(self, m):
        FauxSMTP.envoyes.append(m)


@pytest.fixture
def faux_smtp(monkeypatch):
    FauxSMTP.envoyes = []
    monkeypatch.setattr(smtplib, "SMTP", FauxSMTP)
    return FauxSMTP


def _client(**p):
    s = service_test(parametres_test(**p))
    return TestClient(creer_app(s.p, s))


def test_envoi(faux_smtp):
    with _client(**SMTP_OK) as c:
        r = c.post("/api/v1/avis", json=AVIS)
    assert r.status_code == 200
    (m,) = faux_smtp.envoyes
    assert m["Subject"] == "Avis ONG – ONG Test – Assaman & Suuf"
    corps = m.get_content()
    assert "Nom de l'organisation : ONG Test" in corps and "Année ouverte : 2026" in corps
    assert "x" * 2000 in corps and "x" * 2001 not in corps


def test_piege_sans_envoi(faux_smtp):
    with _client(**SMTP_OK) as c:
        r = c.post("/api/v1/avis", json={**AVIS, "_honey": "robot"})
    assert r.status_code == 200 and faux_smtp.envoyes == []


def test_configuration_absente(faux_smtp):
    with _client() as c:
        r = c.post("/api/v1/avis", json=AVIS)
    assert r.status_code == 503 and faux_smtp.envoyes == []


def test_echec_smtp_sans_detail(monkeypatch):
    def casse(*a, **k):
        raise OSError("secret dans le message")
    monkeypatch.setattr(smtplib, "SMTP", casse)
    with _client(**SMTP_OK) as c:
        r = c.post("/api/v1/avis", json=AVIS)
    assert r.status_code == 502 and "secret" not in r.text


def test_limite(faux_smtp):
    with _client(**SMTP_OK) as c:
        codes = [c.post("/api/v1/avis", json=AVIS).status_code for _ in range(6)]
    assert codes == [200] * 5 + [429]
