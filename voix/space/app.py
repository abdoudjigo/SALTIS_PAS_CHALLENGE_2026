"""Space Hugging Face « Assaman & Suuf — voix wolof » (ZeroGPU, Gradio).

Deux fonctions, appelées par l'API de la plateforme (gradio_client) :
    transcrire(audio)  → texte wolof          M-Kiriku-ASR (IA Hub Sénégal, Apache 2.0)
    parler(texte)      → audio wolof (wav)     Adia TTS (CONCREE, Apache 2.0)

Fonctionne sur ZeroGPU (rapide) ou sur processeur (gratuit, plus lent). La voix (Adia TTS) est en accès libre.
Secret facultatif HF_TOKEN : seulement pour la reconnaissance (compte ayant accepté les conditions de M-Kiriku-ASR).
Aucune voix n'est conservée : l'audio est traité puis oublié.
"""

import os
import re
import tempfile

import gradio as gr
import librosa
import numpy as np
import soundfile as sf
import torch
from parler_tts import ParlerTTSForConditionalGeneration
from transformers import (
    AutoTokenizer,
    WhisperForConditionalGeneration,
    WhisperProcessor,
)

try:  # sur Hugging Face (ZeroGPU) ; ailleurs, le décorateur ne fait rien
    import spaces
except ImportError:
    class spaces:
        @staticmethod
        def GPU(*_args, **_kwargs):
            return lambda f: f


JETON = os.environ.get("HF_TOKEN")
ASR_ID = "AIHubSN/M-Kiriku-ASR"
TTS_ID = "CONCREE/Adia_TTS"
# Description de voix (Adia TTS) : la plus nette des exemples de la fiche du modèle, pour des conseils à suivre
VOIX = "A clear and educational voice, with a flow adapted to learning"
# Réglages de génération recommandés par la fiche d'Adia TTS (CONCREE)
GENERATION = {"do_sample": True, "temperature": 0.8, "top_k": 50, "repetition_penalty": 1.2}
LIMITE_MORCEAU = 200  # Adia TTS lit 200 caractères au plus par passe
PAUSE_S = 0.25  # silence entre deux morceaux
DUREE_MAX_S = 30  # Whisper traite 30 s d'un coup : une question tient largement dedans

# ZeroGPU (carte graphique partagée) si le Space en a une, sinon processeur (gratuit, plus lent).
GPU = bool(os.environ.get("SPACES_ZERO_GPU")) or torch.cuda.is_available()
APPAREIL = "cuda" if GPU else "cpu"
TYPE = torch.float16 if GPU else torch.float32

# Voix wolof (Adia TTS, accès libre) : chargée une fois, au démarrage.
tts = ParlerTTSForConditionalGeneration.from_pretrained(TTS_ID).to(APPAREIL)
tts_tok = AutoTokenizer.from_pretrained(TTS_ID)

# Reconnaissance du wolof (M-Kiriku-ASR, accès soumis à conditions) : facultative, seulement si HF_TOKEN est donné.
processeur = asr = None
DEBUT_WOLOF: list[int] = []
if JETON:
    try:
        processeur = WhisperProcessor.from_pretrained(ASR_ID, token=JETON)
        asr = WhisperForConditionalGeneration.from_pretrained(ASR_ID, token=JETON, torch_dtype=TYPE).to(APPAREIL)
        DEBUT_WOLOF = [processeur.tokenizer.convert_tokens_to_ids(t) for t in ("<|startoftranscript|>", "<|wo|>", "<|transcribe|>", "<|notimestamps|>")]
    except Exception as exc:  # noqa: BLE001 — conditions non acceptées, jeton invalide
        print(f"Reconnaissance wolof désactivée : {exc}")


@spaces.GPU(duration=20)
def transcrire(chemin_audio: str) -> str:
    """Audio (fichier) → texte wolof."""
    if not chemin_audio or asr is None:
        return ""
    signal, _ = librosa.load(chemin_audio, sr=16000, mono=True, duration=DUREE_MAX_S)
    entrees = processeur.feature_extractor(signal, sampling_rate=16000, return_tensors="pt").input_features
    entrees = entrees.to(APPAREIL, dtype=TYPE)
    # La langue se donne par les jetons de début : l'argument language= de Whisper ne connaît pas le wolof.
    debut = torch.tensor([DEBUT_WOLOF], device=APPAREIL)
    with torch.no_grad():
        sortie = asr.generate(entrees, decoder_input_ids=debut, max_new_tokens=200)
    return processeur.tokenizer.decode(sortie[0], skip_special_tokens=True).strip()


