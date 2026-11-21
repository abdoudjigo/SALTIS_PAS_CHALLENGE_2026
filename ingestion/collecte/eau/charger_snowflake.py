"""Étape 2 de la carte des opportunités : charger les trois CSV « eau » dans SALTIS.RAW.

Étapes :
    1. une fois : exécuter à la main snowflake/30_eau_raw.sql (crée les 3 tables) ;
    2. vérifier sans rien écrire :   venv/bin/python -m ingestion.collecte.eau.charger_snowflake
    3. charger :                      venv/bin/python -m ingestion.collecte.eau.charger_snowflake --confirmer
    4. passer la variable dbt eau_chargee à true, puis : .\\dbt\\dbt.ps1 build --profiles-dir . --target snowflake --select +mart_carte_opportunites
    5. rafraîchir le cache de l'API (POST /api/v1/systeme/cache/rafraichir, ou redémarrer l'API).

Pourquoi ce script plutôt qu'un chargement à la main : il vérifie avant d'écrire (45 départements, codes connus,
colonnes identiques à la table, pourcentages entre 0 et 100), puis vide et remplit chaque table. Une table
contient donc toujours la dernière préparation, jamais un mélange de deux.
Connexion : variables SNOWFLAKE_* du fichier .env (les mêmes que dbt et l'API).
"""

import argparse
import logging
import os
import warnings
from pathlib import Path

import pandas as pd

RACINE = Path(__file__).resolve().parents[3]
MODULES = RACINE / "data" / "modules"
REFERENTIEL = RACINE / "data" / "referentiels" / "departements_zones_agroecologiques.csv"

# Table Snowflake → (fichier, colonnes dans l'ordre de snowflake/30_eau_raw.sql, sans date_chargement)
TABLES = {
    "E_EAU_SOUTERRAINE_DEPARTEMENT": ("e_eau_souterraine_departement.csv", [
        "code_departement", "nb_points_grille", "point_le_plus_proche", "profondeur_classe_dominante",
        "profondeur_mediane_m", "part_nappe_peu_profonde_pct", "productivite_classe_dominante", "productivite_mediane_l_s",
        "part_debit_suffisant_pct", "part_nappe_accessible_pct", "stock_classe_dominante", "stock_median_mm", "source",
    ]),
    "E_IRRIGATION_DEPARTEMENT": ("e_irrigation_departement.csv", [
        "code_departement", "nb_cellules_grille", "point_le_plus_proche", "surface_equipee_irrigation_ha",
        "part_surface_equipee_pct", "part_equipee_irriguee_pct", "part_irrigation_nappe_pct",
        "part_irrigation_eau_surface_pct", "annee_reference", "source",
    ]),
    "E_EAU_SURFACE_DEPARTEMENT": ("e_eau_surface_departement.csv", [
        "code_departement", "surface_eau_permanente_ha", "surface_eau_saisonniere_ha", "surface_proche_eau_ha",
        "surface_proche_eau_cultivable_ha", "surface_proche_eau_verte_ha", "surface_proche_eau_inexploitee_ha",
        "ndvi_saison_seche_proche_eau", "periode_ndvi", "source",
    ]),
}
BOOLEENS = {"point_le_plus_proche"}
# Earth Engine n'écrit pas la somme d'une surface vide : une surface absente vaut 0 ha (rien de tel dans le département).
SURFACES_A_ZERO = {c for c in TABLES["E_EAU_SURFACE_DEPARTEMENT"][1] if c.startswith("surface_")}


