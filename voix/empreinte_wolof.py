"""Empreintes de locuteur wolof pour SpeechT5 (api/voix/tts_local.py), calculées sur de vraies voix wolof.

Pourquoi : la voix wolof locale utilisait l'empreinte « slt » d'une voix anglaise (CMU Arctic), d'où un son étouffé
(docs/technique/passation-voix-wolof.md, piste 3). Ici, l'empreinte est la moyenne des x-vectors de ~200 phrases
de chacune des deux voix natives du jeu « Wolof TTS » (Baamtu Datamation, AI4D ; galsenai/wolof_tts, CC-BY-4.0).
Même modèle d'empreinte que la fiche de SpeechT5 : speechbrain/spkrec-xvect-voxceleb.

Entrée : data/text/tts/galsenai_wolof_tts/data/*.parquet (hors Git, 4,3 Go).
Sorties : api/voix/locuteur_wolof_femme.npy et api/voix/locuteur_wolof_homme.npy (512 valeurs, norme 1).

Environnement à part (speechbrain demande torchaudio, qui doit suivre la version de torch) :
    python3 -m venv voix/.venv
    voix/.venv/bin/pip install --extra-index-url https://download.pytorch.org/whl/cpu \\
        "torch==2.11.*" "torchaudio==2.11.*" speechbrain pyarrow soundfile transformers sentencepiece
    voix/.venv/bin/python voix/empreinte_wolof.py            # ~200 phrases par voix, quelques minutes
"""

import argparse
import io
import random
import sys
from pathlib import Path

import numpy as np

RACINE = Path(__file__).resolve().parents[1]
DONNEES = RACINE / "data" / "text" / "tts" / "galsenai_wolof_tts" / "data"
SORTIES = {"female": RACINE / "api" / "voix" / "locuteur_wolof_femme.npy",
           "male": RACINE / "api" / "voix" / "locuteur_wolof_homme.npy"}
MODELE = "speechbrain/spkrec-xvect-voxceleb"
FREQUENCE = 16000
DUREE_MIN_S, DUREE_MAX_S = 2.0, 10.0  # phrases trop courtes : empreinte bruitée ; trop longues : inutile


def echantillons(par_voix: int, graine: int):
    """(voix, signal 16 kHz) : `par_voix` phrases par voix, tirées de groupes de lignes pris au hasard dans tous les fichiers."""
    import pyarrow.parquet as pq
    import soundfile as sf

    hasard = random.Random(graine)
    groupes = [(f, g) for f in sorted(DONNEES.glob("train-*.parquet")) for g in range(pq.ParquetFile(f).num_row_groups)]
    hasard.shuffle(groupes)
    restants = {"female": par_voix, "male": par_voix}
    for fichier, groupe in groupes:
        if not any(restants.values()):
            return
        table = pq.ParquetFile(fichier).read_row_group(groupe, columns=["audio", "gender"])
        lignes = list(zip(table.column("gender").to_pylist(), table.column("audio").to_pylist(), strict=True))
        hasard.shuffle(lignes)
        pris = 0
        for voix, audio in lignes:
            if restants.get(voix, 0) <= 0 or pris >= 8:  # 8 phrases au plus par groupe : on varie les séances d'enregistrement
                continue
            signal, frequence = sf.read(io.BytesIO(audio["bytes"]), dtype="float32")
            if signal.ndim > 1:
                signal = signal.mean(axis=1)
            if frequence != FREQUENCE or not DUREE_MIN_S <= len(signal) / FREQUENCE <= DUREE_MAX_S:
                continue
            restants[voix] -= 1
            pris += 1
            yield voix, signal


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--par-voix", type=int, default=200)
    parser.add_argument("--graine", type=int, default=2026)
    args = parser.parse_args()
    if not DONNEES.exists():
        print(f"Jeu de données absent : {DONNEES}", file=sys.stderr)
        return 1

    import torch
    import torch.nn.functional as F
    from speechbrain.inference.speaker import EncoderClassifier

    encodeur = EncoderClassifier.from_hparams(source=MODELE, savedir=str(RACINE / "voix" / ".venv" / "modeles" / "spkrec-xvector"),
                                              run_opts={"device": "cpu"})
    empreintes: dict[str, list[np.ndarray]] = {"female": [], "male": []}
    for voix, signal in echantillons(args.par_voix, args.graine):
        with torch.inference_mode():
            e = encodeur.encode_batch(torch.from_numpy(signal).unsqueeze(0))
            e = F.normalize(e, dim=2).squeeze().numpy()  # comme la recette de SpeechT5 (cmu-arctic-xvectors)
        empreintes[voix].append(e)
        n = sum(len(v) for v in empreintes.values())
        if n % 50 == 0:
            print(f"{n} phrases encodées…", flush=True)

    for voix, liste in empreintes.items():
        if not liste:
            print(f"Aucune phrase pour la voix {voix}", file=sys.stderr)
            return 1
        tout = np.stack(liste)
        moyenne = tout.mean(axis=0)
        moyenne = (moyenne / np.linalg.norm(moyenne)).astype(np.float32)
        np.save(SORTIES[voix], moyenne)
        # Cohérence : proximité moyenne de chaque phrase à l'empreinte (proche de 1 = voix stable)
        print(f"{voix} : {len(liste)} phrases → {SORTIES[voix].relative_to(RACINE)} "
              f"(cosinus moyen {float((tout @ moyenne).mean()):.3f})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
