"""Écouter les voix wolof avant d'en choisir une : 3 phrases de la plateforme dites avec chaque empreinte.

    venv/bin/python voix/comparer_voix.py      # → voix/essais/<phrase>_<voix>.wav (hors Git)

Puis régler VOIX_LOCUTEUR (slt, femme ou homme) dans .env : voir voix/README.md.
"""

import base64
import sys
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from api.voix import tts_local

ESSAIS = RACINE / "voix" / "essais"
# Phrases réellement produites par l'assistant et les mascottes (api/voix/repondre.py)
PHRASES = {
    "saison": "Atum ñaari junni ak ñaar-fukk ak juróom-ñaar, ci Kaolack, nawet bi dina am taw bu yem. "
              "Taw bi ñu xaar mooy juróom-ñaari téeméer milimetar.",
    "semis": "Ci Kolda, gerte gi, ngay ji ko diggante fukk ak benn ak ñaar-fukk sulet. Fa la loraange gi gën a néew.",
    "aide": "Salaam aleekum ! Mën naa la tontu ci nawet bi, kañ ngay ji, lan ngay bey, jiwu ak ndawal yi nga soxla.",
}


def main() -> int:
    ESSAIS.mkdir(parents=True, exist_ok=True)
    for nom, phrase in PHRASES.items():
        for voix in tts_local.LOCUTEURS:
            debut = time.perf_counter()
            audio = tts_local.parler(phrase, voix)
            if not audio:
                print(f"Échec : {nom} / {voix}", file=sys.stderr)
                return 1
            fichier = ESSAIS / f"{nom}_{voix}.wav"
            fichier.write_bytes(base64.b64decode(audio))
            print(f"{fichier.relative_to(RACINE)} ({time.perf_counter() - debut:.1f} s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
