"""Observatoire Sénégal 2050 : routes /observatoire (marts facultatifs, réponses précalculées)."""

import asyncio
import os
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from api.main import creer_app

from .conftest import service_test
from .donnees_test import KOLDA, SAINT_LOUIS, ligne, marts_synthetiques

V1 = "/api/v1/observatoire"
MIL, RIZ, SESAME = "MIL (SOUNA)", "RIZ (IRRIGUÉ)", "SÉSAME"
DEPARTEMENTS = {KOLDA["code_departement"]: KOLDA, SAINT_LOUIS["code_departement"]: SAINT_LOUIS}
SRC_DEP = "FEWS NET (DAPSA/ANSD)"


def _dep(culture, code, annee, production, surface, **plus):
    t = DEPARTEMENTS[code]
    rendement = None if (production is None or not surface) else production * 1000 / surface
    deux = production is not None and surface is not None
    return ligne("observatoire_series", niveau="DEPARTEMENT", code_zone=code, zone=t["departement"], code_region=t["code_region"],
                 region=t["region"], culture=culture, campagne_agricole=annee, production_t=production, superficie_ha=surface,
                 rendement_kg_ha=rendement, nb_departements_observes=int(deux), nb_departements_attendus=1, est_complet=deux,
                 type_superficie="récoltée" if annee <= 2015 else "semée", serie="DAPSA", source=SRC_DEP, **plus)


def _agreger(deps, attendus_pays=2):
    """Même règle que mart_observatoire_series : somme des départements ayant production et surface ; riz 2021 arrêté."""
    lignes = []
    cles = {(d["culture"], d["campagne_agricole"]) for d in deps}
    for culture, annee in sorted(cles):
        membres = [d for d in deps if (d["culture"], d["campagne_agricole"]) == (culture, annee) and d["nb_departements_observes"] == 1]
        if not membres:
            continue
        ferme = culture == RIZ and annee >= 2021
        for niveau, code, nom, groupe, attendus in [("PAYS", "SEN", "Sénégal", membres, attendus_pays)] + [
            ("REGION", t["code_region"], t["region"], [m for m in membres if m["code_region"] == t["code_region"]], 1)
            for t in DEPARTEMENTS.values()
        ]:
            if not groupe:
                continue
            p, s = sum(m["production_t"] for m in groupe), sum(m["superficie_ha"] for m in groupe)
            lignes.append(ligne(
                "observatoire_series", niveau=niveau, code_zone=code, zone=nom, culture=culture, campagne_agricole=annee,
                code_region=None if niveau == "PAYS" else code, region=None if niveau == "PAYS" else nom,
                production_t=None if ferme else p, superficie_ha=None if ferme else s,
                rendement_kg_ha=None if ferme else p * 1000 / s, nb_departements_observes=len(groupe),
                nb_departements_attendus=attendus, est_complet=(len(groupe) == attendus) and not ferme,
                type_superficie="récoltée" if annee <= 2015 else "semée", serie="DAPSA",
                source=f"Somme des départements attendus, {SRC_DEP}",
                note="Total arrêté en 2020 : riz 2021 incomplet" if ferme else (f"Total partiel : {len(groupe)} départements sur {attendus} attendus" if len(groupe) < attendus else None)))
    return lignes


def series():
    deps = []
    for annee in range(2010, 2022):
        for i, code in enumerate(DEPARTEMENTS):
            if annee == 2015 and i == 1:
                continue  # Saint-Louis absent en 2015 : total incomplet
            deps.append(_dep(MIL, code, annee, 1000.0 + 100 * i + 10 * (annee - 2010), 2000.0 - 1500 * i))
            deps.append(_dep(RIZ, code, annee, 5000.0 + 10 * (annee - 2010), 1500.0 + 25 * i))
    deps.append(_dep(MIL, SAINT_LOUIS["code_departement"], 2008, 900.0, None))  # production sans superficie : rendement null
    deps.append(_dep(SESAME, KOLDA["code_departement"], 2016, 40.0, 60.0))
    faostat = [ligne("observatoire_series", niveau="PAYS", code_zone="SEN", zone="Sénégal", culture=MIL, campagne_agricole=a,
                     rendement_kg_ha=Decimal("1253.3") if a == 2023 else Decimal(str(900 + a - 2015)), serie="FAOSTAT", source="FAOSTAT",
                     note="Rendement national seul")
               for a in range(2010, 2025)]
    return deps + _agreger([d for d in deps if d["culture"] in (MIL, RIZ)]) + faostat


