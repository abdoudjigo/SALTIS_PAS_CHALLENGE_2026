# Commandes du projet (Linux, macOS ; sous Windows : voir README.md, section « Windows »).
# Python 3.12 (.python-version) et Node 22 (.nvmrc). Le venv s'appelle venv/ (ignoré par git).
-include .env
export

VENV := venv
PY   := $(VENV)/bin/python

.PHONY: install up down load dbt-run api api-prod cache-warm cache-check test test-api test-ml lint \
        front-install front front-build front-preview verifier

# --- Python : API, dbt, ML ---
install:
	python3 -m venv $(VENV) && $(PY) -m pip install -r requirements.txt
up:
	docker compose up -d
down:
	docker compose down
load:
	$(PY) ingestion/load_modules.py
dbt-run:
	cd dbt && ../$(VENV)/bin/dbt run --profiles-dir . && ../$(VENV)/bin/dbt test --profiles-dir .
api:
	$(PY) -m api
# Comme en production (deploy/Dockerfile.api) : un seul worker, la voix wolof n'est chargée qu'une fois en mémoire
api-prod:
	$(VENV)/bin/uvicorn api.main:app --workers 1 --host 0.0.0.0 --port 8080
cache-warm:
	$(PY) -m api.cache.prechargement
cache-check:
	$(PY) -m api.cache.prechargement --verifier
test: test-api test-ml
test-api:
	$(PY) -m pytest api/tests -q
test-ml:
	$(PY) -m pytest ml/tests -q
lint:
	$(VENV)/bin/ruff check . --select E9,F63,F7,F82,F401   # mêmes règles que la CI

# --- Front (app/) : Node 22 ---
front-install:
	cd app && npm ci && ( [ -f .env.local ] || cp .env.example .env.local )
front:
	cd app && npm run dev
front-build:
	cd app && npm run lint && npm test && npm run build
front-preview:
	cd app && npm run build && npm run preview

# --- Tout vérifier avant une Pull Request (ruff, tests Python, lint + tests + build du front) ---
verifier: lint test front-build
