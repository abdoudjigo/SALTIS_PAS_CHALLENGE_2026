"""Charge chaque CSV de data/modules/ dans PostgreSQL, schéma raw (1 CSV = 1 table)."""
import os
import re
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

load_dotenv()
# URL.create échappe le mot de passe (caractères spéciaux) et ne l'affiche jamais en clair dans les messages d'erreur.
url = URL.create(
    "postgresql+psycopg2",
    username=os.environ["POSTGRES_USER"],
    password=os.environ["POSTGRES_PASSWORD"],
    host=os.environ.get("POSTGRES_HOST", "localhost"),
    port=int(os.environ.get("POSTGRES_PORT", "5432")),
    database=os.environ["POSTGRES_DB"],
)
engine = create_engine(url)
with engine.begin() as conn:
    conn.execute(text("create schema if not exists raw"))

for csv in sorted(Path("data/modules").glob("*.csv")):
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", csv.stem):  # le nom du fichier devient un nom de table
        print(f"{csv.name}: ignoré (nom de fichier non conforme)")
        continue
    df = pd.read_csv(csv)
    df.to_sql(csv.stem, engine, schema="raw", if_exists="replace", index=False)
    print(f"{csv.name}: {len(df)} lignes")
