"""Voix française : Piper (modèle neuronal open source, ONNX, processeur), utilisée par les guides vocaux.

Le modèle (~60 Mo) est téléchargé une fois depuis Hugging Face (rhasspy/piper-voices) dans HF_HOME, puis gardé en
mémoire. Une phrase de 5 secondes se dit en 0,3 à 1 seconde sur un cœur : le front lit phrase par phrase et
demande la suivante pendant que la première est dite. Les nombres et unités sont déjà écrits pour l'oreille par le
front (lecture.ts, pourLOreille) ; Piper lit les nombres en toutes lettres (« 1409120 » : un million quatre cent…).

    VOIX_FR_MODELE   nom de la voix Piper (défaut fr_FR-siwis-medium ; voix d'homme : fr_FR-tom-medium)
"""

import io
import logging
import os
import threading
import wave

log = logging.getLogger(__name__)

MODELE = os.environ.get("VOIX_FR_MODELE", "fr_FR-siwis-medium")
_voix = None
_verrou = threading.Lock()


def disponible() -> bool:
    try:
        import piper  # noqa: F401
    except ImportError:
        return False
    return True


def charge() -> bool:
    return _voix is not None


def _charger():
    global _voix
    with _verrou:
        if _voix is None:
            from huggingface_hub import hf_hub_download
            from piper import PiperVoice

            langue, nom, qualite = MODELE.split("-")
            chemin = f"{langue.split('_')[0]}/{langue}/{nom}/{qualite}/{MODELE}"
            onnx = hf_hub_download("rhasspy/piper-voices", f"{chemin}.onnx")
            hf_hub_download("rhasspy/piper-voices", f"{chemin}.onnx.json")
            _voix = PiperVoice.load(onnx)
            log.info("Voix française %s chargée", MODELE)
    return _voix


def precharger() -> None:
    """Charge le modèle et le réchauffe : la première phrase n'attend pas le téléchargement."""
    if dire("Bonjour.") is None:
        log.warning("Voix française indisponible : le front utilisera la voix du navigateur")


def dire(texte: str) -> bytes | None:
    """Le texte dit, en WAV (mono, 16 bits). None si le modèle ne peut pas être chargé."""
    try:
        voix = _charger()
        tampon = io.BytesIO()
        with wave.open(tampon, "wb") as fichier:
            voix.synthesize_wav(texte, fichier)
        return tampon.getvalue()
    except Exception as exc:  # modèle absent, téléchargement impossible : le front se replie sur le navigateur
        log.warning("Synthèse française impossible : %s", exc)
        return None