def objectifs():
    base = dict(perimetre="national", document="LPSAE 2025-2029", page="50")
    return [
        ligne("observatoire_objectifs", **base, indicateur="couverture_besoins_riz", culture=RIZ, cultures_concernees=RIZ, unite="%",
              valeur_reference=41.0, cible=64.0, annee_cible=2029),
        ligne("observatoire_objectifs", **{**base, "page": "49"}, indicateur="semences_certifiees", culture="CÉRÉALES (semences)",
              cultures_concernees=f"{RIZ};{MIL};SORGHO", unite="%", cible=100.0),
        ligne("observatoire_objectifs", perimetre="national", document="SSA 2025-2034", page="52", indicateur="superficie_irriguee",
              unite="ha", valeur_reference=130000.0, cible=320000.0, annee_cible=2029),
        ligne("observatoire_objectifs", perimetre="national", document="LPSAE 2025-2029", page="20", indicateur="production_officielle",
              culture="MAÏS", unite="t", valeur_reference=50705.0, annee_reference=2019, note="Erreur probable : 530 705 t"),
        ligne("observatoire_objectifs", perimetre="national", document="SSA 2025-2034", page="26", indicateur="production_officielle",
              culture=MIL, unite="t", valeur_reference=1097033.0, annee_reference=2023, note="Contradiction"),
        ligne("observatoire_objectifs", perimetre="national", document="LPSAE 2025-2029", page="20", indicateur="production_officielle",
              culture=MIL, unite="t", valeur_reference=1260709.0, annee_reference=2023, note="Contradiction"),
        ligne("observatoire_objectifs", perimetre="national", document="SSA 2025-2034", page="52", indicateur="rendement_reference",
              culture=MIL, unite="kg/ha", valeur_reference=1253.0, note="Référence indiquée par la SSA, origine non précisée"),
    ]


def _ref_comparaison():
    return ligne("observatoire_objectifs", perimetre="national", document="SSA 2025-2034", page="52",
                 indicateur="rendement_reference_comparaison", culture=MIL, unite="kg/ha", valeur_reference=1900.0,
                 note="Référence indiquée par la SSA, origine non précisée")


def marts_observatoire() -> dict[str, list[dict]]:
    return {**marts_synthetiques(), "observatoire_series": series(), "observatoire_objectifs": objectifs() + [_ref_comparaison()]}


@pytest.fixture(scope="module")
def obs() -> TestClient:
    marts = marts_observatoire()
    s = service_test(lecteur=lambda: marts)
    asyncio.run(s.precharger("test"))
    with TestClient(creer_app(s.p, s)) as c:
        yield c


def donnees(client, route, **params):
    r = client.get(f"{V1}/{route}", params=params)
    assert r.status_code == 200, r.text
    return r.json()["donnees"]


def indicateur(client, annee, culture, zone, nom):
    d = donnees(client, "indicateurs", annee=annee, culture=culture, zone=zone)
    return next(i for i in d["indicateurs"] if i["indicateur"] == nom)


# ---------------------------------------------------------------- disponibilité


def test_routes_404_sans_mart():
    s = service_test()
    asyncio.run(s.precharger("test"))
    with TestClient(creer_app(s.p, s)) as c:
        for route in ("filtres", "indicateurs?annee=2019&culture=mil", "serie?culture=mil&indicateur=production", "objectifs"):
            r = c.get(f"{V1}/{route}")
            assert r.status_code == 404 and r.json()["erreur"]["code"] == "observatoire_indisponible"
        assert c.get("/api/v1/referentiels/departements").status_code == 200  # le reste de l'API n'est pas gêné


# ---------------------------------------------------------------- filtres