def decouper(texte: str, limite: int = LIMITE_MORCEAU) -> list[str]:
    """Morceaux de `limite` caractères au plus, coupés aux fins de phrase, sinon aux virgules, sinon entre deux mots
    (jamais au milieu d'un mot) ; les phrases courtes voisines sont regroupées (moins de passes, voix plus liée)."""
    phrases = [p.strip() for p in re.split(r"(?<=[.!?;])\s+", texte.strip()) if p.strip()]
    pieces: list[str] = []
    for phrase in phrases:
        while len(phrase) > limite:
            coupe = phrase.rfind(",", 0, limite)
            coupe = coupe + 1 if coupe > limite // 3 else phrase.rfind(" ", 0, limite)
            if coupe <= 0:
                coupe = limite
            pieces.append(phrase[:coupe].strip())
            phrase = phrase[coupe:].strip()
        if phrase:
            pieces.append(phrase)
    morceaux: list[str] = []
    for piece in pieces:
        if morceaux and len(morceaux[-1]) + 1 + len(piece) <= limite:
            morceaux[-1] = f"{morceaux[-1]} {piece}"
        else:
            morceaux.append(piece)
    return morceaux


def _generer(morceaux: list[str]) -> list[np.ndarray]:
    """Tous les morceaux en UNE passe (lot) sur la carte graphique : le texte entier prend à peu près le temps d'un
    seul morceau. En cas d'échec du lot, morceau par morceau."""
    try:
        description = tts_tok([VOIX] * len(morceaux), return_tensors="pt", padding=True).to(APPAREIL)
        invites = tts_tok(morceaux, return_tensors="pt", padding=True).to(APPAREIL)
        with torch.no_grad():
            sortie = tts.generate(input_ids=description.input_ids, attention_mask=description.attention_mask,
                                  prompt_input_ids=invites.input_ids, prompt_attention_mask=invites.attention_mask,
                                  return_dict_in_generate=True, **GENERATION)
        return [sortie.sequences[i, : sortie.audios_length[i]].float().cpu().numpy() for i in range(len(morceaux))]
    except Exception as exc:  # noqa: BLE001 — version de parler-tts sans génération par lot
        print(f"Génération par lot impossible, morceau par morceau : {exc}")
    description = tts_tok(VOIX, return_tensors="pt").input_ids.to(APPAREIL)
    signaux = []
    for morceau in morceaux:
        invite = tts_tok(morceau, return_tensors="pt").input_ids.to(APPAREIL)
        with torch.no_grad():
            audio = tts.generate(input_ids=description, prompt_input_ids=invite, **GENERATION)
        signaux.append(audio.float().cpu().numpy().squeeze())
    return signaux


def _fichier(signal: np.ndarray, frequence: int) -> str:
    """mp3 (5 à 10 fois plus léger que le wav : vite téléchargé sur un réseau mobile), sinon wav."""
    signal = signal / max(1e-6, float(np.abs(signal).max())) * 0.9  # volume homogène, sans saturation
    for suffixe, options in ((".mp3", {"format": "MP3", "subtype": "MPEG_LAYER_III"}), (".wav", {"subtype": "PCM_16"})):
        descripteur, chemin = tempfile.mkstemp(suffix=suffixe)
        os.close(descripteur)
        try:
            sf.write(chemin, signal, frequence, **options)
            return chemin
        except Exception as exc:  # noqa: BLE001 — libsndfile sans mp3 : on garde le wav
            print(f"Écriture {suffixe} impossible : {exc}")
    raise RuntimeError("Écriture audio impossible")


@spaces.GPU(duration=30)  # un résumé entier en un lot : quelques secondes sur carte graphique ; durée courte = priorité
def parler(texte: str):
    """Texte wolof → fichier audio (mp3, sinon wav)."""
    texte = (texte or "").strip()
    if not texte:
        return None
    signaux = _generer(decouper(texte))
    frequence = tts.config.sampling_rate
    pause = np.zeros(int(PAUSE_S * frequence), dtype=np.float32)
    morceaux = [x for signal in signaux for x in (signal.astype(np.float32), pause)][:-1]
    return _fichier(np.concatenate(morceaux), frequence)


with gr.Blocks(title="Assaman & Suuf — voix wolof") as demo:
    gr.Markdown("## Assaman & Suuf — voix wolof\nReconnaissance : M-Kiriku-ASR (IA Hub Sénégal). Synthèse : Adia TTS (CONCREE).")
    with gr.Row():
        micro = gr.Audio(sources=["microphone", "upload"], type="filepath", label="Question en wolof")
        texte = gr.Textbox(label="Transcription")
    gr.Button("Transcrire").click(transcrire, micro, texte, api_name="transcrire")
    with gr.Row():
        a_dire = gr.Textbox(label="Texte wolof à dire")
        voix = gr.Audio(label="Voix", type="filepath", format="mp3")
    gr.Button("Parler").click(parler, a_dire, voix, api_name="parler")

# En local (voix/README.md) : http://127.0.0.1:7860, jamais exposé au réseau
demo.queue(max_size=8).launch(server_name=os.environ.get("VOIX_HOTE", "127.0.0.1"), server_port=int(os.environ.get("VOIX_PORT", "7860")))
