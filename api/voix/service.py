"""Service « voix » : la synthèse wolof (SpeechT5, processeur) dans son propre conteneur (audit, constat ARC-02).

Pourquoi à part : une synthèse occupe un cœur pendant plusieurs secondes et le modèle pèse ~1 Go en mémoire.
Dans le même processus que l'API, elle ralentissait la carte et les fiches pour tout le monde. Ici, elle est
plafonnée (cpus, mem_limit dans docker-compose.prod.yml) et l'API ne fait plus que l'appeler, avec un délai court.

    POST /dire   {texte}  → {audio_wo_base64}   une synthèse à la fois ; 503 si occupée ou impossible
    GET  /sante           → {pret}              pret = modèles déjà chargés en mémoire

Lancement : uvicorn api.voix.service:app --port 8090 (image deploy/Dockerfile.voix).
Le service n'est joignable que par l'API, sur un réseau interne : il n'a pas de port publié.
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import tts_local

TEXTE_MAX = 700  # même plafond que POST /voix/parler (api/routes/voix.py)
# Les messages de tts_local (modèle chargé, chargement impossible) dans les journaux du conteneur
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s : %(message)s")


@asynccontextmanager
async def _cycle(_app: FastAPI):
    # Charge les modèles au démarrage (téléchargement au premier lancement) : la première voix n'attend pas
    if os.environ.get("VOIX_PRECHARGER", "1") == "1":
        asyncio.get_running_loop().run_in_executor(None, tts_local.precharger)
    yield


app = FastAPI(title="Voix wolof (service interne)", docs_url=None, redoc_url=None, openapi_url=None, lifespan=_cycle)
_une_a_la_fois = asyncio.Semaphore(1)


class Texte(BaseModel):
    texte: str = Field(min_length=1, max_length=TEXTE_MAX)


@app.get("/sante")
def sante() -> dict:
    return {"pret": tts_local.charge()}


@app.post("/dire")
async def dire(t: Texte) -> dict:
    if _une_a_la_fois.locked():
        raise HTTPException(503, "occupee")
    async with _une_a_la_fois:
        audio = await asyncio.to_thread(tts_local.parler, t.texte)
    if not audio:
        raise HTTPException(503, "echec")
    return {"audio_wo_base64": audio}