def test_filtres_couverture_et_mentions(obs):
    f = donnees(obs, "filtres")
    cultures = {c["culture"]: c for c in f["cultures"]}
    assert cultures[SESAME]["mention"] == "données jusqu'en 2016" and cultures[SESAME]["a_totaux"] is False
    assert cultures[MIL]["mention"] is None and cultures[MIL]["a_totaux"] is True
    assert cultures[MIL]["annees_couvertes"][0] == 2008 and cultures[MIL]["annees_couvertes"][-1] == 2021
    assert cultures[MIL]["faostat_annees"][-1] == 2024
    assert f["sans_donnees"] == ["OIGNON", "FONIO"] and f["mention_sans_donnees"] == "Oignon, fonio : pas de données disponibles"
    assert f["derniere_annee_departements"] == 2021 and 2024 in f["annees"]
    assert {z["niveau"] for z in f["zones"]} == {"PAYS", "REGION", "DEPARTEMENT"}
    assert any("FAOSTAT" in ligne_ for ligne_ in f["couverture"])


def test_culture_sans_donnees_et_inconnue(obs):
    r = obs.get(f"{V1}/serie", params={"culture": "oignon", "indicateur": "production"})
    assert r.status_code == 404 and r.json()["erreur"]["code"] == "culture_sans_donnees"
    r = obs.get(f"{V1}/serie", params={"culture": "banane", "indicateur": "production"})
    assert r.status_code == 404 and r.json()["erreur"]["code"] == "culture_inconnue"
    r = obs.get(f"{V1}/indicateurs", params={"annee": 2019, "culture": "mil", "zone": "SEN.99.9_1"})
    assert r.json()["erreur"]["code"] == "zone_inconnue"
    r = obs.get(f"{V1}/indicateurs", params={"annee": 2019, "culture": SESAME, "zone": "SEN"})
    assert r.json()["erreur"]["code"] == "aucune_donnee_zone"  # pas de total pays pour le sésame


# ---------------------------------------------------------------- somme, rendement, null, source


def test_somme_des_departements_egale_national(obs):
    for annee in (2012, 2019, 2021):
        deps = [indicateur(obs, annee, "mil", z, "production") for z in DEPARTEMENTS]
        national = indicateur(obs, annee, "mil", "SEN", "production")
        assert national["valeur"] == pytest.approx(sum(d["valeur"] for d in deps), abs=0.01)
        assert national["est_complet"] is True and national["nb_departements_observes"] == 2
        surfaces = [indicateur(obs, annee, "mil", z, "surface")["valeur"] for z in DEPARTEMENTS]
        assert indicateur(obs, annee, "mil", "SEN", "surface")["valeur"] == pytest.approx(sum(surfaces), abs=0.01)


def test_rendement_agrege_est_production_sur_surface_pas_une_moyenne(obs):
    annee = 2019
    prod = indicateur(obs, annee, "mil", "SEN", "production")["valeur"]
    surf = indicateur(obs, annee, "mil", "SEN", "surface")["valeur"]
    rend = indicateur(obs, annee, "mil", "SEN", "rendement")["valeur"]
    assert rend == pytest.approx(prod * 1000 / surf, abs=0.01)
    moyenne = sum(indicateur(obs, annee, "mil", z, "rendement")["valeur"] for z in DEPARTEMENTS) / 2
    assert abs(rend - moyenne) > 1  # les deux calculs diffèrent : on n'a pas fait la moyenne des rendements


def test_total_incomplet_signale(obs):
    p = indicateur(obs, 2015, "mil", "SEN", "production")
    assert p["est_complet"] is False and p["nb_departements_observes"] == 1 and p["nb_departements_attendus"] == 2
    assert "partiel" in p["note"]
    assert indicateur(obs, 2016, "mil", "SEN", "production")["comparable_n1"] is False  # 2015 incomplet et rupture 2016


