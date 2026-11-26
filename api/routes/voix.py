"""IA vocale : une question parlée (wolof) ou écrite (français, transcrite par le navigateur) → une réponse courte,
tirée des données de la plateforme, avec la vue de la carte à afficher.

    POST /voix/texte      {texte, code_departement?, annee?}            → réponse (français et wolof)
    POST /voix/question   corps = audio (webm, wav…) ; ?code_departement   → transcription + réponse + voix wolof

La compréhension et les phrases sont dans api/voix/ ; la reconnaissance et la synthèse du wolof dans le Space voix/space/.
"""

import asyncio
import hashlib
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Query, Request, Response
from pydantic import BaseModel, Field

from ..erreurs import ErreurApi, reponses_erreurs
from ..securite import limiter, lire_corps
from ..voix import tts_fr, tts_local
from ..voix.comprendre import comprendre
from ..voix.espace import EspaceVoix, VoixIndisponible
from ..voix.repondre import Lecteur, repondre

CACHE_VOIX = Path(__file__).resolve().parents[2] / "voix" / "cache"
TAILLE_MAX_AUDIO = 5 * 1024 * 1024  # 5 Mo : une question de 30 s tient largement
SYNTHESES_EN_ATTENTE_MAX = 6  # au-delà, on répond 503 plutôt que d'empiler des synthèses de plusieurs minutes
# Texte wolof le plus long envoyé par le front : 476 caractères (« Ma parcelle », mesuré le 22/11/2026). 700 laisse de la
# marge sans permettre de faire dire n'importe quel long texte au serveur (audit, constat BE-01).
TEXTE_WO_MAX = 700
# Une seule synthèse à la fois, locale OU par le Space : le processeur du serveur (ou le Space gratuit) n'en tient pas plus
_synthese = asyncio.Semaphore(1)
# Le Space (carte graphique, file d'attente de Hugging Face) en tient plusieurs : les agriculteurs n'attendent pas
# les uns derrière les autres
SYNTHESES_SPACE_SIMULTANEES = 3
_synthese_space = asyncio.Semaphore(SYNTHESES_SPACE_SIMULTANEES)
log = logging.getLogger(__name__)
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


def _exiger_questions(request: Request) -> None:
    if not request.app.state.parametres.voix_questions:
        raise ErreurApi(404, "fonction_inactive", "Les questions à la voix ne sont pas ouvertes sur ce serveur.", "Réglage VOIX_QUESTIONS")


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
    _exiger_questions(request)
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
    _exiger_questions(request)
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
    texte: str = Field(min_length=1, max_length=TEXTE_WO_MAX, description="Texte wolof préparé par le front (mascotte « WLF »)")


class AudioWolof(BaseModel):
    audio_wo_base64: str = Field(description="Voix wolof en base64 : mp3 (Space, Adia TTS) ou wav (service « voix » du serveur)")


async def _synthese_bornee(produire, texte: str, verrou: asyncio.Semaphore | None = None) -> str | None:
    """Une synthèse à la fois (locale ou Space), avec une file d'attente bornée : au-delà, 503 plutôt qu'empiler."""
    global _en_attente
    if _en_attente >= SYNTHESES_EN_ATTENTE_MAX:
        raise ErreurApi(503, "voix_occupee", "La voix wolof est très demandée. Réessayez dans un instant.", entetes={"Retry-After": "30"})
    _en_attente += 1
    try:
        async with verrou or _synthese:
            return await asyncio.to_thread(produire, texte)
    finally:
        _en_attente -= 1


def _garder(fichier: Path, audio: str, maxi: int) -> None:
    """Garde la voix sur disque. Au-delà du plafond, les voix les moins récemment utilisées sont supprimées :
    le cache ne peut pas être bloqué une fois pour toutes par des textes jamais rejoués (audit, constat BE-01)."""
    if maxi <= 0:
        return
    CACHE_VOIX.mkdir(parents=True, exist_ok=True)
    gardes = sorted(CACHE_VOIX.glob("*.b64"), key=lambda f: f.stat().st_mtime)
    for vieux in gardes[: max(0, len(gardes) - maxi + 1)]:
        vieux.unlink(missing_ok=True)
    fichier.write_text(audio)


