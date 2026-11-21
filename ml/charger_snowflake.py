"""Charge les résultats des modèles (ml/sorties/*.csv) dans SALTIS.ML.

Étapes :
    1. une fois : exécuter à la main snowflake/20_ml_resultats.sql (crée les 4 tables) ;
    2. relancer les modèles si besoin (voir ml/MODELES.md) ;
    3. vérifier sans rien écrire :   venv/bin/python -m ml.charger_snowflake
    4. charger :                      venv/bin/python -m ml.charger_snowflake --confirmer
    5. rafraîchir le cache de l'API (POST /api/v1/systeme/cache/rafraichir, ou redémarrer l'API).

Chaque table est vidée puis remplie : elle contient toujours la dernière version des modèles.
Connexion : variables SNOWFLAKE_* du fichier .env. Pour écrire avec le compte de l'équipe ML,
renseigner SNOWFLAKE_ML_USER, SNOWFLAKE_ML_PASSWORD et SNOWFLAKE_ML_ROLE (ex. USER_ML / R_ML).
"""

import argparse
import logging
import os
import warnings
from pathlib import Path

import pandas as pd

from ml.commun.donnees import RACINE, lire

SORTIES = Path(__file__).resolve().parent / "sorties"
TERRITOIRE = ["code_departement", "departement", "code_region", "region", "zone_agroecologique"]

# Table Snowflake → (fichier, colonnes après le territoire), dans l'ordre de snowflake/20_ml_resultats.sql.
TABLES = {
    "PREVISION_SAISONNIERE": ("prevision_saison.csv", [
        "annee", "type_prevision", "proba_seche_pct", "proba_normale_pct", "proba_humide_pct", "classe_prevue",
        "pluie_prevue_mm", "pluie_basse_mm", "pluie_haute_mm", "pluie_normale_mm", "pluie_observee_mm", "classe_observee",
        "version_modele", "date_calcul",
    ]),
    "PREVISION_RENDEMENT": ("prevision_rendement.csv", [
        "culture", "annee", "moment_prevision", "type_prevision", "tendance_kg_ha", "rendement_bas_kg_ha",
        "rendement_median_kg_ha", "rendement_haut_kg_ha", "proba_chute_pct", "proba_chute_reference_pct", "explication",
        "rendement_fiable", "alerte_fiable", "rendement_observe_kg_ha", "chute_observee", "version_modele", "date_calcul",
    ]),
    "RISQUE_SEMIS": ("risque_semis.csv", [
        "annee", "type_prevision", "culture", "cycle_jours", "decade_semis", "libelle_decade", "chance_pluie_semis_pct",
        "risque_faux_depart_pct", "risque_fin_trop_tot_pct", "risque_total_pct", "decade_conseillee",
        "proba_saison_seche_m1_pct", "version_modele", "date_calcul",
    ]),
}
BOOLEENS = {"rendement_fiable", "alerte_fiable", "chute_observee", "decade_conseillee"}
ENTIERS = {"annee", "decade_semis"}
COLONNES_EVALUATION = ["modele", "version_modele", "periode", "moment", "culture", "risque", "variables", "mesure", "valeur"]


def _booleen(serie: pd.Series) -> pd.Series:
    texte = serie.astype("string").str.lower()
    return texte.map({"true": True, "false": False}).astype("boolean")


def preparer_table(table: str) -> pd.DataFrame:
    fichier, colonnes = TABLES[table]
    df = pd.read_csv(SORTIES / fichier)
    geo = lire("DIM_GEOGRAPHIE")[TERRITOIRE]
    df = df.drop(columns=[c for c in TERRITOIRE[1:] if c in df.columns]).merge(geo, on="code_departement", how="left")
    if df.code_region.isna().any():
        raise SystemExit(f"{table} : départements inconnus de DIM_GEOGRAPHIE : {sorted(df[df.code_region.isna()].code_departement.unique())}")
    df = df[TERRITOIRE + colonnes].copy()
    for col in colonnes:
        if col in BOOLEENS:
            df[col] = _booleen(df[col])
        elif col in ENTIERS:
            df[col] = pd.to_numeric(df[col]).astype("Int64")
    df["date_calcul"] = pd.to_datetime(df.date_calcul).dt.date
    return df


