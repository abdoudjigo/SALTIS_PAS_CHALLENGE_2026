"""IA vocale : une question parlée (wolof) ou écrite (français, transcrite par le navigateur) → une réponse courte,
tirée des données de la plateforme, avec la vue de la carte à afficher.

    POST /voix/texte      {texte, code_departement?, annee?}            → réponse (français et wolof)
    POST /voix/question   corps = audio (webm, wav…) ; ?code_departement   → transcription + réponse + voix wolof

La compréhension et les phrases sont dans api/voix/ ; la reconnaissance et la synthèse du wolof dans le Space voix/space/.
"""

import asyncio
import hashlib
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

from ..erreurs import ErreurApi, reponses_erreurs
from ..securite import limiter, lire_corps
from ..voix import tts_local
from ..voix.comprendre import comprendre
from ..voix.espace import EspaceVoix, VoixIndisponible
from ..voix.repondre import Lecteur, repondre

CACHE_VOIX = Path(__file__).resolve().parents[2] / "voix" / "cache"
TAILLE_MAX_AUDIO = 5 * 1024 * 1024  # 5 Mo : une question de 30 s tient largement
SYNTHESES_EN_ATTENTE_MAX = 6  # au-delà, on répond 503 plutôt que d'empiler des synthèses de plusieurs minutes
_synthese = asyncio.Semaphore(1)  # une seule synthèse locale à la fois : le processeur du serveur n'en tient pas plus
_en_attente = 0
voix = APIRouter(prefix="/voix", tags=["IA · Voix"])


class QuestionTexte(BaseModel):
    texte: str = Field(min_length=2, max_length=500, examples=["Quand semer l'arachide à Kaolack en 2027 ?"])
    code_departement: str | None = Field(None, max_length=20,
                                         description="Département affiché à l'écran, utilisé si la question n'en cite pas")
    annee: int | None = Field(None, ge=1981, le=2035, description="Année affichée à l'écran, utilisée si la question n'en cite pas")


class ReponseVoix(BaseModel):
    transcription: str | None = Field(None, description="Ce que la reconnaissance vocale a entendu (wolof)")
    fonctionnalite: str = Field(description="saison, semis, culture, besoins ou alerte")
    texte_fr: str
    texte_wo: str = Field(description="Réponse en wolof (phrases types, à faire relire par un locuteur)")
    code_departement: str | None = None
    departement: str | None = None
    culture: str | None = None
    annee: int | None = None
    nature: str | None = Field(None, description="prévision océan, prévision de tendance, année passée…")
    vue: dict[str, Any] = Field(description="Ce que le front affiche : bouton, département, culture, année")
    audio_wo_base64: str | None = Field(None, description="Réponse parlée en wolof (wav, base64), si la synthèse a réussi")


def _espace(request: Request) -> EspaceVoix:
    app = request.app
    if not hasattr(app.state, "espace_voix"):
        p = app.state.parametres
        app.state.espace_voix = EspaceVoix(p.voix_space, p.hf_token.get_secret_value())
    return app.state.espace_voix


async def _repondre(request: Request, texte: str, code_departement: str | None, annee: int | None) -> dict[str, Any]:
    cache = request.app.state.cache
    version, index = await cache.etat_actif()
    intention = comprendre(texte, index.departements)
    intention.code_departement = intention.code_departement or (code_departement if code_departement in index.departements else None)
    intention.annee = intention.annee or annee
    return (await repondre(intention, index, Lecteur(cache, version))).en_dict()


@voix.post("/texte", response_model=ReponseVoix, responses=reponses_erreurs(429, 503), summary="Répondre à une question écrite")
async def question_texte(request: Request, q: QuestionTexte):
    """Pour le français : le navigateur transcrit la voix (reconnaissance vocale du navigateur) et envoie le texte.
    Comprend aussi le wolof écrit."""
    limiter(request, "voix_texte")
    return await _repondre(request, q.texte, q.code_departement, q.annee)


@voix.post("/question", response_model=ReponseVoix, responses=reponses_erreurs(413, 422, 429, 503),
           summary="Répondre à une question parlée en wolof")