def _par_service(url: str, delai_s: float):
    """La synthèse par le service « voix » (conteneur à part, audit ARC-02) : l'API attend, sans calculer."""
    def produire(texte: str) -> str | None:
        requete = urllib.request.Request(f"{url.rstrip('/')}/dire", data=json.dumps({"texte": texte}).encode(),
                                         headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(requete, timeout=delai_s) as r:  # adresse interne, fixée par la configuration
                return json.loads(r.read())["audio_wo_base64"]
        except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError) as exc:
            log.warning("Service voix injoignable ou trop lent : %s", exc)
            return None
    return produire


@voix.post("/parler", response_model=AudioWolof, responses=reponses_erreurs(429, 503), summary="Dire un texte wolof (mascotte « WLF »)")
async def parler_wolof(request: Request, t: TexteWolof):
    """Le front envoie le texte wolof de la fonctionnalité affichée ; le Space « voix wolof » (Adia TTS) le dit."""
    espace = _espace(request)
    # Une voix déjà produite est gardée sur disque : la rejouer est instantané, même après un redémarrage
    fichier = CACHE_VOIX / f"{hashlib.sha256(t.texte.encode()).hexdigest()[:32]}.b64"
    if fichier.exists():
        fichier.touch()  # récemment utilisée : gardée en priorité
        return {"audio_wo_base64": fichier.read_text()}
    limiter(request, "voix_synthese")  # seules les voix à produire comptent : rejouer une voix gardée est gratuit
    p = request.app.state.parametres
    if p.voix_space:  # Space Hugging Face (Adia TTS sur carte graphique) : la voix la plus claire et la plus rapide
        try:
            espace._connecter()
            audio = await _synthese_bornee(espace.parler, t.texte, _synthese_space)
        except VoixIndisponible as exc:
            if not p.voix_service_url:
                raise ErreurApi(503, "voix_indisponible", f"{exc} Le texte wolof reste lisible à l'écran.",
                                "Voir voix/README.md.") from None
            audio = None
        # Space endormi ou quota épuisé : le service « voix » du serveur prend le relais (voix moins nette)
        if not audio and p.voix_service_url:
            log.warning("Space voix sans réponse : repli sur le service « voix » du serveur")
            audio = await _synthese_bornee(_par_service(p.voix_service_url, p.voix_service_delai_s), t.texte)
    elif p.voix_service_url:  # production : service « voix », conteneur à part
        audio = await _synthese_bornee(_par_service(p.voix_service_url, p.voix_service_delai_s), t.texte)
    elif tts_local.disponible():  # développement : voix produite par l'API elle-même, sur le processeur
        audio = await _synthese_bornee(tts_local.parler, t.texte)
    else:
        raise ErreurApi(503, "voix_indisponible", "La voix wolof n'est pas installée sur ce serveur. Le texte wolof reste lisible.",
                        "Installer requirements-voix.txt (voir voix/README.md).")
    if audio:
        _garder(fichier, audio, request.app.state.parametres.voix_cache_max_fichiers)
    if not audio:
        raise ErreurApi(503, "voix_indisponible", "La voix wolof n'a pas pu être produite. Réessayez dans un instant.")
    return {"audio_wo_base64": audio}


# ---- Voix française des guides (Piper) -------------------------------------------------------------------------
TEXTE_FR_MAX = 400  # une phrase : le front découpe (lecture.ts, decouper)
_francais = asyncio.Semaphore(2)
# Une voix française déjà dite ne change jamais : le navigateur la garde, et le serveur aussi (disque)
ENTETES_FR = {"Cache-Control": "public, max-age=31536000, immutable"}


def _francais_par_service(url: str, delai_s: float):
    def produire(texte: str) -> bytes | None:
        adresse = f"{url.rstrip('/')}/dire_fr?{urllib.parse.urlencode({'texte': texte})}"
        try:
            with urllib.request.urlopen(adresse, timeout=delai_s) as r:  # adresse interne, fixée par la configuration
                return r.read()
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            log.warning("Service voix (français) injoignable : %s", exc)
            return None
    return produire


@voix.get("/francais", response_class=Response, responses={**reponses_erreurs(429, 503), 200: {"content": {"audio/wav": {}}}},
          summary="Dire une phrase en français (guides vocaux, Piper)")
