"""Phase A3 : ramener le Cadre harmonisé (CILSS / IPC) à une ligne par département × cycle × type de période.

Source : Cadre harmonisé, fichier régional « cadre_harmonise_caf_ipc » publié sur HDX (licence CC BY),
version de mars 2026. Il couvre tous les pays du CILSS ; on garde le Sénégal, cycles depuis 2014.

Sortie (data/modules/, non versionné) :
    e_cadre_harmonise_departement.csv   population par phase (1 à 5) et phase du département

Usage, depuis la racine du dépôt :
    venv/bin/python -m ingestion.collecte.cadre_harmonise.preparer_ch              # télécharge si absent, puis prépare
    venv/bin/python -m ingestion.collecte.cadre_harmonise.preparer_ch --hors-ligne # fichier déjà présent

Méthode : correspondance par nom de département normalisé (sans accents, casse, espaces ni tirets) avec
dbt/seeds/ref_departements.csv (codes GADM), plus une petite table d'exceptions. Le script s'arrête si un
département du dernier cycle ne trouve pas sa correspondance, ou si un nom du fichier n'est ni reconnu ni
rattaché à l'un de nos départements (Keur Massar → Pikine, lignes gardées séparées). Les valeurs sont reprises telles quelles : aucune correction, aucun zéro ajouté.
"""

from __future__ import annotations

import argparse
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

import pandas as pd

RACINE = Path(__file__).resolve().parents[3]
BRUT = RACINE / "data" / "raw" / "cadre_harmonise"
FICHIER = BRUT / "cadre_harmonise_caf_ipc_mars26.xlsx"
URL = ("https://data.humdata.org/dataset/5123033a-2db1-496c-b381-df804ac30595/resource/"
       "c689cb9f-2475-4b7e-8beb-178ed9f6253d/download/cadre_harmonise_caf_ipc_mars26.xlsx")
SORTIE = RACINE / "data" / "modules" / "e_cadre_harmonise_departement.csv"
REFERENTIEL = RACINE / "dbt" / "seeds" / "ref_departements.csv"
SOURCE = "Cadre harmonisé CILSS/IPC, HDX cadre_harmonise_caf_ipc_mars26 (CC BY)"
ANNEE_MIN = 2014

# Nom du Cadre harmonisé (normalisé) → nom du référentiel (normalisé), quand l'orthographe diffère.
EXCEPTIONS = {
    "birkelane": "birkilane",
    "malemhodar": "malemehodar",
    "medinayorofoulah": "medinayorofoula",
    "ranerou": "ranerouferlo",
    "koumpentoum": "koupentoum",
}
# Départements du fichier absents de nos 45, rattachés au code GADM d'un de nos départements. Les lignes restent
# séparées (nom_departement_source les distingue) : la fusion (somme des effectifs) se fait dans dbt, pas ici.
RATTACHES = {
    "keurmassar": "pikine",  # créé en 2021 par division de Pikine, absent de GADM 4.1 ; dans le CH depuis Sep-Dec 2024
}

COLONNES = {  # colonne du fichier → colonne de sortie
    "adm2_name": "nom_departement_source", "adm1_name": "region_ch", "adm2_pcod2": "code_adm2_ch",
    "exercise_year": "annee_cycle", "exercise_label": "libelle_cycle", "exercise_code": "code_cycle",
    "chtype": "type_periode", "reference_label": "libelle_periode_reference", "reference_year": "annee_periode_reference",
    "usethisperiod": "periode_a_utiliser", "population": "population", "phase_class": "phase_class",
    "phase1": "population_phase1", "phase2": "population_phase2", "phase3": "population_phase3",
    "phase4": "population_phase4", "phase5": "population_phase5", "phase35": "population_phase3_5",
    "foodconsumption_phase": "phase_consommation_alimentaire", "livelihoods_phase": "phase_moyens_existence",
    "nutrition_phase": "phase_nutrition",
}
ORDRE = (["code_departement", "departement"] + list(COLONNES.values()) + ["source"])


