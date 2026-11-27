"""Voix wolof produite directement par l'API, sur le processeur du serveur : gratuit, sans carte graphique ni service tiers.

Modèle : bilalfaye/speecht5_tts-wolof (SpeechT5 affiné sur le wolof, licence MIT, ~580 Mo) + vocodeur
microsoft/speecht5_hifigan. Voix : empreinte « slt » (voix féminine) du jeu CMU Arctic, rangée dans
locuteur_wolof.npy (2 Ko). Usage repris de la fiche du modèle.

Dépendances (requirements-voix.txt) : torch (version processeur), transformers, sentencepiece.
Les modèles sont téléchargés au premier appel puis gardés en mémoire.
"""

import base64
import io
import logging
import threading
import wave
from pathlib import Path

log = logging.getLogger(__name__)

MODELE = "bilalfaye/speecht5_tts-wolof"
VOCODEUR = "microsoft/speecht5_hifigan"
LOCUTEUR = Path(__file__).with_name("locuteur_wolof.npy")
FREQUENCE = 16000  # SpeechT5 produit du 16 kHz
LONGUEUR_PHRASE = 180  # caractères par morceau (limite de texte du modèle)

_modeles = None
_verrou = threading.Lock()


def disponible() -> bool:
    """Vrai si les bibliothèques sont installées (requirements-voix.txt)."""
    try:
        import torch  # noqa: F401
        import transformers  # noqa: F401
    except ImportError:
        return False
    return True


def charge() -> bool:
    """Vrai si les modèles sont déjà en mémoire."""
    return _modeles is not None


def precharger() -> None:
    """Charge les modèles tout de suite (service « voix », au démarrage) ; une erreur est journalisée, pas levée."""
    try:
        _charger()
    except Exception as exc:  # noqa: BLE001
        log.warning("Préchargement de la voix wolof impossible : %s", exc)


def _charger():
    global _modeles
    with _verrou:
        if _modeles is None:
            import numpy as np
            import torch
            from transformers import (
                SpeechT5ForTextToSpeech,
                SpeechT5HifiGan,
                SpeechT5Processor,
            )

            processeur = SpeechT5Processor.from_pretrained(MODELE)
            modele = SpeechT5ForTextToSpeech.from_pretrained(MODELE).eval()
            vocodeur = SpeechT5HifiGan.from_pretrained(VOCODEUR).eval()
            locuteur = torch.from_numpy(np.load(LOCUTEUR)).unsqueeze(0)
            _modeles = (processeur, modele, vocodeur, locuteur)
            log.info("Voix wolof locale chargée (%s)", MODELE)
    return _modeles


def decouper(texte: str) -> list[str]:
    """Phrases courtes (le modèle tronque les textes longs)."""
    morceaux: list[str] = []
    for phrase in texte.replace("!", ".").replace("?", ".").replace(":", ",").split("."):
        phrase = phrase.strip()
        while len(phrase) > LONGUEUR_PHRASE:
            coupe = phrase.rfind(",", 0, LONGUEUR_PHRASE)
            coupe = coupe if coupe > 40 else phrase.rfind(" ", 0, LONGUEUR_PHRASE)
            morceaux.append(phrase[:coupe].strip(" ,"))
            phrase = phrase[coupe:].strip(" ,")
        if phrase:
            morceaux.append(phrase)
    return morceaux


def _wav(signal) -> bytes:
    import numpy as np

    pcm = (np.clip(signal, -1, 1) * 32767).astype(np.int16)
    tampon = io.BytesIO()
    with wave.open(tampon, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(FREQUENCE)
        f.writeframes(pcm.tobytes())
    return tampon.getvalue()


def parler(texte: str) -> str | None:
    """Texte wolof → wav en base64 (None si la synthèse échoue)."""
    try:
        import numpy as np
        import torch

        processeur, modele, vocodeur, locuteur = _charger()
        pause = np.zeros(int(0.3 * FREQUENCE), dtype=np.float32)
        morceaux = []
        for phrase in decouper(texte):
            entree = processeur(text=phrase, return_tensors="pt")
            with torch.inference_mode():
                son = modele.generate_speech(entree["input_ids"], locuteur, vocoder=vocodeur)
            morceaux += [son.numpy(), pause]
        if not morceaux:
            return None
        return base64.b64encode(_wav(np.concatenate(morceaux))).decode()
    except Exception as exc:  # noqa: BLE001 — la voix est facultative : le texte wolof reste affiché
        log.warning("Voix wolof locale impossible : %s", exc)
        return None
