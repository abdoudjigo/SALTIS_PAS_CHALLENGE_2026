"""Durcissement : validation des entrées, tentatives d'injection, débit, taille des requêtes, en-têtes, documentation coupée."""

import pytest
from fastapi.testclient import TestClient

from api.main import creer_app
from api.marts import MARTS
from api.securite import LimiteDebit
from api.source_snowflake import requete_lecture

from .conftest import JETON, parametres_test, service_test

V1 = "/api/v1"
INJECTIONS = ["' OR '1'='1", "MIL'; DROP TABLE MART_BESOINS;--", 'x" UNION SELECT 1--', "../../etc/passwd", "*", "a:b:c|gz"]


def _client(**parametres):
    import asyncio

    s = service_test(parametres_test(**parametres))
    asyncio.run(s.precharger("test"))
    return TestClient(creer_app(s.p, s))


# ---- SQL : aucune valeur de requête HTTP n'atteint Snowflake ; les identifiants passent par une liste blanche
def test_requete_snowflake_du_registre_acceptee():
    for d in MARTS.values():
        sql = requete_lecture("SALTIS", "MARTS", d.table, d.ordre)
        assert sql.startswith('select * from "SALTIS"."MARTS"."') and ";" not in sql


@pytest.mark.parametrize("table", ['MART_BESOINS"; DROP TABLE X;--', "MART BESOINS", "", "1MART", "MART_BESOINS--"])
def test_table_snowflake_hors_liste_blanche_refusee(table):
    with pytest.raises(ValueError):
        requete_lecture("SALTIS", "MARTS", table, "code_departement")


@pytest.mark.parametrize("ordre", ["1; drop table x", "code_departement; select 1", "(select 1)", "code_departement desc--", "a,b", ""])
def test_tri_snowflake_hors_liste_blanche_refuse(ordre):
    with pytest.raises(ValueError):
        requete_lecture("SALTIS", "MARTS", "MART_BESOINS", ordre)


@pytest.mark.parametrize("base", ['SALTIS"."X', "SALTIS;"])
def test_base_snowflake_refusee(base):
    with pytest.raises(ValueError):
        requete_lecture(base, "MARTS", "MART_BESOINS", "code_departement")


# ---- validation des entrées HTTP
@pytest.mark.parametrize("code", ["SEN.7.1_1'--", "SEN.7.1_1;DROP", "x", "SEN.7.1_1:*", "SEN.999.1_1", "%27%20OR%201=1"])
def test_code_departement_invalide_refuse(client, code):
    for route in ("agroclimat/departements", "choix-cultures", "besoins/departements", "vulnerabilite"):
        assert client.get(f"{V1}/{route}/{code}").status_code in (404, 422)


@pytest.mark.parametrize("culture", INJECTIONS)
def test_culture_injectee_ne_trouve_rien(client, culture):
    r = client.get(f"{V1}/besoins/departements/SEN.7.1_1", params={"culture": culture})
    assert r.status_code in (404, 422)
    assert "Traceback" not in r.text


def test_bornes_et_longueurs(client):
    assert client.get(f"{V1}/agroclimat/campagnes/99999").status_code == 422
    assert client.get(f"{V1}/agroclimat/campagnes/abc").status_code == 422
    assert client.get(f"{V1}/besoins/departements/SEN.7.1_1", params={"culture": "x" * 61}).status_code == 422
    assert client.get(f"{V1}/besoins/totaux", params={"niveau": "PLANETE"}).status_code == 422
    assert client.post(f"{V1}/voix/texte", json={"texte": "x" * 501}).status_code == 422
    assert client.post(f"{V1}/voix/texte", json={"texte": "pluie ?", "annee": 3000}).status_code == 422
    assert client.post(f"{V1}/voix/texte", json={"texte": "pluie ?", "code_departement": "x" * 21}).status_code == 422
    assert client.post(f"{V1}/voix/parler", json={"texte": "x" * 701}).status_code == 422  # BE-01 : 700 caractères au plus
    assert client.post(f"{V1}/voix/parler", json={"texte": ""}).status_code == 422


def test_voix_texte_avec_injection_repond_normalement(client):
    r = client.post(f"{V1}/voix/texte", json={"texte": "'; DROP TABLE x;-- <script>alert(1)</script>", "code_departement": "' OR 1=1"})
    assert r.status_code == 200 and r.json()["code_departement"] is None


# ---- taille des requêtes
def test_corps_json_trop_gros_refuse(client):
    r = client.post(f"{V1}/voix/texte", content=b'{"texte": "' + b"a" * 70_000 + b'"}', headers={"Content-Type": "application/json"})
    assert r.status_code == 413 and r.json()["erreur"]["code"] == "requete_trop_grosse"


def test_audio_trop_gros_refuse(client):
    r = client.post(f"{V1}/voix/question", content=b"\x00" * (5 * 1024 * 1024 + 1), headers={"Content-Type": "audio/webm"})
    assert r.status_code == 413 and r.json()["erreur"]["code"] == "audio_trop_long"
    assert client.post(f"{V1}/voix/question", content=b"").status_code == 422


