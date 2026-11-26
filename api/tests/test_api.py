import asyncio
import gzip
import json
import time
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from api.cache import cles
from api.main import creer_app

from .conftest import JETON, parametres_test, service_test

ADMIN = {"X-Admin-Token": JETON}

V1 = "/api/v1"


def test_referentiel_et_entetes_de_cache(client):
    r = client.get(f"{V1}/referentiels/departements")
    assert r.status_code == 200
    corps = r.json()
    assert corps["meta"]["nb_elements"] == 3
    assert corps["meta"]["source"] == "SALTIS.MARTS.MART_VULNERABILITE_DEPARTEMENT"
    guediawaye = next(d for d in corps["donnees"] if d["departement"] == "Guédiawaye")
    assert guediawaye["a_suivi_decadaire"] is False and guediawaye["a_score_vulnerabilite"] is False
    assert r.headers["x-cache"] == "HIT" and r.headers["x-cache-mode"] == "memoire"
    assert r.headers["etag"] == f'W/"{corps["meta"]["version"]}"'
    assert "x-temps-traitement-ms" in r.headers


def test_etag_renvoie_304(client):
    etag = client.get(f"{V1}/vulnerabilite").headers["etag"]
    r = client.get(f"{V1}/vulnerabilite", headers={"If-None-Match": etag})
    assert r.status_code == 304 and r.content == b""


def test_gzip_servi_tel_quel_ou_decompresse(client):
    url = f"{V1}/suivi-decadaire/SEN.7.1_1/2024"
    compresse = client.get(url, headers={"Accept-Encoding": "gzip"})
    assert compresse.headers["content-encoding"] == "gzip"
    brut = client.get(url, headers={"Accept-Encoding": "identity"})
    assert "content-encoding" not in brut.headers
    assert compresse.json() == json.loads(brut.content) == json.loads(gzip.decompress(gzip.compress(brut.content)))


def test_suivi_decadaire_trie_et_filtre(client):
    corps = client.get(f"{V1}/suivi-decadaire/SEN.7.1_1/2024").json()
    assert [d["numero_decade_annee"] for d in corps["donnees"]] == list(range(1, 37))
    assert corps["donnees"][0]["pluie_mm"] == 12.5
    saison = client.get(f"{V1}/suivi-decadaire/SEN.7.1_1/2024", params={"saison_seulement": True}).json()
    assert [d["numero_decade_annee"] for d in saison["donnees"]] == list(range(16, 31))
    assert saison["meta"]["avertissements"]


def test_erreurs_404_precises(client):
    r = client.get(f"{V1}/suivi-decadaire/SEN.1.2_1/2024")
    assert r.status_code == 404 and r.json()["erreur"]["code"] == "suivi_indisponible"
    assert client.get(f"{V1}/suivi-decadaire/SEN.7.1_1/1950").json()["erreur"]["code"] == "annee_inconnue"
    assert client.get(f"{V1}/agroclimat/campagnes/1990").json()["erreur"]["code"] == "campagne_inconnue"
    assert client.get(f"{V1}/besoins/departements/SEN.99.9_1").json()["erreur"]["code"] == "departement_inconnu"
    r = client.get(f"{V1}/choix-cultures/SEN.7.1_1", params={"culture": "banane"})
    assert r.status_code == 404 and "MAÏS" in r.json()["erreur"]["aide"]
    assert client.get(f"{V1}/besoins/departements/pas-un-code").status_code == 422


def test_culture_sans_accent(client):
    corps = client.get(f"{V1}/choix-cultures/SEN.7.1_1", params={"culture": "mais"}).json()
    assert corps["meta"]["filtres"]["culture"] == "MAÏS"
    assert {d["culture"] for d in corps["donnees"]} == {"MAÏS"}
    assert [d["rang_option"] for d in corps["donnees"]] == [1, 2, 3]


def test_null_conserve_jamais_zero(client):
    corps = client.get(f"{V1}/besoins/departements/SEN.7.1_1", params={"culture": "MIL (SOUNA)"}).json()
    (mil,) = corps["donnees"]
    assert mil["besoin_semences_retenu_t"] is None and mil["libelle_semences"] == "dose à saisir"
    guediawaye = client.get(f"{V1}/besoins/departements/SEN.1.2_1").json()["donnees"]
    assert guediawaye[0]["culture"] is None and guediawaye[0]["message_departement"]


def test_totaux_et_agregats(client):
    (national,) = client.get(f"{V1}/besoins/totaux").json()["donnees"]
    assert national["besoin_uree_t"] == 142.5 and national["valeurs_manquantes"]["besoin_uree_t"] == 1
    regions = client.get(f"{V1}/agrodistrib/agregats", params={"niveau": "REGION", "culture": "mil (souna)"}).json()
    assert regions["meta"]["filtres"] == {"niveau": "REGION", "culture": "MIL (SOUNA)"}
    assert {a["libelle"]: a["besoin_uree_t"] for a in regions["donnees"]} == {"Kolda": 75.0, "Saint-Louis": 37.5}
    assert client.get(f"{V1}/besoins/totaux", params={"niveau": "PAYS"}).status_code == 422


def test_vulnerabilite(client):
    classement = client.get(f"{V1}/vulnerabilite").json()["donnees"]
    assert [v["rang_vulnerabilite"] for v in classement] == [1, 2, None]
    detail = client.get(f"{V1}/vulnerabilite/SEN.7.1_1").json()
    assert detail["meta"]["nb_elements"] == 1 and detail["donnees"]["departement"] == "Kolda"


