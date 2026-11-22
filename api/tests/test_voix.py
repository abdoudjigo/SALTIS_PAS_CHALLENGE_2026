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


class _LecteurFixe:
    """Lecteur de cache simulé : renvoie toujours les mêmes lignes d'alerte récolte."""

    def __init__(self, lignes):
        self.lignes = lignes

    async def donnees(self, cle):
        return self.lignes


def _ligne(dep, proba, fiable):
    return {"departement": dep, "culture": "ARACHIDE", "proba_chute_pct": proba, "alerte_fiable": fiable}


def test_alerte_seulement_si_fiable():
    """Audit IA-01 : un risque élevé sans prévision fiable n'est jamais annoncé comme une alerte."""
    import asyncio

    from api.voix.comprendre import Intention
    from api.voix.repondre import _alerte

    def repondre(lignes):
        return asyncio.run(_alerte(Intention("alerte", None, None, 2027, None), _LecteurFixe(lignes)))

    sans_fiable = repondre([_ligne("Kolda", 62, False), _ligne("Kaolack", 45, None)])
    assert "en alerte" not in sans_fiable.texte_fr
    assert "aucune alerte fiable" in sans_fiable.texte_fr and "Kolda" in sans_fiable.texte_fr
    assert "risque habituel" in sans_fiable.nature

    avec_fiable = repondre([_ligne("Kolda", 62, True), _ligne("Kaolack", 45, False)])
    assert "1 département en alerte" in avec_fiable.texte_fr and "Kaolack" not in avec_fiable.texte_fr
    assert "fiable" in avec_fiable.nature


def test_parler_par_le_service_voix(client_ml, monkeypatch, tmp_path):  # noqa: F811
    """Audit ARC-02 : en production, l'API ne synthétise plus ; elle appelle le service « voix » et rend 503 s'il ne répond pas."""
    import importlib
    import io
    import json
    import urllib.request

    from api.voix import tts_local

    module_voix = importlib.import_module("api.routes.voix")
    monkeypatch.setattr(module_voix, "CACHE_VOIX", tmp_path)
    monkeypatch.setattr(tts_local, "parler", lambda texte: (_ for _ in ()).throw(AssertionError("synthèse dans l'API")))
    p = client_ml.app.state.parametres
    monkeypatch.setattr(p, "voix_service_url", "http://voix:8090")
    appels = []

    def urlopen(requete, timeout):
        appels.append((requete.full_url, json.loads(requete.data), timeout))
        return io.BytesIO(json.dumps({"audio_wo_base64": "UklGRg=="}).encode())

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    assert client_ml.post(f"{V1}/parler", json={"texte": "Nawet bi."}).json() == {"audio_wo_base64": "UklGRg=="}
    assert appels == [("http://voix:8090/dire", {"texte": "Nawet bi."}, p.voix_service_delai_s)]

    def trop_lent(requete, timeout):
        raise TimeoutError("timed out")

    monkeypatch.setattr(urllib.request, "urlopen", trop_lent)
    r = client_ml.post(f"{V1}/parler", json={"texte": "Beneen."})
    assert r.status_code == 503 and r.json()["erreur"]["code"] == "voix_indisponible"


def test_service_voix(monkeypatch):
    """Le conteneur « voix » : une synthèse à la fois, texte borné, 503 en cas d'échec."""
    from fastapi.testclient import TestClient

    from api.voix import service, tts_local

    monkeypatch.setenv("VOIX_PRECHARGER", "0")
    monkeypatch.setattr(tts_local, "parler", lambda texte: "UklGRg==" if texte != "échec" else None)
    with TestClient(service.app) as c:
        assert c.get("/sante").json() == {"pret": False}
        assert c.post("/dire", json={"texte": "Nawet bi."}).json() == {"audio_wo_base64": "UklGRg=="}
        assert c.post("/dire", json={"texte": "échec"}).status_code == 503
        assert c.post("/dire", json={"texte": "x" * 701}).status_code == 422


def test_parler_par_le_space_puis_repli_sur_le_service(client_ml, monkeypatch, tmp_path):  # noqa: F811
    """Le Space (Adia TTS) passe en premier ; s'il ne rend rien (endormi, quota épuisé), le service « voix » prend le relais."""
    import importlib
    import io
    import json
    import urllib.request

    from api.voix.espace import EspaceVoix

    module_voix = importlib.import_module("api.routes.voix")
    monkeypatch.setattr(module_voix, "CACHE_VOIX", tmp_path)
    p = client_ml.app.state.parametres
    monkeypatch.setattr(p, "voix_space", "compte/voix")
    monkeypatch.setattr(p, "voix_service_url", "http://voix:8090")
    monkeypatch.setattr(EspaceVoix, "_connecter", lambda self: object())
    mp3 = base64.b64encode(b"ID3mp3").decode()
    monkeypatch.setattr(EspaceVoix, "parler", lambda self, texte: mp3)
    service = []
    monkeypatch.setattr(urllib.request, "urlopen", lambda requete, timeout: service.append(1) or io.BytesIO(json.dumps({"audio_wo_base64": "UklGRg=="}).encode()))

    assert client_ml.post(f"{V1}/parler", json={"texte": "Space bi."}).json() == {"audio_wo_base64": mp3}
    assert service == []  # le Space a répondu : le serveur ne synthétise pas

    monkeypatch.setattr(EspaceVoix, "parler", lambda self, texte: None)
    assert client_ml.post(f"{V1}/parler", json={"texte": "Space bi nelaw na."}).json() == {"audio_wo_base64": "UklGRg=="}
    assert service == [1]
