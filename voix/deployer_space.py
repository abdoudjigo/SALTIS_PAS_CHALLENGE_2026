"""Met en ligne le Space « voix wolof » sur ton compte Hugging Face, en une commande.

    1. Sur https://huggingface.co/settings/tokens : créer un jeton de type « Write ».
    2. Dans le .env à la racine du dépôt : HF_TOKEN=hf_…   (jamais dans git, ne pas le coller dans un chat)
    3. Depuis la racine :  venv/bin/python -m voix.deployer_space

Le script crée (ou met à jour) le Space <ton-compte>/assaman-suuf-voix, y dépose voix/space/, demande la carte
graphique gratuite ZeroGPU (sinon le processeur gratuit) et écrit VOIX_SPACE dans .env. Le Space est public :
il ne contient que du code et des modèles publics, aucune donnée.
"""

import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from huggingface_hub import HfApi

RACINE = Path(__file__).resolve().parents[1]
NOM = os.environ.get("HF_SPACE_NOM", "assaman-suuf-voix")


def ecrire_env(cle: str, valeur: str) -> None:
    fichier = RACINE / ".env"
    texte = fichier.read_text() if fichier.exists() else ""
    ligne = f"{cle}={valeur}"
    texte = re.sub(rf"^{cle}=.*$", ligne, texte, flags=re.MULTILINE) if re.search(rf"^{cle}=", texte, flags=re.MULTILINE) else texte.rstrip("\n") + f"\n{ligne}\n"
    fichier.write_text(texte)


def main() -> int:
    load_dotenv(RACINE / ".env")
    jeton = os.environ.get("HF_TOKEN", "").strip()
    if not jeton:
        print("HF_TOKEN manquant dans .env (jeton « Write » de https://huggingface.co/settings/tokens).")
        return 1
    api = HfApi(token=jeton)
    compte = api.whoami()["name"]
    depot = f"{compte}/{NOM}"
    print(f"Compte : {compte} · Space : {depot}")

    api.create_repo(depot, repo_type="space", space_sdk="gradio", exist_ok=True, private=False)
    api.upload_folder(folder_path=str(RACINE / "voix" / "space"), repo_id=depot, repo_type="space",
                      commit_message="Assaman & Suuf : voix wolof (Adia TTS)")
    print("Fichiers déposés.")

    for materiel in ("zero-a10g", "cpu-basic"):
        try:
            api.request_space_hardware(depot, materiel)
            print(f"Matériel demandé : {materiel}")
            break
        except Exception as exc:  # noqa: BLE001 — ZeroGPU réservé aux comptes éligibles (e-mail vérifié, plus de 30 jours) ou PRO
            print(f"{materiel} indisponible : {str(exc).splitlines()[0][:160]}")

    ecrire_env("VOIX_SPACE", depot)
    print(f"\nVOIX_SPACE={depot} écrit dans .env.")
    print(f"Suivre la construction : https://huggingface.co/spaces/{depot} (premier démarrage : quelques minutes).")
    print("Ensuite : relancer l'API (venv/bin/python -m api), puis appuyer sur la mascotte WLF.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
