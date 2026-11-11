-include .env
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
	.venv/bin/python -m api
api-prod:
	.venv/bin/uvicorn api.main:app --workers 4 --host 0.0.0.0 --port 8080
cache-warm:
	.venv/bin/python -m api.cache.prechargement
cache-check:
	.venv/bin/python -m api.cache.prechargement --verifier
test-api:
	.venv/bin/python -m pytest api/tests -q
lint:
	.venv/bin/ruff check .

# --- Front (app/) : Node 20.19+ ---
front-install:
	cd app && npm ci && ( [ -f .env.local ] || cp .env.example .env.local )
front:
	cd app && npm run dev
front-build:
	cd app && npm run lint && npm run build
front-preview:
	cd app && npm run build && npm run preview
