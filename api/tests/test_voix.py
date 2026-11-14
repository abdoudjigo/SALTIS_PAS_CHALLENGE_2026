"""IA vocale : compréhension, nombres en wolof, réponses tirées du cache, routes (Space simulé)."""

import base64

from api.voix.comprendre import comprendre
from api.voix.nombres import en_lettres

from .test_previsions import client_ml  # noqa: F401 (fixture : marts + prévisions synthétiques)

V1 = "/api/v1/voix"
DEPARTEMENTS = {"SEN.7.1_1": "Kolda", "SEN.10.3_1": "Saint-Louis", "SEN.5.2_1": "Kaolack", "SEN.1.2_1": "Guédiawaye"}


def test_nombres_en_wolof():
    assert en_lettres(0) == "tus"
    assert en_lettres(7) == "juróom-ñaar"
    assert en_lettres(25) == "ñaar-fukk ak juróom"
    assert en_lettres(611) == "juróom-benni téeméer ak fukk ak benn"
    assert en_lettres(2026) == "ñaari junni ak ñaar-fukk ak juróom-benn"


def test_comprendre_wolof_et_francais():
    i = comprendre("Kañ laa wara ji gerte ci Kaolak atum 2027 ?", DEPARTEMENTS)
    assert (i.fonctionnalite, i.code_departement, i.culture, i.annee) == ("semis", "SEN.5.2_1", "ARACHIDE", 2027)
    i = comprendre("Nawet bi, dina taw lool ci Saint Louis ?", DEPARTEMENTS)
    assert (i.fonctionnalite, i.code_departement) == ("saison", "SEN.10.3_1")
    i = comprendre("Il me faut combien d'engrais pour 3 hectares de mil à Kolda ?", DEPARTEMENTS)
    assert (i.fonctionnalite, i.culture, i.surface_ha) == ("besoins", "MIL (SOUNA)", 3.0)
    assert comprendre("Quels départements sont en alerte ?", DEPARTEMENTS).fonctionnalite == "alerte"
    assert comprendre("bonjour", DEPARTEMENTS).fonctionnalite == "saison"  # par défaut : la question centrale


def test_texte_saison_et_departement_de_l_ecran(client_ml):  # noqa: F811
    r = client_ml.post(f"{V1}/texte", json={"texte": "Comment sera la pluie en 2024 ?", "code_departement": "SEN.7.1_1"})
    assert r.status_code == 200
    d = r.json()
    assert d["fonctionnalite"] == "saison" and d["departement"] == "Kolda" and d["annee"] == 2024
    assert "40 %" in d["texte_fr"] and "700 mm" in d["texte_fr"]  # chiffres réels du cache
    assert "juróom-ñaari téeméer" in d["texte_wo"]
    assert d["vue"] == {"mode": "saison", "code_departement": "SEN.7.1_1", "culture": None, "annee": 2024}


def test_texte_semis_alerte_besoins(client_ml):  # noqa: F811
    semis = client_ml.post(f"{V1}/texte", json={"texte": "Quand semer l'arachide à Kolda en 2024 ?"}).json()
    assert semis["fonctionnalite"] == "semis" and "11 au 20 juillet" in semis["texte_fr"]  # décade 20 conseillée
    alerte = client_ml.post(f"{V1}/texte", json={"texte": "Où la récolte risque-t-elle de chuter en 2012 ?"}).json()
    assert alerte["fonctionnalite"] == "alerte"
    sans_dep = client_ml.post(f"{V1}/texte", json={"texte": "Quand semer le mil ?"}).json()
    assert "Pour quel département" in sans_dep["texte_fr"]  # on demande au lieu d'inventer


def test_question_audio_avec_space_simule(client_ml, monkeypatch):  # noqa: F811
    from api.voix.espace import EspaceVoix

    monkeypatch.setattr(EspaceVoix, "transcrire", lambda self, audio, suffixe: "nawet bi ci Kolda atum 2024")
    monkeypatch.setattr(EspaceVoix, "parler", lambda self, texte: base64.b64encode(b"RIFF").decode())
    d = client_ml.post(f"{V1}/question", content=b"\x00audio", headers={"Content-Type": "audio/webm"}).json()
    assert d["transcription"] == "nawet bi ci Kolda atum 2024"
    assert d["departement"] == "Kolda" and d["audio_wo_base64"] == base64.b64encode(b"RIFF").decode()


def test_question_audio_sans_space(client_ml):  # noqa: F811
    r = client_ml.post(f"{V1}/question", content=b"\x00audio", headers={"Content-Type": "audio/webm"})
    assert r.status_code == 503 and r.json()["erreur"]["code"] == "voix_indisponible"
    assert client_ml.post(f"{V1}/question", content=b"").status_code == 422


def test_nom_compose_abrege():
    deps = {"SEN.5.3_1": "Nioro du Rip", "SEN.5.2_1": "Kaolack"}
    assert comprendre("Quelle récolte attendre à Nioro ?", deps).code_departement == "SEN.5.3_1"


def test_parler_wolof(client_ml, monkeypatch, tmp_path):  # noqa: F811
    import importlib

    from api.voix import tts_local

    monkeypatch.setattr(importlib.import_module("api.routes.voix"), "CACHE_VOIX", tmp_path)
    monkeypatch.setattr(tts_local, "disponible", lambda: False)
    r = client_ml.post(f"{V1}/parler", json={"texte": "Nawet bi dina am taw bu bare."})
    assert r.status_code == 503 and r.json()["erreur"]["code"] == "voix_indisponible"  # ni Space ni voix locale
    appels = []
    monkeypatch.setattr(tts_local, "disponible", lambda: True)
    monkeypatch.setattr(tts_local, "parler", lambda texte: appels.append(texte) or "UklGRg==")
    assert client_ml.post(f"{V1}/parler", json={"texte": "Nawet bi."}).json() == {"audio_wo_base64": "UklGRg=="}
    assert client_ml.post(f"{V1}/parler", json={"texte": "Nawet bi."}).json() == {"audio_wo_base64": "UklGRg=="}
    assert appels == ["Nawet bi."]  # la seconde fois : cache disque, pas de nouvelle synthèse


def test_decoupage_wolof():
    from api.voix.tts_local import decouper

    morceaux = decouper("Atum ñaari junni, nawet bi dina am taw bu bare. " + "ñaar-fukk ak juróom, " * 20 + "jeex.")
    assert all(len(m) <= 180 for m in morceaux) and morceaux[0].startswith("Atum")
