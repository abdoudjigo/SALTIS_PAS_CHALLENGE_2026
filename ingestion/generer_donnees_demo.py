"""Generate a deterministic, clearly labeled synthetic demo dataset.

This script never claims to contain observed agricultural measurements.
It creates CSV files under data/modules for local demos and offline exports.
"""

from __future__ import annotations

import csv
import html
import math
import random
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "modules"
PDF_OUT = ROOT / "docs" / "technique" / "donnees-demo-synthetiques.pdf"
REGION = {
    "SEN.1": "Dakar", "SEN.2": "Diourbel", "SEN.3": "Fatick",
    "SEN.4": "Kaffrine", "SEN.5": "Kaolack", "SEN.6": "Kédougou",
    "SEN.7": "Kolda", "SEN.8": "Louga", "SEN.9": "Matam",
    "SEN.10": "Saint-Louis", "SEN.11": "Sédhiou",
    "SEN.12": "Tambacounda", "SEN.13": "Thiès", "SEN.14": "Ziguinchor",
}
ZONE_BASE = {
    "Niayes": 560, "Bassin arachidier": 720,
    "Vallée du fleuve Sénégal": 330,
    "Sénégal oriental": 980, "Casamance": 1180,
    "Zone sylvopastorale (Ferlo)": 420,
}


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(name: str, rows: list[dict], fieldnames: list[str]) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return path


def qr(seed_text: str) -> random.Random:
    return random.Random(seed_text)


def dept_key(code: str) -> str:
    return ".".join(code.split(".")[:2])