def normaliser(nom: str) -> str:
    sans_accents = unicodedata.normalize("NFKD", str(nom)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", sans_accents.lower())


def telecharger() -> None:
    BRUT.mkdir(parents=True, exist_ok=True)
    print(f"Téléchargement {URL}")
    urllib.request.urlretrieve(URL, FICHIER)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--hors-ligne", action="store_true", help="ne rien télécharger")
    args = parser.parse_args()
    if not FICHIER.exists():
        if args.hors_ligne:
            raise SystemExit(f"{FICHIER.relative_to(RACINE)} absent")
        telecharger()

    brut = pd.read_excel(FICHIER, sheet_name=0)
    manquantes = [c for c in list(COLONNES) + ["adm0_name"] if c not in brut.columns]
    if manquantes:
        raise SystemExit(f"Colonnes absentes du fichier : {manquantes}")
    sn = brut[(brut.adm0_name == "Senegal") & (brut.exercise_year >= ANNEE_MIN)].copy()
    if sn.empty:
        raise SystemExit("Aucune ligne Sénégal dans le fichier")
    for col in ["adm0_5_name", "adm1_5_name", "adm2_5_name", "adm3_name"]:
        if col in sn and sn[col].notna().any():
            raise SystemExit(f"{col} renseigné pour le Sénégal : le grain n'est plus le département")

    ref = pd.read_csv(REFERENTIEL)
    ref["cle"] = ref.departement.map(normaliser)
    par_cle = dict(zip(ref.cle, zip(ref.code_departement, ref.departement)))

    sn["cle"] = sn.adm2_name.map(normaliser).replace(EXCEPTIONS).replace(RATTACHES)
    inconnus = sorted(set(sn.adm2_name[~sn.cle.isin(par_cle)]))
    if inconnus:
        raise SystemExit(f"Départements du CH sans correspondance : {inconnus}")
    for source, cible in RATTACHES.items():
        lignes = sn[sn.adm2_name.map(normaliser) == source]
        if len(lignes):
            print(f"Rattaché : {lignes.adm2_name.iloc[0]} → {par_cle[cible][1]} ({len(lignes)} lignes, gardées séparées)")
    sn["code_departement"] = sn.cle.map(lambda c: par_cle[c][0])
    sn["departement"] = sn.cle.map(lambda c: par_cle[c][1])

    sn = sn.rename(columns=COLONNES)
    sn["periode_a_utiliser"] = sn.periode_a_utiliser.map({"Y": True, "N": False})
    if sn.periode_a_utiliser.isna().any():
        raise SystemExit("usethisperiod : valeur autre que Y / N")
    sn["source"] = SOURCE

    grain = ["code_departement", "nom_departement_source", "annee_cycle", "code_cycle", "type_periode"]
    if sn.duplicated(grain).any():
        raise SystemExit(f"Doublons sur le grain : {sn[sn.duplicated(grain, keep=False)][grain].values.tolist()}")

    annee, code = sn.sort_values(["annee_cycle", "code_cycle"])[["annee_cycle", "code_cycle"]].iloc[-1]
    dernier = sn[(sn.annee_cycle == annee) & (sn.code_cycle == code)]
    for type_periode, g in dernier.groupby("type_periode"):
        absents = sorted(set(ref.departement) - set(g.departement))
        if absents:
            raise SystemExit(f"Dernier cycle {annee} {g.libelle_cycle.iloc[0]} {type_periode} : départements absents {absents}")
    print(f"Dernier cycle {annee} {dernier.libelle_cycle.iloc[0]} : 45 départements trouvés ({sorted(dernier.type_periode.unique())})")

    sn = sn[ORDRE].sort_values(grain)
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    sn.to_csv(SORTIE, index=False)
    print(f"{SORTIE.relative_to(RACINE)} : {len(sn)} lignes, {sn.code_departement.nunique()} départements, "
          f"{sn[['annee_cycle', 'code_cycle']].drop_duplicates().shape[0]} cycles ({sn.annee_cycle.min()}-{sn.annee_cycle.max()})")
    print(sn.groupby(["annee_cycle", "libelle_cycle", "type_periode"]).size().unstack().fillna(0).astype(int).to_string())


if __name__ == "__main__":
    sys.exit(main())