def test_valeur_absente_est_null_pas_zero(obs):
    i = indicateur(obs, 2023, "mil", "SEN", "production")
    assert i["valeur"] is None and i["derniere_annee_disponible"] == 2021 and i["source"] is None
    assert i["variation_n1_pct"] is None and i["ecart_moyenne_10_ans_pct"] is None
    saint_louis = SAINT_LOUIS["code_departement"]
    assert indicateur(obs, 2015, "mil", saint_louis, "production")["valeur"] is None  # département absent cette année-là
    sans_surface = indicateur(obs, 2008, "mil", saint_louis, "rendement")  # production sans superficie
    assert sans_surface["valeur"] is None and sans_surface["derniere_annee_disponible"] is None
    assert indicateur(obs, 2008, "mil", saint_louis, "production")["valeur"] == 900.0


def test_chaque_valeur_a_une_source(obs):
    for route, params in [("indicateurs", dict(annee=2019, culture="mil", zone="SEN")),
                          ("indicateurs", dict(annee=2019, culture="riz", zone=KOLDA["code_departement"]))]:
        for i in donnees(obs, route, **params)["indicateurs"]:
            assert (i["valeur"] is None) or i["source"]
    for z in ("SEN", KOLDA["code_region"], KOLDA["code_departement"]):
        for ind in ("production", "surface", "rendement"):
            for p in donnees(obs, "serie", culture="mil", zone=z, indicateur=ind)["points"]:
                assert p["valeur"] is None or p["source"]
    for ind in ("production", "surface", "rendement"):
        for ligne_ in donnees(obs, "carte", annee=2019, culture="mil", indicateur=ind):
            assert (ligne_["valeur"] is None) == (not ligne_["a_donnee"])
            assert ligne_["valeur"] is None or ligne_["source"]


# ---------------------------------------------------------------- variation, écart, rang, part


def test_variation_ecart_rang_part(obs):
    kolda = KOLDA["code_departement"]
    p19, p18 = (indicateur(obs, a, "mil", kolda, "production")["valeur"] for a in (2019, 2018))
    i = indicateur(obs, 2019, "mil", kolda, "production")
    assert i["variation_n1_pct"] == pytest.approx((p19 - p18) / p18 * 100, abs=0.01)
    anterieures = [indicateur(obs, a, "mil", kolda, "production")["valeur"] for a in range(2009, 2019)]
    anterieures = [v for v in anterieures if v is not None]
    assert i["nb_annees_moyenne"] == len(anterieures) == 9
    assert i["ecart_moyenne_10_ans_pct"] == pytest.approx((p19 - sum(anterieures) / 9) / (sum(anterieures) / 9) * 100, abs=0.01)
    assert i["rang"] == 2 and i["nb_classes"] == 2  # Saint-Louis produit plus que Kolda dans ces données
    total = indicateur(obs, 2019, "mil", "SEN", "production")["valeur"]
    assert i["part_nationale_pct"] == pytest.approx(p19 / total * 100, abs=0.01)
    assert indicateur(obs, 2019, "mil", "SEN", "production")["rang"] is None
    assert indicateur(obs, 2019, "mil", kolda, "rendement")["part_nationale_pct"] is None  # un rendement n'a pas de part


# ---------------------------------------------------------------- riz 2021 et FAOSTAT


def test_riz_national_2021_null_departements_visibles_incomplets(obs):
    for z in ("SEN", KOLDA["code_region"]):
        for nom in ("production", "surface", "rendement"):
            i = indicateur(obs, 2021, "riz", z, nom)
            assert i["valeur"] is None and i["derniere_annee_disponible"] == 2020 and i["est_complet"] is False
    assert indicateur(obs, 2020, "riz", "SEN", "production")["valeur"] is not None
    dep = indicateur(obs, 2021, "riz", KOLDA["code_departement"], "production")
    assert dep["valeur"] is not None and dep["source"]
    serie = donnees(obs, "serie", culture="riz", zone="SEN", indicateur="production")
    p2021 = next(p for p in serie["points"] if p["annee"] == 2021)
    assert p2021["valeur"] is None and "arrêté" in p2021["note"]
    avert = obs.get(f"{V1}/serie", params={"culture": "riz", "zone": "SEN", "indicateur": "production"}).json()["meta"]["avertissements"]
    assert any("Riz" in a and "2020" in a for a in avert)