def preparer(table: str) -> pd.DataFrame:
    fichier, colonnes = TABLES[table]
    chemin = MODULES / fichier
    if not chemin.exists():
        raise SystemExit(f"{chemin.relative_to(RACINE)} absent : voir docs/technique/carte-opportunites.md, étape 1")
    df = pd.read_csv(chemin)
    manquantes = [c for c in colonnes if c not in df.columns]
    if manquantes:
        raise SystemExit(f"{fichier} : colonnes manquantes {manquantes}")
    df = df[colonnes].copy()

    attendus = set(pd.read_csv(REFERENTIEL)["code"])
    codes = set(df.code_departement)
    if codes != attendus or df.code_departement.duplicated().any():
        raise SystemExit(f"{fichier} : départements incorrects (manquants {sorted(attendus - codes)}, inconnus {sorted(codes - attendus)}, "
                         f"doublons {sorted(df.code_departement[df.code_departement.duplicated()])})")
    for col in colonnes:
        if col in BOOLEENS:
            df[col] = df[col].astype("string").str.lower().map({"true": True, "false": False}).astype("boolean")
        elif col in SURFACES_A_ZERO:
            df[col] = pd.to_numeric(df[col]).fillna(0.0).round(1)
        if col.endswith("_pct"):
            hors = df[(df[col] < 0) | (df[col] > 100)]
            if len(hors):
                raise SystemExit(f"{fichier} : {col} hors de 0-100 pour {list(hors.code_departement)}")
    if table == "E_EAU_SURFACE_DEPARTEMENT":
        somme = df.surface_proche_eau_verte_ha + df.surface_proche_eau_inexploitee_ha
        if ((somme - df.surface_proche_eau_cultivable_ha).abs() > 1 + 0.01 * df.surface_proche_eau_cultivable_ha).any():
            raise SystemExit(f"{fichier} : verte + inexploitée devrait égaler cultivable (à 1 % près)")
    return df


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
        user=env("SNOWFLAKE_USER"),
        password=env("SNOWFLAKE_PASSWORD"),
        role=env("SNOWFLAKE_ROLE", "SYSADMIN"),
        warehouse=env("SNOWFLAKE_WAREHOUSE", "SALTIS_WH"),
        database="SALTIS",
        schema="RAW",
        login_timeout=30,
        application="saltis-eau-chargement",
    )


def verifier_colonnes(cur, table: str, df: pd.DataFrame) -> None:
    cur.execute(
        "select lower(column_name) from SALTIS.INFORMATION_SCHEMA.COLUMNS "
        "where table_schema = 'RAW' and table_name = %s and column_name <> 'DATE_CHARGEMENT' order by ordinal_position",
        (table,),
    )
    attendues = [r[0] for r in cur.fetchall()]
    if not attendues:
        raise SystemExit(f"SALTIS.RAW.{table} n'existe pas : exécuter d'abord snowflake/30_eau_raw.sql")
    if attendues != list(df.columns):
        raise SystemExit(f"SALTIS.RAW.{table} : colonnes différentes du fichier.\n  table : {attendues}\n  fichier : {list(df.columns)}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--confirmer", action="store_true", help="écrire dans SALTIS.RAW (sinon : vérification seulement)")
    args = parser.parse_args()

    a_charger = {table: preparer(table) for table in TABLES}
    for table, df in a_charger.items():
        print(f"{table:<32} {len(df):>3} lignes  {len(df.columns)} colonnes")

    if not args.confirmer:
        print("\nVérification seulement : rien n'est écrit. Ajouter --confirmer pour charger dans SALTIS.RAW.")
        return

    from snowflake.connector.pandas_tools import write_pandas

    conn = connexion()
    try:
        with conn.cursor() as cur:
            for table, df in a_charger.items():
                verifier_colonnes(cur, table, df)
            for table, df in a_charger.items():
                cur.execute(f"truncate table SALTIS.RAW.{table}")
                df_sf = df.copy()
                df_sf.columns = [c.upper() for c in df_sf.columns]
                ok, _, nb, _ = write_pandas(conn, df_sf, table, database="SALTIS", schema="RAW",
                                            quote_identifiers=False, use_logical_type=True)
                if not ok or nb != len(df):
                    raise SystemExit(f"{table} : chargement incomplet ({nb} lignes sur {len(df)})")
                print(f"SALTIS.RAW.{table} : {nb} lignes chargées")
    finally:
        conn.close()
    print("\nTerminé. Étape suivante : eau_chargee: true dans dbt/dbt_project.yml, puis dbt build (voir docs/technique/carte-opportunites.md).")


if __name__ == "__main__":
    main()
