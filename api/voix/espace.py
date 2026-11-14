"""Appel du Space Hugging Face « voix wolof » (voix/space/) : transcrire et parler.

VOIX_SPACE dans .env : un Space Hugging Face (« compte/nom ») ou le service local « http://127.0.0.1:7860/ » (voix/README.md).
Sans VOIX_SPACE, la voix wolof est désactivée : les routes répondent 503 avec un message clair.
"""

import base64
import logging
import tempfile
from pathlib import Path

log = logging.getLogger(__name__)


class VoixIndisponible(Exception):
    """Space non configuré, endormi ou en erreur."""


class EspaceVoix:
    def __init__(self, space: str, jeton: str = ""):
        self.space, self.jeton = space, jeton
        self._client = None

    def _connecter(self):
        if not self.space:
            raise VoixIndisponible("La voix wolof n'est pas configurée (VOIX_SPACE vide dans .env).")
        if self._client is None:
            from gradio_client import Client

            try:
                # Sur processeur, une voix wolof peut prendre plusieurs minutes : délai large
                self._client = Client(self.space, token=self.jeton or None, verbose=False, httpx_kwargs={"timeout": 900})
            except Exception as exc:  # Space endormi, nom faux, réseau
                raise VoixIndisponible(f"Le service vocal ne répond pas ({type(exc).__name__}).") from exc
        return self._client

    def transcrire(self, audio: bytes, suffixe: str = ".webm") -> str:
        from gradio_client import handle_file

        client = self._connecter()
        with tempfile.NamedTemporaryFile(suffix=suffixe) as f:
            f.write(audio)
            f.flush()
            try:
                return str(client.predict(handle_file(f.name), api_name="/transcrire")).strip()
            except Exception as exc:
                raise VoixIndisponible(f"Transcription impossible ({type(exc).__name__}).") from exc

    def parler(self, texte: str) -> str | None:
        """Texte wolof → audio wav en base64 (None si la synthèse échoue : le texte reste affiché)."""
        try:
            chemin = self._connecter().predict(texte, api_name="/parler")
        except Exception as exc:  # noqa: BLE001 (la synthèse est facultative : le texte reste affiché)
            log.warning("Synthèse vocale wolof impossible : %s", exc)
            return None
        return base64.b64encode(Path(chemin).read_bytes()).decode() if chemin else None
