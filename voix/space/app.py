"""Space Hugging Face « Assaman & Suuf — voix wolof » (ZeroGPU, Gradio).

Deux fonctions, appelées par l'API de la plateforme (gradio_client) :
    transcrire(audio)  → texte wolof          M-Kiriku-ASR (IA Hub Sénégal, Apache 2.0)
    parler(texte)      → audio wolof (wav)     Adia TTS (CONCREE, Apache 2.0)

Fonctionne sur ZeroGPU (rapide) ou sur processeur (gratuit, plus lent). La voix (Adia TTS) est en accès libre.
Secret facultatif HF_TOKEN : seulement pour la reconnaissance (compte ayant accepté les conditions de M-Kiriku-ASR).
Aucune voix n'est conservée : l'audio est traité puis oublié.
"""

import os

import gradio as gr
import librosa
import numpy as np
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
VOIX = "A warm and natural voice, with a conversational flow"  # description de voix (Adia TTS)
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


@spaces.GPU(duration=60)  # un texte complet (plusieurs phrases) : quelques secondes sur carte graphique
def parler(texte: str):
    """Texte wolof (200 caractères au plus par phrase) → (fréquence, signal)."""
    texte = (texte or "").strip()
    if not texte:
        return None
    morceaux, signaux = decouper(texte), []
    description = tts_tok(VOIX, return_tensors="pt").input_ids.to(APPAREIL)
    for morceau in morceaux:
        invite = tts_tok(morceau, return_tensors="pt").input_ids.to(APPAREIL)
        with torch.no_grad():
            audio = tts.generate(input_ids=description, prompt_input_ids=invite, do_sample=True, temperature=0.8)
        signaux.append(audio.cpu().numpy().squeeze())
        signaux.append(np.zeros(int(0.25 * tts.config.sampling_rate), dtype=np.float32))  # courte pause
    return tts.config.sampling_rate, np.concatenate(signaux)


def decouper(texte: str, limite: int = 200) -> list[str]:
    """Adia TTS lit 200 caractères au plus : on coupe aux fins de phrase."""
    phrases, courant = [], ""
    for phrase in texte.replace("!", ".").replace("?", ".").split("."):
        phrase = phrase.strip()
        if not phrase:
            continue
        if len(courant) + len(phrase) + 2 > limite and courant:
            phrases.append(courant)
            courant = phrase
        else:
            courant = f"{courant}. {phrase}" if courant else phrase
    if courant:
        phrases.append(courant)
    return [p[:limite] for p in phrases]


with gr.Blocks(title="Assaman & Suuf — voix wolof") as demo:
    gr.Markdown("## Assaman & Suuf — voix wolof\nReconnaissance : M-Kiriku-ASR (IA Hub Sénégal). Synthèse : Adia TTS (CONCREE).")
    with gr.Row():
        micro = gr.Audio(sources=["microphone", "upload"], type="filepath", label="Question en wolof")
        texte = gr.Textbox(label="Transcription")
    gr.Button("Transcrire").click(transcrire, micro, texte, api_name="transcrire")
    with gr.Row():
        a_dire = gr.Textbox(label="Texte wolof à dire")
        voix = gr.Audio(label="Voix", type="numpy")
    gr.Button("Parler").click(parler, a_dire, voix, api_name="parler")

# En local (voix/README.md) : http://127.0.0.1:7860, jamais exposé au réseau
demo.queue(max_size=8).launch(server_name=os.environ.get("VOIX_HOTE", "127.0.0.1"), server_port=int(os.environ.get("VOIX_PORT", "7860")))