def test_systeme_sante_et_cache(client):
    assert client.get(f"{V1}/systeme/sante").json()["statut"] == "ok"
    etat = client.get(f"{V1}/systeme/cache", headers=ADMIN).json()
    assert etat["statut"] == "pret" and etat["mode"] == "memoire"
    assert etat["info"]["nb_cles"] > 50 and etat["info"]["lignes_par_mart"]["suivi"] == 72


def test_administration(client, service):
    url = f"{V1}/systeme/cache/rafraichir"
    assert client.post(url).status_code == 401
    assert client.post(url, headers={"X-Admin-Token": "faux"}).json()["erreur"]["code"] == "jeton_invalide"
    premiere = client.get(f"{V1}/systeme/cache", headers=ADMIN).json()["version_active"]
    r = client.post(url, headers={"X-Admin-Token": JETON})
    assert r.status_code == 202
    # La tâche de fond tourne dans la boucle du client de test. On attend sans passer par la route d'administration :
    # elle est limitée à 10 appels par minute, et la construction (Observatoire compris) peut demander plus de tours.
    for _ in range(600):
        if client.portal.call(service.stockage.version_active) != premiere:
            break
        time.sleep(0.05)
    etat = client.get(f"{V1}/systeme/cache", headers=ADMIN).json()
    assert etat["versions_conservees"] == [etat["version_active"], premiere]
    retour = client.post(f"{V1}/systeme/cache/retour-arriere", headers={"X-Admin-Token": JETON}).json()
    assert retour["version_active"] == premiere


def test_administration_desactivee_sans_jeton():
    s = service_test(parametres_test(api_admin_token=""))
    asyncio.run(s.precharger("test"))
    with TestClient(creer_app(s.p, s)) as c:
        r = c.post(f"{V1}/systeme/cache/rafraichir", headers={"X-Admin-Token": "x"})
        assert r.status_code == 403


def test_cache_vide_renvoie_503(client_vide):
    r = client_vide.get(f"{V1}/referentiels/departements")
    assert r.status_code == 503 and r.headers["retry-after"] == "10"
    assert r.json()["erreur"]["code"] == "cache_indisponible"
    assert client_vide.get(f"{V1}/systeme/sante").status_code == 503


def test_documentation(client):
    html = client.get("/docs").text
    assert "swagger-saltis.css" in html and "swagger-ui" in html
    assert client.get("/static/swagger-saltis.css").status_code == 200
    assert client.get("/redoc").status_code == 200
    assert client.get("/", follow_redirects=False).headers["location"] == "/docs"
    schema = client.get("/openapi.json").json()
    assert "MART_ML" not in json.dumps(schema["paths"])


def test_mode_simple_sans_redis_charge_avant_la_premiere_requete():
    from api.cache import ServiceCache

    from .donnees_test import marts_synthetiques

    p = parametres_test(redis_url="", prechargement_au_demarrage=True)
    s = ServiceCache(p, marts_synthetiques)  # aucun stockage fourni : l'API choisit elle-même
    with TestClient(creer_app(p, s)) as c:
        r = c.get(f"{V1}/referentiels/departements")  # pas de 503 : les marts sont chargés au démarrage
        assert r.status_code == 200 and r.headers["x-cache-mode"] == "memoire"
        assert c.get(f"{V1}/systeme/cache", headers=ADMIN).json()["info"]["declencheur"] == "demarrage"


def test_detection_port_occupe():
    import socket

    from api.__main__ import port_occupe

    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        s.listen()
        port = s.getsockname()[1]
        assert port_occupe("127.0.0.1", port)
    assert not port_occupe("127.0.0.1", port)


def test_coordonnees_et_zone_secondaire(client):
    (st_louis,) = [d for d in client.get(f"{V1}/agroclimat/campagnes/2024").json()["donnees"] if d["departement"] == "Saint-Louis"]
    assert st_louis["latitude"] == 16.0179 and st_louis["zone_secondaire"] == "Niayes (frange côtière)"
    refs = {d["departement"]: d for d in client.get(f"{V1}/referentiels/departements").json()["donnees"]}
    assert refs["Kolda"]["longitude"] == -14.9406 and refs["Kolda"]["zone_secondaire"] is None


def test_choix_cultures_valeurs_finales_et_source(client):
    corps = client.get(f"{V1}/choix-cultures/SEN.7.1_1", params={"culture": "mais"}).json()
    ligne = corps["donnees"][0]
    assert ligne["niveau_adequation"] == "adaptée" and ligne["niveau_adequation_source"] == "à risque"
    assert ligne["methode_niveau"].startswith("FAO décadaire")
    assert any("écart décadaire" in a for a in corps["meta"]["avertissements"])


def test_marts_anterieurs_sans_nouvelles_colonnes():
    """Snowflake pas encore reconstruit : les colonnes nouvelles manquent, l'API fonctionne quand même."""
    from api.cache.construction import AV_EAU_SOURCE, construire, valider

    from .donnees_test import marts_synthetiques

    bruts = marts_synthetiques()
    nouvelles = {"latitude", "longitude", "zone_secondaire", "methode_niveau", "nb_annees_calc", "score_adequation_source",
                 "proba_besoin_eau_couvert_pct_source", "niveau_adequation_source", "besoin_semences_applicable"}
    for cle_mart, lignes in bruts.items():
        if cle_mart == "besoins":  # besoin_semences_applicable y existe déjà
            continue
        for ligne in lignes:
            for nom in nouvelles & set(ligne):
                del ligne[nom]
    marts, _ = valider(bruts)
    reponses = construire(marts, "v-test", datetime.now(timezone.utc), "SALTIS.MARTS").reponses
    cle = cles.cultures("SEN.7.1_1", None)
    brut = reponses.get(cle) or gzip.decompress(reponses[cle + cles.SUFFIXE_GZIP])
    assert AV_EAU_SOURCE in json.loads(brut)["meta"]["avertissements"]
