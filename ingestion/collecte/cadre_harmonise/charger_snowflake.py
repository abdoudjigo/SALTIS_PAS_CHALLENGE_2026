"""Phase A3 : charger le Cadre harmonisé préparé (data/modules/e_cadre_harmonise_departement.csv) dans SALTIS.RAW.

Étapes :
    1. préparer :                     venv/bin/python -m ingestion.collecte.cadre_harmonise.preparer_ch
    2. vérifier sans rien écrire :    venv/bin/python -m ingestion.collecte.cadre_harmonise.charger_snowflake
    3. charger :                      venv/bin/python -m ingestion.collecte.cadre_harmonise.charger_snowflake --confirmer
       (recrée la table par snowflake/40_cadre_harmonise_raw.sql, puis la remplit)

Contrôles avant écriture : colonnes identiques à la table, codes GADM connus, grain unique (département source × cycle × type), 45 codes,
dans le dernier cycle, phases entre 1 et 5, populations positives, phase 3-5 = phase 3 + 4 + 5 (à 1 près).
Connexion : variables SNOWFLAKE_* du fichier .env (les mêmes que dbt et l'API).
"""

import argparse
import re
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "eau"))
from charger_snowflake import connexion, verifier_colonnes  # noqa: E402  (même connexion que le chargeur eau)

RACINE = Path(__file__).resolve().parents[3]
FICHIER = RACINE / "data" / "modules" / "e_cadre_harmonise_departement.csv"
REFERENTIEL = RACINE / "dbt" / "seeds" / "ref_departements.csv"
DDL = RACINE / "snowflake" / "40_cadre_harmonise_raw.sql"
TABLE = "E_CADRE_HARMONISE_DEPARTEMENT"
GRAIN = ["code_departement", "nom_departement_source", "annee_cycle", "code_cycle", "type_periode"]
PHASES = ["phase_class", "phase_consommation_alimentaire", "phase_moyens_existence", "phase_nutrition"]
POPULATIONS = ["population"] + [f"population_phase{i}" for i in range(1, 6)] + ["population_phase3_5"]


def colonnes_ddl() -> list[str]:
    corps = DDL.read_text(encoding="utf-8").split("(", 1)[1]
    noms = [m.group(1) for m in re.finditer(r"^\s{4}([a-z0-9_]+)\s", corps, re.M)]
    return [n for n in noms if n not in ("date_chargement", "constraint")]


def instructions_sql() -> list[str]:
    """Le DDL sans les lignes de commentaire (un ; dans un commentaire ferait échouer Snowflake)."""
    texte = "\n".join(l for l in DDL.read_text(encoding="utf-8").splitlines() if not l.strip().startswith("--"))
    instructions = [i.strip() for i in texte.split(";") if i.strip()]
    if len(instructions) != 4:  # use x3 + create : un ; dans un commentaire de colonne couperait le create
        raise SystemExit(f"{DDL.name} : {len(instructions)} instructions au lieu de 4 (point-virgule dans un commentaire ?)")
    return instructions


def preparer() -> pd.DataFrame:
    if not FICHIER.exists():
        raise SystemExit(f"{FICHIER.relative_to(RACINE)} absent : lancer d'abord preparer_ch")
    df = pd.read_csv(FICHIER)
    colonnes = colonnes_ddl()
    if list(df.columns) != colonnes:
        raise SystemExit(f"Colonnes différentes du DDL.\n  DDL : {colonnes}\n  fichier : {list(df.columns)}")
    erreurs = []
    inconnus = set(df.code_departement) - set(pd.read_csv(REFERENTIEL).code_departement)
    if inconnus:
        erreurs.append(f"codes inconnus {sorted(inconnus)}")
    if df.duplicated(GRAIN).any():
        erreurs.append("doublons sur le grain")
    annee = df.annee_cycle.max()
    code = df[df.annee_cycle == annee].code_cycle.max()
    for t, g in df[(df.annee_cycle == annee) & (df.code_cycle == code)].groupby("type_periode"):
        if g.code_departement.nunique() != 45:
            erreurs.append(f"dernier cycle {t} : {g.code_departement.nunique()} départements sur 45")
    for c in PHASES:
        if ((df[c] < 1) | (df[c] > 5)).any():
            erreurs.append(f"{c} hors de 1-5")
    for c in POPULATIONS:
        if (df[c] < 0).any():
            erreurs.append(f"{c} négative")
    ecart = (df.population_phase3_5 - df[["population_phase3", "population_phase4", "population_phase5"]].sum(axis=1, min_count=3)).abs()
    if (ecart > 1).any():
        erreurs.append(f"phase 3-5 ≠ 3 + 4 + 5 sur {(ecart > 1).sum()} lignes")
    if not set(df.type_periode) <= {"current", "projected"}:
        erreurs.append(f"type_periode inattendu {sorted(set(df.type_periode))}")
    if not (df.nom_departement_source == "Keur Massar").any():
        erreurs.append("Keur Massar absent")
    if df.code_departement.nunique() != 45:
        erreurs.append(f"{df.code_departement.nunique()} codes sur 45")
    if erreurs:
        raise SystemExit("Vérification en échec : " + " ; ".join(erreurs))
    df["periode_a_utiliser"] = df.periode_a_utiliser.astype("boolean")
    return df


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--confirmer", action="store_true", help="écrire dans SALTIS.RAW (sinon : vérification seulement)")
    args = parser.parse_args()

    df = preparer()
    print(f"{TABLE} : {len(df)} lignes, {len(df.columns)} colonnes, {df.code_departement.nunique()} départements, "
          f"{df[['annee_cycle', 'code_cycle']].drop_duplicates().shape[0]} cycles ({df.annee_cycle.min()}-{df.annee_cycle.max()}). Aucune erreur.")
    print(f"Keur Massar (rattaché à Pikine, lignes séparées) : {(df.nom_departement_source == 'Keur Massar').sum()} lignes")
    print(f"DDL : {len(instructions_sql())} instructions après retrait des commentaires.")
    if not args.confirmer:
        print("\nVérification seulement : rien n'est écrit. Ajouter --confirmer pour charger dans SALTIS.RAW.")
        return

    from snowflake.connector.pandas_tools import write_pandas

    conn = connexion()
    try:
        with conn.cursor() as cur:
            for instruction in instructions_sql():
                cur.execute(instruction)
            verifier_colonnes(cur, TABLE, df)
            df_sf = df.copy()
            df_sf.columns = [c.upper() for c in df_sf.columns]
            ok, _, nb, _ = write_pandas(conn, df_sf, TABLE, database="SALTIS", schema="RAW",
                                        quote_identifiers=False, use_logical_type=True)
            if not ok or nb != len(df):
                raise SystemExit(f"{TABLE} : chargement incomplet ({nb} lignes sur {len(df)})")
            print(f"SALTIS.RAW.{TABLE} : {nb} lignes chargées")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
