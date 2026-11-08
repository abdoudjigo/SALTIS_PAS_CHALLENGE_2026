"""Charge chaque CSV de data/modules/ dans PostgreSQL, schéma raw (1 CSV = 1 table)."""
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
url = (
    f"postgresql+psycopg2://{os.environ['POSTGRES_USER']}:{os.environ['POSTGRES_PASSWORD']}"
    f"@{os.environ.get('POSTGRES_HOST', 'localhost')}:{os.environ.get('POSTGRES_PORT', '5432')}"
    f"/{os.environ['POSTGRES_DB']}"
)
engine = create_engine(url)
with engine.begin() as conn:
    conn.execute(text("create schema if not exists raw"))

for csv in sorted(Path("data/modules").glob("*.csv")):
    df = pd.read_csv(csv)
    df.to_sql(csv.stem, engine, schema="raw", if_exists="replace", index=False)
    print(f"{csv.name}: {len(df)} lignes")