async def parler_francais(request: Request, texte: Annotated[str, Query(min_length=1, max_length=TEXTE_FR_MAX)]):
    """Une phrase française dite par Piper (modèle neuronal, serveur), en WAV. 503 : le front lit avec la voix du navigateur."""
    fichier = CACHE_VOIX / f"fr-{tts_fr.MODELE}-{hashlib.sha256(texte.encode()).hexdigest()[:32]}.wav"
    if fichier.exists():
        fichier.touch()
        return Response(fichier.read_bytes(), media_type="audio/wav", headers=ENTETES_FR)
    limiter(request, "voix_francais")
    p = request.app.state.parametres
    if p.voix_service_url:  # production : service « voix », conteneur à part
        produire = _francais_par_service(p.voix_service_url, min(p.voix_service_delai_s, 15))
    elif tts_fr.disponible():  # développement : Piper dans l'API
        produire = tts_fr.dire
    else:
        raise ErreurApi(503, "voix_indisponible", "La voix française du serveur n'est pas installée.", "Installer requirements-voix.txt.")
    async with _francais:
        audio = await asyncio.to_thread(produire, texte)
    if not audio:
        raise ErreurApi(503, "voix_indisponible", "La voix française n'a pas pu être produite.")
    if p.voix_cache_max_fichiers > 0:
        CACHE_VOIX.mkdir(parents=True, exist_ok=True)
        gardes = sorted(CACHE_VOIX.glob("fr-*.wav"), key=lambda f: f.stat().st_mtime)
        for vieux in gardes[: max(0, len(gardes) - p.voix_cache_max_fichiers + 1)]:
            vieux.unlink(missing_ok=True)
        fichier.write_bytes(audio)
    return Response(audio, media_type="audio/wav", headers=ENTETES_FR)


# ---- Voix wolof phrase par phrase (guides vocaux) -----------------------------------------------------------------
TEXTE_WO_PHRASE_MAX = 200  # une phrase : le front découpe (lecture.ts, decouper)
_wolof_phrases = asyncio.Semaphore(2)


@voix.get("/wolof", response_class=Response, responses={**reponses_erreurs(429, 503), 200: {"content": {"audio/wav": {}}}},
          summary="Dire une phrase en wolof (guides vocaux, SpeechT5 wolof)")
async def parler_wolof_phrase(request: Request, texte: Annotated[str, Query(min_length=1, max_length=TEXTE_WO_PHRASE_MAX)]):
    """Une phrase wolof en WAV. Le front lit phrase par phrase et demande la suivante pendant que la première est dite :
    la voix part après une seule phrase calculée, au lieu du texte entier."""
    nom = tts_local.MODELE.split("/")[-1]
    fichier = CACHE_VOIX / f"wo-{nom}-{hashlib.sha256(texte.encode()).hexdigest()[:32]}.wav"
    if fichier.exists():
        fichier.touch()
        return Response(fichier.read_bytes(), media_type="audio/wav", headers=ENTETES_FR)
    limiter(request, "voix_francais")  # même limite que le français : une requête par phrase
    p = request.app.state.parametres
    if p.voix_service_url:
        url = f"{p.voix_service_url.rstrip('/')}/dire_wo"

        def produire(t: str) -> bytes | None:
            try:
                with urllib.request.urlopen(f"{url}?{urllib.parse.urlencode({'texte': t})}", timeout=p.voix_service_delai_s) as r:
                    return r.read()
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                log.warning("Service voix (wolof) injoignable : %s", exc)
                return None
    elif tts_local.disponible():
        produire = tts_local.dire_phrase
    else:
        raise ErreurApi(503, "voix_indisponible", "La voix wolof n'est pas installée sur ce serveur. Le texte wolof reste lisible.")
    async with _wolof_phrases:
        audio = await asyncio.to_thread(produire, texte)
    if not audio:
        raise ErreurApi(503, "voix_indisponible", "La voix wolof n'a pas pu être produite. Réessayez dans un instant.")
    if p.voix_cache_max_fichiers > 0:
        CACHE_VOIX.mkdir(parents=True, exist_ok=True)
        gardes = sorted(CACHE_VOIX.glob("wo-*.wav"), key=lambda f: f.stat().st_mtime)
        for vieux in gardes[: max(0, len(gardes) - p.voix_cache_max_fichiers + 1)]:
            vieux.unlink(missing_ok=True)
        fichier.write_bytes(audio)
    return Response(audio, media_type="audio/wav", headers=ENTETES_FR)
