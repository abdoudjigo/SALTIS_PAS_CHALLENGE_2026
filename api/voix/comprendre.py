"""Comprendre une question : quelle fonctionnalité, quel département, quelle culture, quelle année.

Repérage de mots-clés, en wolof et en français. Il résiste aux erreurs de la reconnaissance vocale
(16 % de mots faux en wolof) : un nom de département ou de culture se reconnaît même dans une phrase mal transcrite.
"""

import difflib
import re
import unicodedata
from dataclasses import dataclass

# Mots-clés → fonctionnalité. Wolof À FAIRE RELIRE par un locuteur de l'équipe.
INTENTIONS: dict[str, tuple[str, ...]] = {
    "semis": ("ji", "jiwu", "jiyin", "kañ", "kan", "semer", "semis", "semence", "planter", "quand"),
    "besoins": ("soxla", "besoin", "engrais", "npk", "uree", "dap", "fumier", "ndawal", "ektaar", "hectare", "surface"),
    "culture": ("bey", "beykat", "ngoob", "goob", "recolte", "rendement", "culture", "cultiver", "lan laa"),
    "alerte": ("alerte", "chute", "chuter", "danger", "departements a surveiller", "surveiller", "wanniku"),
    "saison": ("taw", "nawet", "pluie", "pleuvoir", "saison", "hivernage", "meteo"),
}
ORDRE = ("semis", "besoins", "alerte", "culture", "saison")  # du plus précis au plus général

# Noms wolof (et variantes de transcription) → culture de la plateforme. À FAIRE RELIRE.
CULTURES_WOLOF: dict[str, str] = {
    "gerte": "ARACHIDE", "arachide": "ARACHIDE",
    "dugub": "MIL (SOUNA)", "suna": "MIL (SOUNA)", "souna": "MIL (SOUNA)", "mil": "MIL (SOUNA)",
    "basi": "SORGHO", "sorgho": "SORGHO",
    "mboq": "MAÏS", "mbokk": "MAÏS", "mais": "MAÏS",
    "niebe": "NIÉBÉ", "nebbe": "NIÉBÉ", "ñebbe": "NIÉBÉ",
    "ceeb": "RIZ (IRRIGUÉ)", "malo": "RIZ (IRRIGUÉ)", "riz": "RIZ (IRRIGUÉ)",
    "beref": "SÉSAME", "sesame": "SÉSAME", "bene": "SÉSAME",
    "xaal": "PASTÈQUE", "pasteque": "PASTÈQUE",
    "nambi": "MANIOC", "ñambi": "MANIOC", "manioc": "MANIOC",
    "soble": "OIGNON", "oignon": "OIGNON",
    "tamaate": "TOMATE", "tomate": "TOMATE",
    "coton": "COTON", "wiri": "COTON",
}


@dataclass
class Intention:
    fonctionnalite: str            # saison, semis, culture, besoins, alerte
    code_departement: str | None
    culture: str | None
    annee: int | None
    surface_ha: float | None


def normaliser(texte: str) -> str:
    """Minuscules, sans accents (ñ → n, ë → e), ponctuation en espaces."""
    sans = "".join(c for c in unicodedata.normalize("NFKD", texte.lower()) if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^a-z0-9.,]+", " ", sans).split())


def _contient(texte: str, mot: str) -> bool:
    return re.search(rf"(?<![a-z]){re.escape(mot)}(?![a-z])", texte) is not None


def trouver_departement(texte: str, departements: dict[str, str]) -> str | None:
    """Nom exact d'abord (« saint louis », « kaolack »), puis un mot proche (« kaolak » → Kaolack)."""
    noms = {code: normaliser(nom) for code, nom in departements.items()}
    for code, nom in sorted(noms.items(), key=lambda kv: -len(kv[1])):
        if _contient(texte, nom):
            return code
    # Nom composé dit en abrégé : « Nioro » pour Nioro du Rip, « Medina » pour Médina Yoro Foulah
    for code, nom in noms.items():
        premier = nom.split()[0]
        if " " in nom and len(premier) >= 5 and _contient(texte, premier):
            return code
    mots = [m for m in texte.split() if len(m) >= 4]
    for code, nom in noms.items():
        if " " not in nom and difflib.get_close_matches(nom, mots, n=1, cutoff=0.82):
            return code
    return None


def trouver_culture(texte: str) -> str | None:
    for mot, culture in CULTURES_WOLOF.items():
        if _contient(texte, normaliser(mot)):
            return culture
    return None


def trouver_annee(texte: str) -> int | None:
    m = re.search(r"\b(19[89]\d|20[0-4]\d)\b", texte)
    return int(m.group(1)) if m else None


def trouver_surface(texte: str) -> float | None:
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:ha|hectare|hectares|ektaar)\b", texte)
    return float(m.group(1).replace(",", ".")) if m else None


def comprendre(texte: str, departements: dict[str, str]) -> Intention:
    t = normaliser(texte)
    fonctionnalite = next((f for f in ORDRE if any(_contient(t, normaliser(m)) for m in INTENTIONS[f])), "saison")
    return Intention(fonctionnalite, trouver_departement(t, departements), trouver_culture(t), trouver_annee(t), trouver_surface(t))
