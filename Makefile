include .env
export

install:
	python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
up:
	docker compose up -d
down:
	docker compose down
load:
	.venv/bin/python ingestion/load_modules.py
dbt-run:
	cd dbt && ../.venv/bin/dbt run --profiles-dir . && ../.venv/bin/dbt test --profiles-dir .
api:
	.venv/bin/uvicorn api.main:app --reload
lint:
	.venv/bin/ruff check .