async def question_audio(
    request: Request,
    code_departement: Annotated[str | None, Query(max_length=20, description="Département affiché à l'écran")] = None,
    annee: Annotated[int | None, Query(ge=1981, le=2035)] = None,
    parler: Annotated[bool, Query(description="Renvoyer aussi la réponse parlée en wolof")] = True,
):
    """Corps de la requête : l'audio brut (`Content-Type: audio/webm`, `audio/wav`…), 30 s au plus.
    L'audio est transcrit par le Space « voix wolof » puis oublié : rien n'est conservé."""
    limiter(request, "voix_synthese")
    audio = await lire_corps(request, TAILLE_MAX_AUDIO,
                             ErreurApi(413, "audio_trop_long", "La question est trop longue : 30 secondes au plus."))
    if not audio:
        raise ErreurApi(422, "audio_vide", "Aucun son reçu.")
    suffixe = {"audio/wav": ".wav", "audio/x-wav": ".wav", "audio/ogg": ".ogg", "audio/mpeg": ".mp3", "audio/mp4": ".m4a"}.get(
        request.headers.get("content-type", "").split(";")[0], ".webm")
    espace = _espace(request)
    try:
        transcription = await asyncio.to_thread(espace.transcrire, audio, suffixe)
    except VoixIndisponible as exc:
        raise ErreurApi(503, "voix_indisponible", str(exc), "Voir voix/README.md : déployer le Space et renseigner VOIX_SPACE.") from None
    if not transcription:
        raise ErreurApi(422, "rien_entendu", "Je n'ai rien entendu. Rapprochez-vous du micro et réessayez.")
    reponse = await _repondre(request, transcription, code_departement, annee)
    reponse["transcription"] = transcription
    if parler:
        reponse["audio_wo_base64"] = await asyncio.to_thread(espace.parler, reponse["texte_wo"])
    return reponse


class TexteWolof(BaseModel):
    texte: str = Field(min_length=1, max_length=1500, description="Texte wolof préparé par le front (mascotte « WLF »)")


class AudioWolof(BaseModel):
    audio_wo_base64: str = Field(description="Voix wolof (wav, base64)")


async def _synthese_locale(texte: str) -> str | None:
    """Synthèse sur le processeur du serveur, une à la fois, avec une file d'attente bornée."""
    global _en_attente
    if _en_attente >= SYNTHESES_EN_ATTENTE_MAX:
        raise ErreurApi(503, "voix_occupee", "La voix wolof est très demandée. Réessayez dans un instant.", entetes={"Retry-After": "30"})
    _en_attente += 1
    try:
        async with _synthese:
            return await asyncio.to_thread(tts_local.parler, texte)
    finally:
        _en_attente -= 1


@voix.post("/parler", response_model=AudioWolof, responses=reponses_erreurs(429, 503), summary="Dire un texte wolof (mascotte « WLF »)")
async def parler_wolof(request: Request, t: TexteWolof):
    """Le front envoie le texte wolof de la fonctionnalité affichée ; le Space « voix wolof » (Adia TTS) le dit."""
    espace = _espace(request)
    # Une voix déjà produite est gardée sur disque : la rejouer est instantané, même après un redémarrage
    fichier = CACHE_VOIX / f"{hashlib.sha256(t.texte.encode()).hexdigest()[:32]}.b64"
    if fichier.exists():
        return {"audio_wo_base64": fichier.read_text()}
    limiter(request, "voix_synthese")  # seules les voix à produire comptent : rejouer une voix gardée est gratuit
    if request.app.state.parametres.voix_space:  # Space Hugging Face (carte graphique), si configuré
        try:
            espace._connecter()
        except VoixIndisponible as exc:
            raise ErreurApi(503, "voix_indisponible", f"{exc} Le texte wolof reste lisible à l'écran.",
                            "Voir voix/README.md.") from None
        audio = await asyncio.to_thread(espace.parler, t.texte)
    elif tts_local.disponible():  # sinon, voix produite par l'API elle-même, sur le processeur du serveur
        audio = await _synthese_locale(t.texte)
    else:
        raise ErreurApi(503, "voix_indisponible", "La voix wolof n'est pas installée sur ce serveur. Le texte wolof reste lisible.",
                        "Installer requirements-voix.txt (voir voix/README.md).")
    if audio:
        CACHE_VOIX.mkdir(parents=True, exist_ok=True)
        # Le disque du serveur est borné : au-delà du plafond, la voix est rendue sans être gardée
        if sum(1 for _ in CACHE_VOIX.iterdir()) < request.app.state.parametres.voix_cache_max_fichiers:
            fichier.write_text(audio)
    if not audio:
        raise ErreurApi(503, "voix_indisponible", "La voix wolof n'a pas pu être produite. Réessayez dans un instant.")
    return {"audio_wo_base64": audio}
