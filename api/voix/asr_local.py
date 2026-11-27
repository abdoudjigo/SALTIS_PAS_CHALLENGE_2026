"""Reconnaissance du wolof parlé (micro du chatbot) sur le processeur du serveur : gratuit, sans Space ni carte graphique.

Le navigateur ne sait pas reconnaître le wolof (Web Speech : français seulement). Le front enregistre la question,
la convertit en WAV 16 kHz mono (Assistant.tsx) et l'envoie à POST /voix/question ; ce module la transcrit.

Modèle : voir MODELE (choisi au banc d'essai, licence libre, assez léger pour 2 cœurs). Usage CTC standard de
transformers. Dépendances : celles de la voix (requirements-voix.txt). Téléchargé au premier appel, gardé en mémoire.
"""

import io
import logging
import os
import threading
import wave

log = logging.getLogger(__name__)

MODELE = os.environ.get("VOIX_WO_ASR_MODELE", "asr-africa/wav2vec2-xls-r-wolof-kallaama-fleurs-51-hours")
# Fils de calcul : ceux du conteneur (OMP_NUM_THREADS=1 dans deploy/Dockerfile.voix) sauf réglage explicite
FILS = int(os.environ.get("VOIX_ASR_FILS", "0")) or None
FREQUENCE = 16000
DUREE_MAX_S = 30

_modeles = None
_verrou = threading.Lock()
_calcul = threading.Lock()  # une transcription à la fois : les cœurs du conteneur servent la même question


class AudioIllisible(ValueError):
    """Le corps reçu n'est pas un WAV PCM 16 bits lisible."""


def disponible() -> bool:
    try:
        import torch  # noqa: F401
        import transformers  # noqa: F401
    except ImportError:
        return False
    return True


def charge() -> bool:
    return _modeles is not None


def precharger() -> None:
    try:
        _charger()
    except Exception as exc:  # noqa: BLE001
        log.warning("Préchargement de la reconnaissance wolof impossible : %s", exc)


def _charger():
    global _modeles
    with _verrou:
        if _modeles is None:
            import torch
            from transformers import AutoModelForCTC, AutoProcessor

            if FILS:
                torch.set_num_threads(FILS)
            processeur = AutoProcessor.from_pretrained(MODELE)
            modele = AutoModelForCTC.from_pretrained(MODELE).eval()
            _modeles = (processeur, modele)
            log.info("Reconnaissance wolof locale chargée (%s)", MODELE)
    return _modeles


def lire_wav(octets: bytes):
    """WAV PCM 16 bits → signal float32 mono 16 kHz (rééchantillonné si besoin, 30 s au plus)."""
    import numpy as np

    try:
        with wave.open(io.BytesIO(octets)) as f:
            if f.getsampwidth() != 2:
                raise AudioIllisible("WAV 16 bits attendu.")
            canaux, frequence = f.getnchannels(), f.getframerate()
            brut = f.readframes(min(f.getnframes(), frequence * DUREE_MAX_S))
    except (wave.Error, EOFError) as exc:
        raise AudioIllisible("Audio illisible : WAV attendu.") from exc
    signal = np.frombuffer(brut, dtype=np.int16).astype(np.float32) / 32768
    if canaux > 1:
        signal = signal.reshape(-1, canaux).mean(axis=1)
    if frequence != FREQUENCE and len(signal):
        n = int(len(signal) * FREQUENCE / frequence)
        signal = np.interp(np.linspace(0, len(signal) - 1, n), np.arange(len(signal)), signal).astype(np.float32)
    return signal


def transcrire(octets: bytes) -> str:
    """Question parlée (WAV) → texte wolof. Chaîne vide si rien n'est entendu. Lève AudioIllisible."""
    import numpy as np
    import torch

    signal = lire_wav(octets)
    if len(signal) < FREQUENCE // 4 or float(np.abs(signal).max(initial=0)) < 0.01:
        return ""  # moins d'un quart de seconde, ou silence
    signal = signal / max(float(np.abs(signal).max()), 1e-6) * 0.9  # micro faible ou fort : même niveau
    processeur, modele = _charger()
    entree = processeur(signal, sampling_rate=FREQUENCE, return_tensors="pt")
    with _calcul, torch.inference_mode():
        logits = modele(**entree).logits
    return processeur.batch_decode(logits.argmax(-1))[0].strip()