def main() -> None:
    departments = load_csv(ROOT / "dbt" / "seeds" / "ref_departements.csv")
    cultures = load_csv(ROOT / "dbt" / "seeds" / "ref_cultures.csv")
    rng = qr("SALTIS-DEMO-V1")
    zones = list(dict.fromkeys(d["zone_agroecologique"] for d in departments))

    generated: list[tuple[str, int, str]] = []

    # A - seasonal observations
    saisons: list[dict] = []
    for dept in departments:
        code = dept["code_departement"]
        zone = dept["zone_agroecologique"]
        base = ZONE_BASE.get(zone, 650)
        for year in range(1981, 2026):
            drng = qr(f"saison-{code}-{year}")
            climate = 0.82 + 0.20 * math.sin((year - 1981) / 7.3) + drng.gauss(0, 0.10)
            normal = base * (1 + (drng.random() - 0.5) * 0.08)
            rain = max(80, normal * climate)
            anomaly = (rain / normal - 1) * 100
            spi = (rain - normal) / max(normal * 0.28, 1)
            if spi <= -1.5:
                season_class = "très sèche"
            elif spi <= -0.5:
                season_class = "sèche"
            elif spi >= 1.5:
                season_class = "très humide"
            elif spi >= 0.5:
                season_class = "humide"
            else:
                season_class = "normale"
            start = int(normal >= 800 and 170 or 155 + drng.randint(-12, 18))
            end = int(start + 115 + drng.randint(-20, 25))
            dry_days = max(7, int(25 - spi * 5 + drng.randint(-5, 8)))
            saisons.append({
                "code_departement": code, "departement": dept["departement"],
                "region": REGION.get(dept_key(code), ""), "zone_agroecologique": zone,
                "annee": year, "pluie_saison_mm": round(rain, 1),
                "pluie_normale_saison_mm": round(normal, 1),
                "anomalie_pluie_saison_pct": round(anomaly, 1),
                "spi_saison": round(spi, 2), "debut_saison_jour": start,
                "retard_debut_saison_j": round((start - 165) / 1.0, 1),
                "fin_saison_jour": end, "duree_saison_j": end - start,
                "nb_jours_pluie": int(rain / 12), "nb_jours_pluie_forte": drng.randint(2, 9),
                "pluie_max_journaliere_mm": round(25 + drng.random() * 55, 1),
                "plus_longue_sequence_seche_j": dry_days,
                "nb_sequences_seches_7j": drng.randint(2, 8),
                "temp_max_moy_saison_c": round(29 + drng.random() * 5, 1),
                "nb_jours_tmax_sup_40": drng.randint(0, 12),
                "et0_saison_mm": round(550 + drng.random() * 180, 1),
                "humidite_sol_surface_m3_m3": "" if code in {"SEN.1.1_1", "SEN.1.2_1", "SEN.1.3_1"} else round(0.20 + drng.random() * 0.12, 3),
                "ndvi_max_saison_zc": "" if year < 2000 else round(0.45 + drng.random() * 0.25, 3),
                "anomalie_ndvi_pct": "" if year < 2000 else round(drng.gauss(0, 12), 1),
                "source_calendrier": "DEMO_SYNTHETIQUE",
                "nb_decades_seches": drng.randint(2, 10),
                "nb_decades_tres_pluvieuses": drng.randint(0, 5),
                "pluie_juin_juillet_mm": round(rain * drng.uniform(0.25, 0.38), 1),
                "classe_saison": season_class,
                "alerte_secheresse": season_class in {"très sèche", "sèche"} or dry_days >= 15,
                "alerte_exces_pluie": season_class in {"très humide", "humide"},
            })
    path = write_csv("a_saisons_departement.csv", saisons, list(saisons[0].keys()))
    generated.append((path.name, len(saisons), "Démo synthétique des bilans saisonniers"))

    profile_fields = [
        "code_departement", "departement", "region", "zone_agroecologique",
        "pluie_saison_normale_mm", "variabilite_pluie_cv_pct",
        "pluie_saison_annee_seche_mm", "proba_saison_seche_pct",
        "debut_saison_moyen_jour", "debut_saison_precoce_jour",
        "debut_saison_tardif_jour", "fin_saison_moyenne_jour",
        "duree_saison_moyenne_j", "duree_saison_courte_j",
        "nb_sequences_seches_7j_moyen", "proba_sequence_seche_15j_pct",
        "proba_exces_pluie_pct", "et0_saison_normale_mm", "classe_texture",
        "reserve_utile_mm", "ph_eau", "carbone_organique_g_kg",
        "part_cultures_pct", "superficie_km2",
    ]
    profiles = []
    for dept in departments:
        drng = qr(f"profile-{dept['code_departement']}")
        zone = dept["zone_agroecologique"]
        base = ZONE_BASE.get(zone, 650)
        profiles.append({
            "code_departement": dept["code_departement"], "departement": dept["departement"],
            "region": REGION.get(dept_key(dept["code_departement"]), ""),
            "zone_agroecologique": zone, "pluie_saison_normale_mm": round(base, 1),
            "variabilite_pluie_cv_pct": round(drng.uniform(12, 28), 1),
            "pluie_saison_annee_seche_mm": round(base * drng.uniform(0.65, 0.78), 1),
            "proba_saison_seche_pct": round(drng.uniform(15, 28), 1),
            "debut_saison_moyen_jour": 158 + drng.randint(-8, 18),
            "debut_saison_precoce_jour": 145 + drng.randint(-5, 8),
            "debut_saison_tardif_jour": 178 + drng.randint(-5, 12),
            "fin_saison_moyenne_jour": 293 + drng.randint(-12, 12),
            "duree_saison_moyenne_j": 135 + drng.randint(-12, 18),
            "duree_saison_courte_j": 105 + drng.randint(-10, 12),
            "nb_sequences_seches_7j_moyen": round(drng.uniform(2.5, 6.5), 1),
            "proba_sequence_seche_15j_pct": round(drng.uniform(8, 35), 1),
            "proba_exces_pluie_pct": round(drng.uniform(5, 18), 1),
            "et0_saison_normale_mm": round(620 + drng.uniform(-80, 130), 1),
            "classe_texture": drng.choice(["sablo-limoneuse", "limoneuse", "argilo-sablo-limoneuse"]),
            "reserve_utile_mm": drng.randint(70, 180),
            "ph_eau": round(drng.uniform(5.4, 7.2), 1),
            "carbone_organique_g_kg": round(drng.uniform(4, 15), 1),
            "part_cultures_pct": round(drng.uniform(35, 78), 1),
            "superficie_km2": drng.randint(800, 12000),
        })
    path = write_csv("a_profil_agroclimatique_departement.csv", profiles, profile_fields)
    generated.append((path.name, len(profiles), "Profils départementaux synthétiques"))

    # Decadal data
    suivi_fields = [
        "code_departement", "departement", "zone_agroecologique", "annee", "decade",
        "mois", "decade_du_mois", "periode", "pluie_mm", "nb_jours_pluie",
        "plus_longue_sequence_seche_j", "cumul_depuis_juin_mm", "part_saison_pct",
        "pluie_normale_mm", "anomalie_pluie_pct", "decade_seche",
    ]
    suivi = []
    seasons_by_key = {(r["code_departement"], r["annee"]): r for r in saisons}
    month_names = ["janvier", "fevrier", "mars", "avril", "mai", "juin",
                   "juillet", "aout", "septembre", "octobre", "novembre", "decembre"]
    for dept in departments:
        code = dept["code_departement"]
        zone = dept["zone_agroecologique"]
        base = ZONE_BASE.get(zone, 650)
        for year in range(1981, 2026):
            season = seasons_by_key[(code, year)]
            cumul = 0.0
            for decade in range(1, 37):
                month = (decade - 1) // 3 + 1
                decade_month = (decade - 1) % 3 + 1
                drng = qr(f"decade-{code}-{year}-{decade}")
                seasonality = 0.05 if month < 5 or month > 10 else 0.18 + 0.12 * math.sin((month - 5) * math.pi / 5)
                normal = max(2.0, base / 15 * seasonality * drng.uniform(0.75, 1.25))
                rain = max(0.0, normal * drng.uniform(0.65, 1.35))
                if month >= 6 and month <= 10:
                    cumul += rain
                anomaly = "" if normal < 1 else round((rain / normal - 1) * 100, 1)
                suivi.append({
                    "code_departement": code, "departement": dept["departement"],
                    "zone_agroecologique": zone, "annee": year, "decade": decade,
                    "mois": month_names[month - 1], "decade_du_mois": decade_month,
                    "periode": f"{month_names[month - 1]} {decade_month}",
                    "pluie_mm": round(rain, 1), "nb_jours_pluie": drng.randint(0, 7),
                    "plus_longue_sequence_seche_j": drng.randint(2, 12),
                    "cumul_depuis_juin_mm": round(cumul, 1) if 16 <= decade <= 30 else "",
                    "part_saison_pct": round(rain / max(float(season["pluie_saison_mm"]), 1) * 100, 2),
                    "pluie_normale_mm": round(normal, 1),
                    "anomalie_pluie_pct": anomaly,
                    "decade_seche": rain < 10,
                })
    path = write_csv("a_suivi_pluie_decade.csv", suivi, suivi_fields)
    generated.append((path.name, len(suivi), "Suivi décadaire synthétique"))

    repartition_fields = [
        "code_departement", "departement", "zone_agroecologique", "decade",
        "mois", "decade_du_mois", "periode", "pluie_moyenne_mm",
        "pluie_mediane_mm", "pluie_1_annee_sur_5_mm", "pluie_4_annees_sur_5_mm",
        "pluie_max_mm", "nb_jours_pluie_moyen",
        "plus_longue_sequence_seche_moyenne_j", "proba_decade_seche_pct",
        "proba_decade_tres_pluvieuse_pct", "proba_sequence_seche_7j_pct",
        "cumul_moyen_depuis_juin_mm", "part_saison_pct",
        "pluie_annees_seches_mm", "part_saison_annees_seches_pct",
        "pluie_annees_humides_mm", "part_saison_annees_humides_pct",
        "pluie_saison_normale_mm", "pluie_saison_annees_seches_mm",
        "pluie_saison_annees_humides_mm", "part_cumulee_saison_pct",
    ]
    repartition = []
    cumulative = {}
    for dept in departments:
        code = dept["code_departement"]
        zone = dept["zone_agroecologique"]
        base = ZONE_BASE.get(zone, 650)
        cumul_normal = 0.0
        cumul_total = 0.0
        for decade in range(1, 37):
            month = (decade - 1) // 3 + 1
            decade_month = (decade - 1) % 3 + 1
            drng = qr(f"repartition-{code}-{decade}")
            seasonality = 0.05 if month < 5 or month > 10 else 0.18 + 0.12 * math.sin((month - 5) * math.pi / 5)
            mean = max(2.0, base / 15 * seasonality)
            dry = mean * drng.uniform(0.55, 0.75)
            wet = mean * drng.uniform(1.25, 1.55)
            if 16 <= decade <= 30:
                cumul_normal += mean
                cumul_total += mean
            repartition.append({
                "code_departement": code, "departement": dept["departement"],
                "zone_agroecologique": zone, "decade": decade,
                "mois": month_names[month - 1], "decade_du_mois": decade_month,
                "periode": f"{month_names[month - 1]} {decade_month}",
                "pluie_moyenne_mm": round(mean, 1),
                "pluie_mediane_mm": round(mean * drng.uniform(0.85, 1.05), 1),
                "pluie_1_annee_sur_5_mm": round(dry, 1),
                "pluie_4_annees_sur_5_mm": round(wet, 1),
                "pluie_max_mm": round(wet * drng.uniform(1.3, 1.8), 1),
                "nb_jours_pluie_moyen": round(drng.uniform(0.2, 7.0), 1),
                "plus_longue_sequence_seche_moyenne_j": round(drng.uniform(3, 14), 1),
                "proba_decade_seche_pct": round(drng.uniform(10, 75), 1),
                "proba_decade_tres_pluvieuse_pct": round(drng.uniform(2, 18), 1),
                "proba_sequence_seche_7j_pct": round(drng.uniform(15, 65), 1),
                "cumul_moyen_depuis_juin_mm": round(cumul_normal, 1) if 16 <= decade <= 30 else "",
                "part_saison_pct": round(mean / max(base, 1) * 100, 2),
                "pluie_annees_seches_mm": round(dry, 1),
                "part_saison_annees_seches_pct": round(dry / max(base * 0.72, 1) * 100, 2),
                "pluie_annees_humides_mm": round(wet, 1),
                "part_saison_annees_humides_pct": round(wet / max(base * 1.25, 1) * 100, 2),
                "pluie_saison_normale_mm": round(base, 1),
                "pluie_saison_annees_seches_mm": round(base * 0.72, 1),
                "pluie_saison_annees_humides_mm": round(base * 1.25, 1),
                "part_cumulee_saison_pct": round(cumul_normal / max(base, 1) * 100, 2) if 16 <= decade <= 30 else "",
            })
    path = write_csv("a_repartition_pluie_departement_decade.csv", repartition, repartition_fields)
    generated.append((path.name, len(repartition), "Climatologie décadaire départementale synthétique"))

    zone_repartition = []
    zone_fields = ["zone_agroecologique"] + repartition_fields[3:]
    for zone in zones:
        base = ZONE_BASE.get(zone, 650)
        cumul_normal = 0.0
        for decade in range(1, 37):
            month = (decade - 1) // 3 + 1
            decade_month = (decade - 1) % 3 + 1
            drng = qr(f"repartition-zone-{zone}-{decade}")
            seasonality = 0.05 if month < 5 or month > 10 else 0.18 + 0.12 * math.sin((month - 5) * math.pi / 5)
            mean = max(2.0, base / 15 * seasonality)
            dry = mean * drng.uniform(0.55, 0.75)
            wet = mean * drng.uniform(1.25, 1.55)
            if 16 <= decade <= 30:
                cumul_normal += mean
            zone_repartition.append({
                "zone_agroecologique": zone, "decade": decade,
                "mois": month_names[month - 1], "decade_du_mois": decade_month,
                "periode": f"{month_names[month - 1]} {decade_month}",
                "pluie_moyenne_mm": round(mean, 1),
                "pluie_mediane_mm": round(mean * drng.uniform(0.85, 1.05), 1),
                "pluie_1_annee_sur_5_mm": round(dry, 1),
                "pluie_4_annees_sur_5_mm": round(wet, 1),
                "pluie_max_mm": round(wet * drng.uniform(1.3, 1.8), 1),
                "nb_jours_pluie_moyen": round(drng.uniform(0.2, 7.0), 1),
                "plus_longue_sequence_seche_moyenne_j": round(drng.uniform(3, 14), 1),
                "proba_decade_seche_pct": round(drng.uniform(10, 75), 1),
                "proba_decade_tres_pluvieuse_pct": round(drng.uniform(2, 18), 1),
                "proba_sequence_seche_7j_pct": round(drng.uniform(15, 65), 1),
                "cumul_moyen_depuis_juin_mm": round(cumul_normal, 1) if 16 <= decade <= 30 else "",
                "part_saison_pct": round(mean / max(base, 1) * 100, 2),
                "pluie_annees_seches_mm": round(dry, 1),
                "part_saison_annees_seches_pct": round(dry / max(base * 0.72, 1) * 100, 2),
                "pluie_annees_humides_mm": round(wet, 1),
                "part_saison_annees_humides_pct": round(wet / max(base * 1.25, 1) * 100, 2),
                "pluie_saison_normale_mm": round(base, 1),
                "pluie_saison_annees_seches_mm": round(base * 0.72, 1),
                "pluie_saison_annees_humides_mm": round(base * 1.25, 1),
                "part_cumulee_saison_pct": round(cumul_normal / max(base, 1) * 100, 2) if 16 <= decade <= 30 else "",
            })
    path = write_csv("a_repartition_pluie_zone_decade.csv", zone_repartition, zone_fields)
    generated.append((path.name, len(zone_repartition), "Climatologie décadaire zonale synthétique"))

    # A predictors
    predict_fields = [
        "code_departement", "departement", "region", "zone_agroecologique", "annee",
        "pluie_saison_mm", "classe_saison", "pluie_normale_saison_mm",
        "pluie_saison_n_moins_1_mm", "indice_amo_mars_mai",
        "indice_oni_mars_mai", "indice_tna_mars_mai", "indice_tsa_mars_mai",
        "humidite_sol_avril_mai_m3_m3",
    ]
    predictors = []
    for row in saisons:
        predictors.append({
            "code_departement": row["code_departement"],
            "departement": row["departement"], "region": row["region"],
            "zone_agroecologique": row["zone_agroecologique"], "annee": row["annee"],
            "pluie_saison_mm": row["pluie_saison_mm"], "classe_saison": row["classe_saison"],
            "pluie_normale_saison_mm": row["pluie_normale_saison_mm"],
            "pluie_saison_n_moins_1_mm": "" if row["annee"] == 1981 else next(
                (
                    str(season["pluie_saison_mm"])
                    for season in saisons
                    if season["code_departement"] == row["code_departement"]
                    and season["annee"] == row["annee"] - 1
                ),
                "",
            ),
            "indice_amo_mars_mai": "" if row["annee"] >= 2023 else round(qr(f"amo-{row['annee']}").uniform(-0.5, 0.5), 3),
            "indice_oni_mars_mai": round(qr(f"oni-{row['annee']}").uniform(-1.5, 1.5), 3),
            "indice_tna_mars_mai": round(qr(f"tna-{row['annee']}").uniform(-0.4, 0.4), 3),
            "indice_tsa_mars_mai": round(qr(f"tsa-{row['annee']}").uniform(-0.4, 0.4), 3),
            "humidite_sol_avril_mai_m3_m3": row["humidite_sol_surface_m3_m3"],
        })
    path = write_csv("a_predicteurs_saisonniers.csv", predictors, predict_fields)
    generated.append((path.name, len(predictors), "Variables prédictives synthétiques"))

    # B crop adequacy
    adequacy_fields = [
        "code_departement", "departement", "region", "zone_agroecologique",
        "culture", "classe_cycle", "cycle_jours", "proba_cycle_couvert_pct",
        "besoin_eau_estime_mm", "proba_besoin_eau_couvert_pct",
        "rendement_moyen_kg_ha", "variabilite_rendement_cv_pct",
        "score_adequation", "niveau_adequation", "classe_texture",
        "ph_eau", "reserve_utile_mm",
    ]
    adequacy = []
    for dept in departments:
        zone = dept["zone_agroecologique"]
        base = ZONE_BASE.get(zone, 650)
        for culture in cultures:
            lo, hi = map(int, culture["cycle_jours"].split("-"))
            for label, cycle in (("courte", lo), ("moyenne", (lo + hi) // 2), ("longue", hi)):
                drng = qr(f"adequacy-{dept['code_departement']}-{culture['culture']}-{label}")
                probability = max(20, min(95, 95 - abs(cycle - 120) * 0.18 - (850 - base) * 0.02 + drng.uniform(-8, 8)))
                need = int(drng.uniform(300, 650) + (cycle - lo) * 2)
                score = max(0, min(100, probability - abs(need - base) / 20))
                adequacy.append({
                    "code_departement": dept["code_departement"], "departement": dept["departement"],
                    "region": REGION.get(dept_key(dept["code_departement"]), ""),
                    "zone_agroecologique": zone, "culture": culture["culture"],
                    "classe_cycle": label, "cycle_jours": cycle,
                    "proba_cycle_couvert_pct": round(probability, 1),
                    "besoin_eau_estime_mm": need,
                    "proba_besoin_eau_couvert_pct": round(max(10, min(95, probability + drng.uniform(-12, 12))), 1),
                    "rendement_moyen_kg_ha": drng.randint(700, 2400),
                    "variabilite_rendement_cv_pct": round(drng.uniform(10, 32), 1),
                    "score_adequation": round(score, 1),
                    "niveau_adequation": "très adaptée" if score >= 75 else "adaptée" if score >= 55 else "à risque",
                    "classe_texture": drng.choice(["sablo-limoneuse", "limoneuse", "argileuse"]),
                    "ph_eau": round(drng.uniform(5.5, 7.3), 1),
                    "reserve_utile_mm": drng.randint(70, 180),
                })
    path = write_csv("b_adequation_culture_departement.csv", adequacy, adequacy_fields)
    generated.append((path.name, len(adequacy), "Adéquation culturelle synthétique"))

    variety_fields = [
        "culture", "variete", "obtenteur", "annee_homologation", "cycle_jours",
        "classe_cycle", "tolerance_secheresse", "besoin_eau_mm",
        "rendement_potentiel_kg_ha", "zones_recommandees", "pluie_min_mm",
        "pluie_max_mm", "tolerance_salinite", "disponibilite_semences",
        "caracteristiques", "source",
    ]
    varieties = []
    for culture in cultures:
        drng = qr(f"variety-{culture['culture']}")
        lo, hi = map(int, culture["cycle_jours"].split("-"))
        varieties.append({
            "culture": culture["culture"],
            "variete": f"{culture['culture']} Démo {drng.randint(100, 399)}",
            "obtenteur": "DEMO_SYNTHETIQUE",
            "annee_homologation": 2026,
            "cycle_jours": (lo + hi) // 2,
            "classe_cycle": "moyenne",
            "tolerance_secheresse": drng.choice(["faible", "moyenne", "forte"]),
            "besoin_eau_mm": drng.randint(350, 900),
            "rendement_potentiel_kg_ha": drng.randint(1200, 3500),
            "zones_recommandees": "Toutes les zones du jeu synthétique",
            "pluie_min_mm": drng.randint(300, 500),
            "pluie_max_mm": drng.randint(900, 1400),
            "tolerance_salinite": drng.choice(["faible", "moyenne"]),
            "disponibilite_semences": "déclarée pour la démonstration",
            "caracteristiques": "Variété fictive destinée uniquement aux écrans.",
            "source": "DEMO_SYNTHETIQUE",
        })
    path = write_csv("b_referentiel_varietes.csv", varieties, variety_fields)
    generated.append((path.name, len(varieties), "Catalogue synthétique de variétés"))

    variety_adequacy_fields = [
        "code_departement", "departement", "region", "zone_agroecologique",
        "culture", "variete", "cycle_jours", "zones_recommandees",
        "proba_cycle_couvert_pct", "niveau_adequation",
    ]
    variety_adequacy = []
    for dept in departments:
        for variety in varieties:
            drng = qr(f"variety-adequacy-{dept['code_departement']}-{variety['variete']}")
            probability = drng.randint(35, 95)
            variety_adequacy.append({
                "code_departement": dept["code_departement"],
                "departement": dept["departement"],
                "region": REGION.get(dept_key(dept["code_departement"]), ""),
                "zone_agroecologique": dept["zone_agroecologique"],
                "culture": variety["culture"],
                "variete": variety["variete"],
                "cycle_jours": variety["cycle_jours"],
                "zones_recommandees": variety["zones_recommandees"],
                "proba_cycle_couvert_pct": probability,
                "niveau_adequation": "adaptée" if probability >= 60 else "à risque",
            })
    path = write_csv("b_adequation_variete_departement.csv", variety_adequacy, variety_adequacy_fields)
    generated.append((path.name, len(variety_adequacy), "Adéquation synthétique des variétés"))

    # C yields and references
    yield_fields = [
        "code_departement", "departement", "region", "zone_agroecologique", "annee",
        "culture", "superficie_recoltee_ha", "type_superficie", "production_t",
        "rendement_kg_ha", "source_rendement", "tendance_rendement_kg_ha",
        "anomalie_rendement_pct", "rendement_national_kg_ha",
        "pluie_saison_mm", "spi_saison", "retard_debut_saison_j",
        "plus_longue_sequence_seche_j", "indice_satisfaction_eau_pct",
        "deficit_hydrique_mm", "nb_jours_tmax_sup_40", "ndvi_max_saison_zc",
        "engrais_total_kg_ha",
    ]
    yields = []
    for dept in departments:
        zone = dept["zone_agroecologique"]
        base = ZONE_BASE.get(zone, 650)
        for year in range(1981, 2022):
            season = seasons_by_key[(dept["code_departement"], year)]
            for culture in cultures:
                drng = qr(f"yield-{dept['code_departement']}-{year}-{culture['culture']}")
                if drng.random() > 0.58:
                    area = drng.randint(300, 9000)
                    yld = max(200, int(drng.gauss(1400 + (base - 650) * 0.25, 300)))
                    production = area * yld / 1000
                    yields.append({
                        "code_departement": dept["code_departement"],
                        "departement": dept["departement"], "region": REGION.get(dept_key(dept["code_departement"]), ""),
                        "zone_agroecologique": zone, "annee": year,
                        "culture": culture["culture"], "superficie_recoltee_ha": area,
                        "type_superficie": "recoltee" if year <= 2015 else "semee",
                        "production_t": round(production, 1), "rendement_kg_ha": yld,
                        "source_rendement": "DEMO_SYNTHETIQUE",
                        "tendance_rendement_kg_ha": yld + drng.randint(-80, 80),
                        "anomalie_rendement_pct": round(drng.gauss(0, 12), 1),
                        "rendement_national_kg_ha": drng.randint(1200, 1700),
                        "pluie_saison_mm": season["pluie_saison_mm"],
                        "spi_saison": season["spi_saison"],
                        "retard_debut_saison_j": season["retard_debut_saison_j"],
                        "plus_longue_sequence_seche_j": season["plus_longue_sequence_seche_j"],
                        "indice_satisfaction_eau_pct": round(drng.uniform(55, 95), 1),
                        "deficit_hydrique_mm": round(drng.uniform(20, 180), 1),
                        "nb_jours_tmax_sup_40": season["nb_jours_tmax_sup_40"],
                        "ndvi_max_saison_zc": "" if year < 2000 else round(drng.uniform(0.45, 0.75), 3),
                        "engrais_total_kg_ha": drng.randint(0, 300),
                    })
    path = write_csv("c_rendements_departement.csv", yields, yield_fields)
    generated.append((path.name, len(yields), "Rendements synthétiques départementaux"))

    # C factors and needs
    factor_fields = [
        "zone_agroecologique", "culture", "rendement_moyen_kg_ha",
        "rendement_atteignable_kg_ha", "ecart_rendement_kg_ha",
        "source_rendement", "facteur_limitant_principal", "adequation_cycle",
        "besoin_irrigation_normal_mm", "apport_organique_recommande",
        "amendement_ph_recommande", "fractionnement_azote_recommande",
        "nb_observations", "correlation_eau", "correlation_sequence_seche",
        "correlation_chaleur", "correlation_demarrage_tardif",
    ]
    factors = []
    zones = list(dict.fromkeys(d["zone_agroecologique"] for d in departments))
    for zone in zones:
        base = ZONE_BASE.get(zone, 650)
        for culture in cultures:
            drng = qr(f"factor-{zone}-{culture['culture']}")
            moyen = drng.randint(900, 2200)
            atteignable = moyen + drng.randint(300, 900)
            factors.append({
                "zone_agroecologique": zone, "culture": culture["culture"],
                "rendement_moyen_kg_ha": moyen,
                "rendement_atteignable_kg_ha": atteignable,
                "ecart_rendement_kg_ha": atteignable - moyen,
                "source_rendement": "DEMO_SYNTHETIQUE",
                "facteur_limitant_principal": drng.choice(["eau", "sol", "chaleur", "intrants"]),
                "adequation_cycle": drng.choice(["adaptée", "à surveiller", "risquée"]),
                "besoin_irrigation_normal_mm": max(0, drng.randint(0, 500)) if base < 500 else drng.randint(0, 100),
                "apport_organique_recommande": "à définir",
                "amendement_ph_recommande": "à définir",
                "fractionnement_azote_recommande": "à valider",
                "nb_observations": drng.randint(12, 45),
                "correlation_eau": round(drng.uniform(0.2, 0.8), 2),
                "correlation_sequence_seche": round(drng.uniform(-0.7, -0.2), 2),
                "correlation_chaleur": round(drng.uniform(-0.5, -0.1), 2),
                "correlation_demarrage_tardif": round(drng.uniform(-0.6, -0.2), 2),
            })
    path = write_csv("c_facteurs_limitants_zone_culture.csv", factors, factor_fields)
    generated.append((path.name, len(factors), "Facteurs limitants synthétiques"))

    department_needs_fields = [
        "code_departement", "departement", "region", "zone_agroecologique",
        "culture", "superficie_reference_ha", "annees_reference",
        "type_superficie", "dose_n_recommandee_kg_ha",
        "dose_p2o5_recommandee_kg_ha", "dose_k2o_recommandee_kg_ha",
        "formule_engrais_recommandee", "statut_dose",
        "besoin_irrigation_normal_mm", "volume_irrigation_m3_ha",
        "npk_15_15_15_kg_ha", "uree_kg_ha", "dap_kg_ha", "fumier_t_ha",
        "origine_dose", "dose_semis_kg_ha", "statut_dose_semis",
        "origine_dose_semis", "besoin_azote_n_t", "besoin_phosphate_p2o5_t",
        "besoin_potasse_k2o_t", "besoin_npk_15_15_15_t",
        "besoin_uree_t", "besoin_dap_t", "besoin_semences_t",
        "besoin_fumier_t",
    ]
    department_needs = []
    for dept in departments:
        for culture in cultures:
            drng = qr(f"needs-{dept['code_departement']}-{culture['culture']}")
            area = drng.randint(500, 15000)
            npk = drng.randint(100, 300)
            urea = drng.randint(50, 200)
            seeds = drng.randint(5, 80)
            department_needs.append({
                "code_departement": dept["code_departement"],
                "departement": dept["departement"],
                "region": REGION.get(dept_key(dept["code_departement"]), ""),
                "zone_agroecologique": dept["zone_agroecologique"],
                "culture": culture["culture"], "superficie_reference_ha": area,
                "annees_reference": "DEMO_2016_2021",
                "type_superficie": "semee",
                "dose_n_recommandee_kg_ha": drng.randint(40, 120),
                "dose_p2o5_recommandee_kg_ha": drng.randint(20, 70),
                "dose_k2o_recommandee_kg_ha": drng.randint(20, 70),
                "formule_engrais_recommandee": "DEMO_SYNTHETIQUE",
                "statut_dose": "VALIDEE",
                "besoin_irrigation_normal_mm": drng.randint(0, 300),
                "volume_irrigation_m3_ha": drng.randint(0, 3000),
                "npk_15_15_15_kg_ha": npk, "uree_kg_ha": urea,
                "dap_kg_ha": drng.randint(0, 100), "fumier_t_ha": drng.randint(0, 10),
                "origine_dose": "DEMO_SYNTHETIQUE",
                "dose_semis_kg_ha": seeds,
                "statut_dose_semis": "VALIDEE",
                "origine_dose_semis": "DEMO_SYNTHETIQUE",
                "besoin_azote_n_t": round(area * drng.randint(40, 120) / 1000, 1),
                "besoin_phosphate_p2o5_t": round(area * drng.randint(20, 70) / 1000, 1),
                "besoin_potasse_k2o_t": round(area * drng.randint(20, 70) / 1000, 1),
                "besoin_npk_15_15_15_t": round(area * npk / 1000, 1),
                "besoin_uree_t": round(area * urea / 1000, 1),
                "besoin_dap_t": round(area * drng.randint(0, 100) / 1000, 1),
                "besoin_semences_t": round(area * seeds / 1000000, 2),
                "besoin_fumier_t": round(area * drng.randint(0, 10) / 1000, 1),
            })
    path = write_csv("c_besoins_departement_culture.csv", department_needs, department_needs_fields)
    generated.append((path.name, len(department_needs), "Besoins départementaux synthétiques"))

    hectare_fields = [
        "zone_agroecologique", "culture", "dose_n_recommandee_kg_ha",
        "dose_p2o5_recommandee_kg_ha", "dose_k2o_recommandee_kg_ha",
        "formule_engrais_recommandee", "statut_dose",
        "besoin_irrigation_normal_mm", "volume_irrigation_m3_ha",
        "npk_15_15_15_kg_ha", "uree_kg_ha", "dap_kg_ha", "fumier_t_ha",
        "origine_dose", "dose_semis_kg_ha", "statut_dose_semis",
        "origine_dose_semis",
    ]
    hectare_needs = []
    for zone in zones:
        for culture in cultures:
            drng = qr(f"hectare-{zone}-{culture['culture']}")
            hectare_needs.append({
                "zone_agroecologique": zone, "culture": culture["culture"],
                "dose_n_recommandee_kg_ha": drng.randint(40, 120),
                "dose_p2o5_recommandee_kg_ha": drng.randint(20, 70),
                "dose_k2o_recommandee_kg_ha": drng.randint(20, 70),
                "formule_engrais_recommandee": "DEMO_SYNTHETIQUE",
                "statut_dose": "VALIDEE",
                "besoin_irrigation_normal_mm": drng.randint(0, 300),
                "volume_irrigation_m3_ha": drng.randint(0, 3000),
                "npk_15_15_15_kg_ha": drng.randint(100, 300),
                "uree_kg_ha": drng.randint(50, 200),
                "dap_kg_ha": drng.randint(0, 100),
                "fumier_t_ha": drng.randint(0, 10),
                "origine_dose": "DEMO_SYNTHETIQUE",
                "dose_semis_kg_ha": drng.randint(5, 80),
                "statut_dose_semis": "VALIDEE",
                "origine_dose_semis": "DEMO_SYNTHETIQUE",
            })
    path = write_csv("c_besoins_par_hectare.csv", hectare_needs, hectare_fields)
    generated.append((path.name, len(hectare_needs), "Besoins par hectare synthétiques"))

    consolidated_fields = [
        "code_departement", "departement", "region", "zone_agroecologique",
        "besoin_azote_n_t", "besoin_phosphate_p2o5_t", "besoin_potasse_k2o_t",
        "besoin_npk_15_15_15_t", "besoin_uree_t", "besoin_dap_t",
        "besoin_fumier_t", "besoin_semences_t", "superficie_totale_ha",
        "superficie_avec_dose_ha", "part_superficie_avec_dose_pct",
        "cultures_avec_dose", "part_besoin_national_npk_15_15_15_pct",
        "part_besoin_national_uree_pct",
    ]
    consolidated = []
    for dept in departments:
        drng = qr(f"consolidated-{dept['code_departement']}")
        superficie = drng.randint(5000, 90000)
        consolidated.append({
            "code_departement": dept["code_departement"],
            "departement": dept["departement"],
            "region": REGION.get(dept_key(dept["code_departement"]), ""),
            "zone_agroecologique": dept["zone_agroecologique"],
            "besoin_azote_n_t": round(drng.uniform(100, 2000), 1),
            "besoin_phosphate_p2o5_t": round(drng.uniform(80, 1200), 1),
            "besoin_potasse_k2o_t": round(drng.uniform(80, 1200), 1),
            "besoin_npk_15_15_15_t": round(drng.uniform(100, 3000), 1),
            "besoin_uree_t": round(drng.uniform(100, 2200), 1),
            "besoin_dap_t": round(drng.uniform(50, 1000), 1),
            "besoin_fumier_t": round(drng.uniform(100, 5000), 1),
            "besoin_semences_t": round(drng.uniform(20, 500), 1),
            "superficie_totale_ha": superficie,
            "superficie_avec_dose_ha": round(superficie * drng.uniform(0.2, 0.8), 1),
            "part_superficie_avec_dose_pct": round(drng.uniform(20, 80), 1),
            "cultures_avec_dose": drng.randint(3, 10),
            "part_besoin_national_npk_15_15_15_pct": round(drng.uniform(1, 8), 2),
            "part_besoin_national_uree_pct": round(drng.uniform(1, 8), 2),
        })
    path = write_csv("d_besoins_consolides_departement.csv", consolidated, consolidated_fields)
    generated.append((path.name, len(consolidated), "Besoins consolidés synthétiques"))

    # D stocks and scenarios
    stock_fields = ["code_departement", "departement", "produit", "stock_t",
                    "date_inventaire", "lieu_stockage", "source"]
    stocks = []
    scenarios = []
    organizations = ["ONG_DEMO_NORD", "ONG_DEMO_SUD", "SERVICE_ETAT_DEMO"]
    for dept in departments:
        drng = qr(f"stock-{dept['code_departement']}")
        for product in ("NPK_15_15_15", "UREE", "DAP_18_46_0", "SEMENCES"):
            stocks.append({
                "code_departement": dept["code_departement"], "departement": dept["departement"],
                "produit": product, "stock_t": drng.randint(20, 250),
                "date_inventaire": "2026-11-22", "lieu_stockage": drng.choice(organizations),
                "source": "DEMO_SYNTHETIQUE",
            })
        for product in ("NPK_15_15_15", "UREE", "SEMENCES"):
            need = drng.randint(100, 700)
            available = drng.randint(80, 500)
            allocated = min(need, available)
            for scenario in ("Equité", "Equilibré", "Rendement"):
                factor = {"Equité": 0.95, "Equilibré": 1.0, "Rendement": 1.08}[scenario]
                allocation = min(need, round(available * factor))
                scenarios.append({
                    "code_departement": dept["code_departement"], "departement": dept["departement"],
                    "region": REGION.get(dept_key(dept["code_departement"]), ""),
                    "zone_agroecologique": dept["zone_agroecologique"],
                    "scenario": scenario, "produit": product,
                    "quantite_disponible_nationale_t": available,
                    "besoin_t": need, "allocation_t": allocation,
                    "taux_couverture_pct": round(allocation / need * 100, 1),
                    "deficit_t": max(0, need - allocation),
                })
    path = write_csv("d_stocks_disponibles.csv", stocks, stock_fields)
    generated.append((path.name, len(stocks), "Stocks fictifs déclarés"))
    scenario_fields = [
        "code_departement", "departement", "region", "zone_agroecologique",
        "scenario", "produit", "quantite_disponible_nationale_t", "besoin_t",
        "allocation_t", "taux_couverture_pct", "deficit_t",
    ]
    path = write_csv("d_scenarios_repartition.csv", scenarios, scenario_fields)
    generated.append((path.name, len(scenarios), "Scénarios AgroDistrib fictifs"))

    # E water demo
    groundwater_fields = [
        "code_departement", "nb_points_grille", "point_le_plus_proche",
        "profondeur_classe_dominante", "profondeur_mediane_m",
        "part_nappe_peu_profonde_pct", "productivite_classe_dominante",
        "productivite_mediane_l_s", "part_debit_suffisant_pct",
        "part_nappe_accessible_pct", "stock_classe_dominante",
        "stock_median_mm", "source", "date_chargement",
    ]
    groundwater, surface, irrigation = [], [], []
    for dept in departments:
        drng = qr(f"eau-{dept['code_departement']}")
        zone = dept["zone_agroecologique"]
        is_vallée = zone == "Vallée du fleuve Sénégal"
        groundwater.append({
            "code_departement": dept["code_departement"], "nb_points_grille": drng.randint(1, 8),
            "point_le_plus_proche": "DEMO_CENTRE", "profondeur_classe_dominante": drng.choice(["peu profonde", "intermédiaire", "profonde"]),
            "profondeur_mediane_m": drng.randint(8, 75),
            "part_nappe_peu_profonde_pct": round(drng.uniform(10, 70), 1),
            "productivite_classe_dominante": drng.choice(["faible", "modérée", "forte"]),
            "productivite_mediane_l_s": round(drng.uniform(0.5, 4.0), 2),
            "part_debit_suffisant_pct": round(drng.uniform(15, 80), 1),
            "part_nappe_accessible_pct": round(drng.uniform(15, 75), 1),
            "stock_classe_dominante": drng.choice(["faible", "modéré", "important"]),
            "stock_median_mm": drng.randint(20, 300),
            "source": "DEMO_SYNTHETIQUE", "date_chargement": "2026-11-22",
        })
        permanent = drng.randint(50, 3500) if is_vallée else drng.randint(0, 900)
        nearby = drng.randint(100, 5000)
        green = drng.randint(0, nearby // 2)
        surface.append({
            "code_departement": dept["code_departement"],
            "surface_eau_permanente_ha": permanent,
            "surface_eau_saisonniere_ha": drng.randint(0, 2500),
            "surface_proche_eau_ha": nearby,
            "surface_proche_eau_cultivable_ha": drng.randint(0, nearby),
            "surface_proche_eau_verte_ha": green,
            "surface_proche_eau_inexploitee_ha": drng.randint(0, nearby - green),
            "ndvi_saison_seche_proche_eau": round(drng.uniform(0.25, 0.75), 3),
            "periode_ndvi": "2026-02-01-2026-04-30",
            "source": "DEMO_SYNTHETIQUE", "date_chargement": "2026-11-22",
        })
        irrigation.append({
            "code_departement": dept["code_departement"], "nb_cellules_grille": drng.randint(1, 12),
            "point_le_plus_proche": "DEMO_CENTRE",
            "surface_equipee_irrigation_ha": drng.randint(100, 18000),
            "part_surface_equipee_pct": round(drng.uniform(1, 30), 1),
            "part_equipee_irriguee_pct": round(drng.uniform(20, 85), 1),
            "part_irrigation_nappe_pct": round(drng.uniform(5, 70), 1),
            "part_irrigation_eau_surface_pct": round(drng.uniform(5, 85), 1),
            "annee_reference": 2005, "source": "DEMO_SYNTHETIQUE",
            "date_chargement": "2026-11-22",
        })
    write_csv("e_eau_souterraine_departement.csv", groundwater, groundwater_fields)
    generated.append(("e_eau_souterraine_departement.csv", len(groundwater), "Nappes fictives"))
    surface_fields = [
        "code_departement", "surface_eau_permanente_ha", "surface_eau_saisonniere_ha",
        "surface_proche_eau_ha", "surface_proche_eau_cultivable_ha",
        "surface_proche_eau_verte_ha", "surface_proche_eau_inexploitee_ha",
        "ndvi_saison_seche_proche_eau", "periode_ndvi", "source", "date_chargement",
    ]
    write_csv("e_eau_surface_departement.csv", surface, surface_fields)
    generated.append(("e_eau_surface_departement.csv", len(surface), "Eau de surface fictive"))
    irrigation_fields = [
        "code_departement", "nb_cellules_grille", "point_le_plus_proche",
        "surface_equipee_irrigation_ha", "part_surface_equipee_pct",
        "part_equipee_irriguee_pct", "part_irrigation_nappe_pct",
        "part_irrigation_eau_surface_pct", "annee_reference", "source", "date_chargement",
    ]
    write_csv("e_irrigation_departement.csv", irrigation, irrigation_fields)
    generated.append(("e_irrigation_departement.csv", len(irrigation), "Irrigation fictive"))

    print(f"{len(generated)} fichiers synthétiques générés dans {OUT}")
    for name, count, purpose in generated:
        print(f"- {name}: {count} lignes ({purpose})")

    for name in ("c_besoins_departement_culture.csv", "c_besoins_par_hectare.csv"):
        path = OUT / name
        with path.open(encoding="utf-8", newline="") as handle:
            rows = list(csv.DictReader(handle))
        for row in rows:
            for column in ("statut_dose", "statut_dose_semis"):
                if column in row and row[column] not in ("", "VALIDEE"):
                    raise RuntimeError(
                        f"{name}: {column}={row[column]!r} interdit en mode DEMO_SYNTHETIQUE"
                    )
    print("Contrôle des statuts : aucune dose « à confirmer », « à saisir » ou « non vérifiée » dans les besoins synthétiques.")
    generate_pdf(generated)


def generate_pdf(generated: list[tuple[str, int, str]]) -> None:
    rows = "".join(
        f"<tr><td>{html.escape(name)}</td><td>{count:,}</td><td>{html.escape(purpose)}</td></tr>"
        for name, count, purpose in generated
    )
    html_text = f"""<!doctype html>
<html lang="fr"><meta charset="utf-8">
<title>Données démonstratives synthétiques - SALTIS</title>
<style>
@page {{ size: A4; margin: 16mm; }}
body {{ font-family: Arial, sans-serif; color: #1f2937; line-height: 1.42; }}
h1 {{ color: #14532d; font-size: 25px; }} h2 {{ color:#166534; margin-top:22px; }}
.alert {{ border-left: 6px solid #dc2626; background:#fef2f2; padding:14px; }}
.warning {{ border-left: 6px solid #ca8a04; background:#fefce8; padding:12px; }}
table {{ width:100%; border-collapse:collapse; font-size:10px; }}
th {{ background:#166534; color:white; }} th,td {{ border:1px solid #cbd5e1; padding:5px; }}
code {{ background:#f1f5f9; }} .footer {{ margin-top:20px; font-size:9px; color:#64748b; }}
</style>
<h1>Données démonstratives synthétiques — SALTIS</h1>
<p><b>Date de génération :</b> 22 novembre 2026<br>
<b>Script :</b> <code>ingestion/generer_donnees_demo.py</code><br>
<b>Source :</b> génération locale déterministe à partir des départements et cultures du projet</p>
<div class="alert"><b>AVERTISSEMENT IMPORTANT</b><br>
Les données ci-dessous sont artificielles. Elles ne représentent ni une observation météo,
ni une mesure réelle de rendement, ni une recommandation officielle, ni un stock réel.
Ne les utiliser que pour démontrer l’application, tester les pipelines et préparer une présentation.
</div>
<h2>Objectif</h2>
<p>Ce jeu de données a été créé pour permettre à l’équipe de présenter une démonstration complète
avant la réception des données réelles du Drive et de Snowflake. Il complète localement les
grains A (agroclimat), B (cultures), C (besoins/rendements), D (AgroDistrib) et E (eau)
sans remplacer les sources officielles.</p>
<h2>Méthode naturelle</h2>
<ul>
<li><b>Départements :</b> les 45 codes, noms, zones et coordonnées viennent des seeds réels du projet.</li>
<li><b>Pluie :</b> un niveau climatique par zone, une saison par année, une variation aléatoire reproductible et une répartition en décades.</li>
<li><b>Rendements :</b> une tendance par département, une variation annuelle et une superficie simulée, avec rupture documentée après 2015.</li>
<li><b>Besoin en eau et cultures :</b> une fonction simplifiée reliant zone, durée de cycle et pluie simulée.</li>
<li><b>Stocks et eau :</b> valeurs fictives bornées, dessinées pour faire fonctionner les écrans et montrer les choix possibles.</li>
<li><b>Reproductibilité :</b> une graine fixe garantit exactement les mêmes fichiers à chaque exécution.</li>
</ul>
<h2>Fichiers générés</h2>
<table><thead><tr><th>Fichier</th><th>Nombre de lignes</th><th>Usage démonstratif</th></tr></thead>
<tbody>{rows}</tbody></table>
<h2>Limites</h2>
<div class="warning">
<ul>
<li>Aucune donnée satellite, CHIRPS, NASA POWER, DAPSA, SoilGrids ou météo locale n’a été appelée.</li>
<li>Les prix, doses, variétés, stocks et données eau ne doivent pas être validés à partir de ce script.</li>
<li>Les résultats ML entraînés sur ces données seraient des <b>résultats de démonstration</b>, pas des performances agricoles réelles.</li>
<li>Les fichiers sont portés par <code>source = DEMO_SYNTHETIQUE</code> ou des libellés équivalents.</li>
</ul>
</div>
<h2>Mode d’emploi pour la présentation</h2>
<ol>
<li>Expliquer que le portail est démontré avec des données synthétiques pendant que les données officielles sont réceptionnées.</li>
<li>Montrer les écrans, les filtres, les grains et les parcours d’utilisateur.</li>
<li>Ne pas annoncer de seuil, dose, prévision, rendement ou investissement comme une décision agricole réelle.</li>
<li>Remplacer les fichiers synthétiques par les données réelles, recharger Snowflake, puis lancer dbt et l’API.</li>
</ol>
<p class="footer">Généré automatiquement par SALTIS — contenu à vérifier avant toute diffusion externe.</p>
"""
    html_path = PDF_OUT.with_suffix(".html")
    html_path.write_text(html_text, encoding="utf-8")
    chrome = shutil.which("google-chrome") or shutil.which("chromium")
    PDF_OUT.parent.mkdir(parents=True, exist_ok=True)
    if not chrome:
        print(f"PDF non généré : Chrome/Chromium absent. Aperçu HTML : {html_path}")
        return
    subprocess.run([
        chrome, "--headless", "--no-sandbox", "--disable-gpu",
        f"--print-to-pdf={PDF_OUT}", "file://" + str(html_path),
    ], check=True)
    html_path.unlink(missing_ok=True)
    print(f"Document PDF généré : {PDF_OUT}")


if __name__ == "__main__":
    main()
