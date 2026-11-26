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
import os
import threading
import wave
from pathlib import Path

log = logging.getLogger(__name__)

# v0.2 : même voix, affinée sur le wolof ET le français (mieux pour « engrais », « conseiller agricole », les mois)
MODELE = os.environ.get("VOIX_WO_MODELE", "bilalfaye/speecht5_tts-wolof-v0.2")
# Cœurs de calcul : 2 rend la voix ~1,4 fois plus rapide qu'un seul (mesuré) ; à accorder avec « cpus » du conteneur
FILS = int(os.environ.get("VOIX_WO_FILS", "2"))
# Durée maximale d'une phrase, en trames par caractère : coupe le « bafouillage » de fin que SpeechT5 produit parfois
# (une phrase de 117 caractères dite en 9 s pouvait durer 13 s). 10 laisse environ 0,16 s par caractère.
DUREE_MAX = 10.0
VOCODEUR = "microsoft/speecht5_hifigan"
LOCUTEUR = Path(__file__).with_name("locuteur_wolof.npy")
FREQUENCE = 16000  # SpeechT5 produit du 16 kHz
LONGUEUR_PHRASE = 180  # caractères par morceau (limite de texte du modèle)

_modeles = None
_verrou = threading.Lock()
_calcul = threading.Lock()  # une synthèse à la fois : les deux cœurs servent la même phrase


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

            torch.set_num_threads(FILS)
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


def _signal(phrase: str):
    """Une phrase → signal 16 kHz. Graine fixe : la même phrase donne toujours la même voix (SpeechT5 tire au sort à
    chaque pas de décodage), donc le cache sert toujours la même prise."""
    import numpy as np
    import torch

    processeur, modele, vocodeur, locuteur = _charger()
    entree = processeur(text=phrase, return_tensors="pt")
    with _calcul, torch.inference_mode():
        # Graine 1 : la prise la plus nette des essais (fin de phrase sans traîne, mesuré sur les phrases d'accueil)
        torch.manual_seed(1)
        son = modele.generate_speech(entree["input_ids"], locuteur, vocoder=vocodeur, maxlenratio=DUREE_MAX)
    # Un court silence au début et à la fin : les phrases s'enchaînent sans se coller
    blanc = np.zeros(int(0.12 * FREQUENCE), dtype=np.float32)
    return np.concatenate([blanc, son.numpy(), blanc])


def dire_phrase(phrase: str) -> bytes | None:
    """Une phrase wolof → WAV (lecture phrase par phrase du front). None si la synthèse échoue."""
    try:
        return _wav(_signal(phrase.strip()))
    except Exception as exc:  # noqa: BLE001 — la voix est facultative : le texte wolof reste affiché
        log.warning("Voix wolof locale impossible : %s", exc)
        return None


def parler(texte: str) -> str | None:
    """Texte wolof entier → wav en base64 (ancienne route POST /voix/parler). None si la synthèse échoue."""
    try:
        import numpy as np

        morceaux = [_signal(phrase) for phrase in decouper(texte)]
        if not morceaux:
            return None
        return base64.b64encode(_wav(np.concatenate(morceaux))).decode()
    except Exception as exc:  # noqa: BLE001 — la voix est facultative : le texte wolof reste affiché
        log.warning("Voix wolof locale impossible : %s", exc)
        return None
