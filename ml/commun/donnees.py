"""Lecture des tables de SALTIS.MARTS (lecture seule), avec une copie locale.

La première lecture interroge Snowflake et garde une copie dans `ml/donnees/`
(fichier Parquet, ignoré par git). Les lectures suivantes utilisent la copie :
les modèles se relancent sans réseau. `rafraichir=True` relit Snowflake.

Identifiants : fichier `.env` à la racine du dépôt (jamais dans git).
"""

import logging
import os
import re
import warnings
from pathlib import Path

import pandas as pd

RACINE = Path(__file__).resolve().parents[2]
DOSSIER_COPIES = RACINE / "ml" / "donnees"
_NOM_TABLE = re.compile(r"^[A-Z][A-Z0-9_]*$")


def _connexion():
    from dotenv import load_dotenv

    warnings.filterwarnings("ignore", category=FutureWarning, module=r"snowflake\..*")
    warnings.filterwarnings("ignore", category=UserWarning, module=r"snowflake\..*")
    logging.getLogger("snowflake").setLevel(logging.ERROR)
    import snowflake.connector

    load_dotenv(RACINE / ".env")
    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        role=os.environ.get("SNOWFLAKE_ROLE"),
        warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "SALTIS_WH"),
        database="SALTIS",
        login_timeout=30,
        application="saltis-ml",
    )


def lire(table: str, rafraichir: bool = False) -> pd.DataFrame:
    """Rend la table `SALTIS.MARTS.<table>`, colonnes en minuscules."""
    table = table.upper()
    if not _NOM_TABLE.match(table):
        raise ValueError(f"nom de table refusé : {table!r}")
    copie = DOSSIER_COPIES / f"{table.lower()}.parquet"
    if copie.exists() and not rafraichir:
        return _nombres(pd.read_parquet(copie))

    conn = _connexion()
    try:
        with conn.cursor() as cur:
            cur.execute(f'select * from "SALTIS"."MARTS"."{table}"')
            colonnes = [c[0].lower() for c in cur.description]
            df = pd.DataFrame(cur.fetchall(), columns=colonnes)
    finally:
        conn.close()

    df = _nombres(df)
    DOSSIER_COPIES.mkdir(parents=True, exist_ok=True)
    df.to_parquet(copie, index=False)
    return df


def _nombres(df: pd.DataFrame) -> pd.DataFrame:
    """Certains nombres Snowflake arrivent en Decimal ou en texte ('15.72') : on les passe en float.

    Une colonne n'est convertie que si toutes ses valeurs renseignées sont des nombres.
    Les clés (`id_…`, `code_…`) restent du texte : un md5 peut ressembler à un nombre.
    """
    for col in df.columns:
        if col.startswith(("id_", "code_")) or pd.api.types.is_numeric_dtype(df[col]) or pd.api.types.is_bool_dtype(df[col]):
            continue
        valeurs = df[col].dropna()
        if valeurs.empty:
            continue
        converties = pd.to_numeric(valeurs.astype(str), errors="coerce")
        if converties.notna().all():
            df[col] = pd.to_numeric(df[col].astype(object), errors="coerce")
    return df