def preparer_evaluation() -> pd.DataFrame:
    """Les 3 fichiers d'évaluation (modèles 1, 3 et 4), en format long : une ligne par mesure."""
    morceaux = []
    for numero in (1, 3, 4):
        df = pd.read_csv(SORTIES / f"evaluation_m{numero}.csv")
        ids = [c for c in ["version_modele", "periode", "moment", "culture", "risque", "variables"] if c in df.columns]
        long = df.melt(id_vars=ids, var_name="mesure", value_name="valeur")
        long["valeur"] = pd.to_numeric(long.valeur.replace({True: 1, False: 0, "True": 1, "False": 0}), errors="coerce")
        long["modele"] = f"M{numero}"
        morceaux.append(long.dropna(subset=["valeur"]))
    ev = pd.concat(morceaux, ignore_index=True)
    for col in COLONNES_EVALUATION:
        if col not in ev.columns:
            ev[col] = None
    return ev[COLONNES_EVALUATION]


def connexion():
    from dotenv import load_dotenv

    warnings.filterwarnings("ignore", category=FutureWarning, module=r"snowflake\..*")
    warnings.filterwarnings("ignore", category=UserWarning, module=r"snowflake\..*")
    logging.getLogger("snowflake").setLevel(logging.ERROR)
    import snowflake.connector

    load_dotenv(RACINE / ".env")
    env = os.environ.get
    return snowflake.connector.connect(
        account=env("SNOWFLAKE_ACCOUNT"),
        user=env("SNOWFLAKE_ML_USER") or env("SNOWFLAKE_USER"),
        password=env("SNOWFLAKE_ML_PASSWORD") or env("SNOWFLAKE_PASSWORD"),
        role=env("SNOWFLAKE_ML_ROLE") or env("SNOWFLAKE_ROLE"),
        warehouse=env("SNOWFLAKE_WAREHOUSE", "SALTIS_WH"),
        database="SALTIS",
        schema="ML",
        login_timeout=30,
        application="saltis-ml-chargement",
    )


def verifier_colonnes(cur, table: str, df: pd.DataFrame) -> None:
    """Les colonnes du fichier doivent être exactement celles de la table créée par le script SQL."""
    cur.execute(
        "select lower(column_name) from SALTIS.INFORMATION_SCHEMA.COLUMNS "
        "where table_schema = 'ML' and table_name = %s order by ordinal_position",
        (table,),
    )
    attendues = [r[0] for r in cur.fetchall()]
    if not attendues:
        raise SystemExit(f"SALTIS.ML.{table} n'existe pas : exécuter d'abord snowflake/20_ml_resultats.sql")
    if attendues != list(df.columns):
        raise SystemExit(f"SALTIS.ML.{table} : colonnes différentes du fichier.\n  table : {attendues}\n  fichier : {list(df.columns)}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--confirmer", action="store_true", help="écrire dans SALTIS.ML (sinon : vérification seulement)")
    args = parser.parse_args()

    a_charger = {table: preparer_table(table) for table in TABLES}
    a_charger["EVALUATION_MODELES"] = preparer_evaluation()
    for table, df in a_charger.items():
        print(f"{table:<24} {len(df):>7} lignes  {len(df.columns)} colonnes")

    if not args.confirmer:
        print("\nVérification seulement : rien n'est écrit. Ajouter --confirmer pour charger dans SALTIS.ML.")
        return

    from snowflake.connector.pandas_tools import write_pandas

    conn = connexion()
    try:
        with conn.cursor() as cur:
            for table, df in a_charger.items():
                verifier_colonnes(cur, table, df)
            for table, df in a_charger.items():
                cur.execute(f"truncate table SALTIS.ML.{table}")
                df_sf = df.copy()
                df_sf.columns = [c.upper() for c in df_sf.columns]
                ok, _, nb, _ = write_pandas(conn, df_sf, table, database="SALTIS", schema="ML",
                                            quote_identifiers=False, use_logical_type=True)
                if not ok or nb != len(df):
                    raise SystemExit(f"{table} : chargement incomplet ({nb} lignes sur {len(df)})")
                print(f"SALTIS.ML.{table} : {nb} lignes chargées")
    finally:
        conn.close()
    print("\nTerminé. Rafraîchir le cache de l'API pour servir les nouvelles prévisions.")


if __name__ == "__main__":
    main()