def test_faostat_serie_distincte_jamais_additionnee(obs):
    s = donnees(obs, "serie", culture="mil", zone="SEN", indicateur="rendement")
    assert s["derniere_annee_departements"] == 2021 and "2021" in s["mention_arret"]
    assert [p["annee"] for p in s["points"]][0] == 1981 and [p["annee"] for p in s["points"]][-1] == 2021
    assert [p["annee"] for p in s["serie_faostat"]][-1] == 2024
    assert all(f["source"] == "FAOSTAT" for f in s["serie_faostat"])
    assert all(p["annee"] <= 2021 and p["source"] != "FAOSTAT" for p in s["points"])  # aucune valeur FAOSTAT dans les points DAPSA
    dapsa_2021 = next(p for p in s["points"] if p["annee"] == 2021)["valeur"]
    fao_2021 = next(f for f in s["serie_faostat"] if f["annee"] == 2021)["rendement_kg_ha"]
    assert dapsa_2021 != fao_2021
    # production et superficie : pas de FAOSTAT ; ailleurs que pays : pas de FAOSTAT
    assert donnees(obs, "serie", culture="mil", zone="SEN", indicateur="production")["serie_faostat"] == []
    assert donnees(obs, "serie", culture="mil", zone=KOLDA["code_departement"], indicateur="rendement")["serie_faostat"] == []
    # indicateurs : la valeur 2023 reste null, FAOSTAT est à part
    d = donnees(obs, "indicateurs", annee=2023, culture="mil", zone="SEN")
    assert all(i["valeur"] is None for i in d["indicateurs"])
    assert d["rendement_faostat"]["rendement_kg_ha"] == 1253.3 and d["rendement_faostat"]["source"] == "FAOSTAT"
    assert donnees(obs, "indicateurs", annee=2023, culture="mil", zone=KOLDA["code_departement"])["rendement_faostat"] is None


def test_points_officiels_avec_document_et_page(obs):
    s = donnees(obs, "serie", culture="mil", zone="SEN", indicateur="production")
    officiels = s["points_officiels"]
    assert {(p["valeur"], p["document"], p["page"]) for p in officiels} == {
        (1260709.0, "LPSAE 2025-2029", "20"), (1097033.0, "SSA 2025-2034", "26")}  # les deux valeurs de la contradiction
    assert all(p["annee"] == 2023 and p["note"] for p in officiels)
    r = donnees(obs, "serie", culture="mil", zone="SEN", indicateur="rendement")["points_officiels"]
    assert r[0]["valeur"] == 1253.0 and "origine non précisée" in r[0]["note"]
    ref = donnees(obs, "serie", culture="mil", zone="SEN", indicateur="rendement")["reference_rendement"]
    assert ref["valeur"] == 1900.0 and ref["page"] == "52" and "origine non précisée" in ref["note"]
    assert donnees(obs, "serie", culture="mil", zone="SEN", indicateur="production")["reference_rendement"] is None
    assert donnees(obs, "serie", culture="mil", zone=KOLDA["code_region"], indicateur="rendement")["reference_rendement"] is None
    assert not any(o["indicateur"] == "rendement_reference_comparaison" for o in donnees(obs, "objectifs")["objectifs"])
    assert donnees(obs, "serie", culture="mil", zone=KOLDA["code_region"], indicateur="production")["points_officiels"] == []


# ---------------------------------------------------------------- carte, classement, objectifs


def test_carte_45_departements_hachures_sans_donnee(obs):
    c = donnees(obs, "carte", annee=2019, culture="mil", indicateur="production")
    assert len(c) == 3  # départements du jeu synthétique
    par_code = {x["code_departement"]: x for x in c}
    assert par_code[KOLDA["code_departement"]]["a_donnee"] is True
    assert par_code["SEN.1.2_1"]["valeur"] is None and par_code["SEN.1.2_1"]["a_donnee"] is False  # Guédiawaye