# ---- débit
def test_limite_debit_fenetre():
    limite = LimiteDebit(2, 60)
    assert limite.attente("a") == 0 and limite.attente("a") == 0
    assert limite.attente("a") > 0  # troisième appel refusé
    assert limite.attente("b") == 0  # une autre adresse n'est pas touchée
    assert LimiteDebit(0).attente("a") == 0  # 0 = sans limite


def test_debit_voix_et_global():
    with _client(limite_voix_texte_par_minute=2) as c:
        corps = {"texte": "Comment sera la pluie ?"}
        assert [c.post(f"{V1}/voix/texte", json=corps).status_code for _ in range(3)] == [200, 200, 429]
        r = c.post(f"{V1}/voix/texte", json=corps)
        assert r.json()["erreur"]["code"] == "trop_de_requetes" and int(r.headers["Retry-After"]) >= 1
        assert c.get(f"{V1}/systeme/sante").status_code == 200  # les autres routes restent servies
    with _client(limite_requetes_par_minute=3) as c:
        assert [c.get(f"{V1}/systeme/sante").status_code for _ in range(4)] == [200, 200, 200, 429]


def test_debit_jeton_admin():
    with _client(limite_admin_par_minute=2) as c:
        essais = [c.post(f"{V1}/systeme/cache/retour-arriere", headers={"X-Admin-Token": "faux"}).status_code for _ in range(3)]
        assert essais == [401, 401, 429]
        assert c.post(f"{V1}/systeme/cache/retour-arriere", headers={"X-Admin-Token": JETON}).status_code == 429


# ---- en-têtes, CORS, documentation
def test_entetes_de_securite(client):
    r = client.get(f"{V1}/systeme/sante")
    assert r.headers["X-Content-Type-Options"] == "nosniff" and r.headers["X-Frame-Options"] == "DENY"


def test_cors_restreint():
    with _client(cors_origines=["https://assaman-suuf.tech"]) as c:
        ok = c.get(f"{V1}/systeme/sante", headers={"Origin": "https://assaman-suuf.tech"})
        assert ok.headers["access-control-allow-origin"] == "https://assaman-suuf.tech"
        assert "access-control-allow-origin" not in c.get(f"{V1}/systeme/sante", headers={"Origin": "https://ailleurs.example"}).headers
    with _client(cors_origines=[]) as c:  # production : même origine, aucun accès depuis un autre site
        assert "access-control-allow-origin" not in c.get(f"{V1}/systeme/sante", headers={"Origin": "https://ailleurs.example"}).headers


def test_documentation_coupee_en_production():
    with _client(api_docs=False) as c:
        for chemin in ("/docs", "/redoc", "/openapi.json", "/static/swagger-saltis.css", "/"):
            assert c.get(chemin).status_code == 404
        assert c.get(f"{V1}/systeme/sante").status_code == 200


def test_erreur_interne_sans_detail():
    s = service_test()
    app = creer_app(s.p, s)

    @app.get("/boum")
    async def boum():
        raise RuntimeError("mot de passe = secret")

    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.get("/boum")
    assert r.status_code == 500 and r.json()["erreur"]["code"] == "erreur_interne" and "secret" not in r.text


def test_etat_du_cache_reserve_a_l_administration(client):
    """Audit BE-05 : les détails internes du cache ne sont pas publics."""
    assert client.get(f"{V1}/systeme/cache").status_code == 401
    assert client.get(f"{V1}/systeme/cache", headers={"X-Admin-Token": "faux"}).status_code == 401
    assert client.get(f"{V1}/systeme/sante").status_code == 200  # la santé reste publique (supervision)


def test_questions_a_la_voix_coupees_par_defaut():
    """Audit BE-02 : sans client, /voix/texte et /voix/question sont fermées (réglage VOIX_QUESTIONS)."""
    from api.config import Parametres

    from .conftest import parametres_test, service_test

    assert Parametres(_env_file=None).voix_questions is False
    p = parametres_test(voix_questions=False)
    with TestClient(creer_app(p, service_test(p))) as c:
        r = c.post(f"{V1}/voix/texte", json={"texte": "Quand semer l'arachide ?"})
        assert r.status_code == 404 and r.json()["erreur"]["code"] == "fonction_inactive"
        assert c.post(f"{V1}/voix/question", content=b"son", headers={"Content-Type": "audio/webm"}).status_code == 404


def test_cache_des_voix_supprime_les_plus_anciennes(tmp_path, monkeypatch):
    """Audit BE-01 : au-delà du plafond, les voix les moins récemment utilisées laissent la place."""
    import importlib
    import os

    module_voix = importlib.import_module("api.routes.voix")  # le module, pas le routeur exporté sous le même nom

    monkeypatch.setattr(module_voix, "CACHE_VOIX", tmp_path)
    for i in range(3):
        f = tmp_path / f"v{i}.b64"
        f.write_text("x")
        os.utime(f, (1000 + i, 1000 + i))
    module_voix._garder(tmp_path / "nouvelle.b64", "audio", 3)
    assert sorted(p.name for p in tmp_path.glob("*.b64")) == ["nouvelle.b64", "v1.b64", "v2.b64"]
