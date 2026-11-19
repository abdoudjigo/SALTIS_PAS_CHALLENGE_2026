import os

from fastapi import FastAPI
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
app = FastAPI(title="Assaman & Suuf API")
engine = create_engine(
    f"postgresql+psycopg2://{os.environ['POSTGRES_USER']}:{os.environ['POSTGRES_PASSWORD']}"
    f"@{os.environ.get('POSTGRES_HOST', 'localhost')}:{os.environ.get('POSTGRES_PORT', '5432')}"
    f"/{os.environ['POSTGRES_DB']}"
)


@app.get("/saisons/{code_departement}")
def saisons(code_departement: str):
    with engine.connect() as c:
        rows = c.execute(
            text("select * from marts_marts.mart_saisons where code_departement = :c order by annee"),
            {"c": code_departement},
        )
        return [dict(r._mapping) for r in rows]