def test_classement_et_progression_10_ans(obs):
    c = donnees(obs, "classement", annee=2021, culture="mil", indicateur="production")
    assert [x["rang"] for x in c] == [1, 2] and c[0]["valeur"] >= c[1]["valeur"]
    x = c[0]
    ancien = indicateur(obs, 2011, "mil", x["code_departement"], "production")["valeur"]
    assert x["annee_comparaison"] == 2011 and x["valeur_comparaison"] == ancien
    assert x["progression_10_ans_pct"] == pytest.approx((x["valeur"] - ancien) / ancien * 100, abs=0.01)
    assert x["rupture_type_superficie"] is False  # la production n'est pas touchée par la rupture 2016
    r = donnees(obs, "classement", annee=2021, culture="mil", indicateur="rendement")
    assert r[0]["rupture_type_superficie"] is True
    ancien_absent = donnees(obs, "classement", annee=2012, culture="mil", indicateur="production")
    assert all(x["progression_10_ans_pct"] is None and x["valeur_comparaison"] is None for x in ancien_absent)  # 2002 : pas de donnée


def test_objectifs_existants_et_message(obs):
    riz = donnees(obs, "objectifs", culture="riz")
    assert {o["indicateur"] for o in riz["objectifs"]} == {"couverture_besoins_riz", "semences_certifiees"}
    couverture = next(o for o in riz["objectifs"] if o["indicateur"] == "couverture_besoins_riz")
    assert (couverture["valeur_reference"], couverture["cible"], couverture["annee_cible"], couverture["page"]) == (41.0, 64.0, 2029, "50")
    assert next(o for o in riz["objectifs"] if o["indicateur"] == "semences_certifiees")["portee"] == "groupe"
    assert riz["message"] is None
    # production officielle et rendement de référence ne sont pas des objectifs
    assert not any(o["indicateur"] in ("production_officielle", "rendement_reference") for o in donnees(obs, "objectifs")["objectifs"])
    # une culture sans objectif : message, jamais d'objectif inventé
    sesame = donnees(obs, "objectifs", culture="sesame")
    assert sesame["objectifs"] == [] and sesame["message"] == "Pas d'objectif chiffré dans la SSA 2025-2034"
    # les objectifs sont nationaux
    region = donnees(obs, "objectifs", culture="riz", zone=KOLDA["code_region"])
    assert region["objectifs"] == [] and "nationaux" in region["message"]


# ---------------------------------------------------------------- contrôle sur les vraies données (facultatif)


@pytest.mark.skipif(not os.getenv("OBSERVATOIRE_TEST_SNOWFLAKE"), reason="lecture Snowflake : OBSERVATOIRE_TEST_SNOWFLAKE=1")
def test_marts_reels_invariants():
    from api.config import Parametres
    from api.source_snowflake import creer_lecteur
    from api.marts import tables_a_lire

    tables = {k: v for k, v in tables_a_lire().items() if k.startswith("observatoire")}
    brut = creer_lecteur(Parametres(), tables)()
    lignes = [ligne_ for ligne_ in brut["observatoire_series"] if ligne_["serie"] == "DAPSA"]
    pays = [x for x in lignes if x["niveau"] == "PAYS"]
    regions = {(x["culture"], x["campagne_agricole"]): 0.0 for x in pays}
    for x in lignes:
        if x["niveau"] == "REGION" and x["production_t"] is not None:
            regions[(x["culture"], x["campagne_agricole"])] += float(x["production_t"])
    for x in pays:
        if x["production_t"] is not None:
            assert float(x["production_t"]) == pytest.approx(regions[(x["culture"], x["campagne_agricole"])], abs=0.01)
            assert float(x["rendement_kg_ha"]) == pytest.approx(float(x["production_t"]) * 1000 / float(x["superficie_ha"]), abs=0.01)
    riz = [x for x in pays if x["culture"] == RIZ and x["campagne_agricole"] == 2021]
    assert riz and riz[0]["production_t"] is None and riz[0]["est_complet"] is False
    assert all(x["source"] == "FAOSTAT" and x["production_t"] is None for x in brut["observatoire_series"] if x["serie"] == "FAOSTAT")
