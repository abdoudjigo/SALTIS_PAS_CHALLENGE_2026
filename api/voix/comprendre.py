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

# Conversation (bonnes manières) : le genre de phrase → ses formes, en français et en wolof. Wolof À FAIRE RELIRE.
# Une forme de plusieurs mots se cherche telle quelle ; l'ordre dit laquelle l'emporte quand une phrase en mêle plusieurs.
POLITESSE: dict[str, tuple[str, ...]] = {
    "qui": ("qui es tu", "qui etes vous", "tu es qui", "vous etes qui", "que sais tu", "que peux tu", "que pouvez vous",
            "que fais tu", "tu fais quoi", "tu sais faire", "sais tu faire", "tu peux faire", "vous pouvez faire",
            "vous savez faire", "que proposes tu", "tu peux m aider", "pouvez vous m aider", "qu est ce que tu", "tu sers a quoi", "a quoi sers tu", "comment ca marche", "aide", "aidez moi", "aide moi",
            "kan nga", "kan nga doon", "lan nga man", "lan ngay def"),
    "ca_va": ("ca va", "comment vas tu", "comment allez vous", "vous allez bien", "tu vas bien", "naka nga def", "nanga def",
              "na nga def", "naka mu", "naka sa yaram", "jamm nga am", "jamm ngeen am"),
    "merci": ("merci", "jerejef", "jarama", "dieuredieuf", "jerejef waay"),
    "au_revoir": ("au revoir", "a bientot", "a plus", "bonne journee", "bonne soiree", "bonne nuit", "bye", "ciao", "ba beneen",
                  "ba beneen yoon", "ba suba", "ba ci kanam", "fanaanal"),
    "accord": ("ok", "okay", "d accord", "dacord", "super", "parfait", "tres bien", "cool", "genial", "compris", "waaw", "baax na",
               "degg naa", "dégg naa"),
    "salut": ("bonjour", "bonsoir", "salut", "coucou", "hello", "bonne matinee", "salam", "salaam", "aleekum", "alaykoum",
              "asalaa", "asalamalekum", "assalamou", "nanga def"),
}
ORDRE_POLITESSE = ("qui", "ca_va", "merci", "au_revoir", "salut", "accord")
# Salutation employée → celle qu'on rend (on répond « Bonsoir » à « Bonsoir », « Maalekum salaam » à « Salaam aleekum »)
RETOUR_SALUT = (("salaam", "Maalekum salaam"), ("salam", "Maalekum salaam"), ("aleekum", "Maalekum salaam"),
                ("alaykoum", "Maalekum salaam"), ("asala", "Maalekum salaam"), ("assalam", "Maalekum salaam"),
                ("bonsoir", "Bonsoir"), ("bonjour", "Bonjour"), ("salut", "Salut"), ("coucou", "Bonjour"), ("hello", "Bonjour"))


def _politesse(t: str) -> str | None:
    return next((g for g in ORDRE_POLITESSE if any(_contient(t, normaliser(m)) for m in POLITESSE[g])), None)


def _salut(t: str) -> str | None:
    return next((rendu for mot, rendu in RETOUR_SALUT if re.search(rf"(?<![a-z]){mot}", t)), None)


# Mots qui désignent les bulletins eux-mêmes
MOTS_BULLETIN = ("bulletin", "anacim", "decade", "agrometeo")
# Sujets hors du champ de la plateforme (ravageurs, élevage, santé animale, fleuves, marchés) : thèmes des bulletins
# (bulletins.THEMES_HORS_CHAMP) et quelques mots de plus. Wolof À FAIRE RELIRE.
MOTS_HORS_CHAMP = ("ravageur", "chenille", "sauteriau", "criquet", "insecte", "mouton", "moutons", "chevre", "vache", "boeuf",
                   "volaille", "poulet", "peche", "poisson", "fleuve", "marche", "prix")

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
    fonctionnalite: str            # saison, semis, culture, besoins, alerte, bulletin, aide, libre, hors_champ
    code_departement: str | None
    culture: str | None
    annee: int | None
    surface_ha: float | None
    texte: str = ""                # question normalisée (bulletins, question libre)
    annee_citee: int | None = None  # année dite dans la question : seule celle-ci filtre les bulletins
    politesse: str | None = None    # qui, ca_va, merci, au_revoir, salut, accord (voir POLITESSE)
    salut: str | None = None        # salutation à rendre (« Bonjour », « Bonsoir », « Maalekum salaam »)


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


def _sujet(t: str, departement: str | None, annee: int | None) -> str:
    # bulletins importe normaliser : import différé
    from .bulletins import THEMES_HORS_CHAMP, trouver_theme

    ecran = next((f for f in ORDRE if any(_contient(t, normaliser(m)) for m in INTENTIONS[f])), None)
    theme = trouver_theme(t)
    # « Y a-t-il des chenilles ? », « le fleuve à Bakel », « mes moutons » : hors du champ, sauf semis ou engrais
    hors = theme in THEMES_HORS_CHAMP or any(re.search(rf"(?<![a-z]){m}", t) for m in MOTS_HORS_CHAMP)
    if hors and ecran not in ("semis", "besoins"):
        return "hors_champ"
    if any(_contient(t, m) for m in MOTS_BULLETIN):
        return "bulletin"
    if ecran:
        return ecran
    if theme:  # « va-t-il pleuvoir les prochains jours ? », « des conseils ? »
        return "bulletin"
    if _politesse(t):
        return "aide"
    # « Et pour Kolda ? », « Et en 2026 ? » : la suite d'une question de saison
    if departement or annee:
        return "saison"
    return "libre"


def comprendre(texte: str, departements: dict[str, str]) -> Intention:
    t = normaliser(texte)
    departement, annee = trouver_departement(t, departements), trouver_annee(t)
    return Intention(_sujet(t, departement, annee), departement, trouver_culture(t), annee, trouver_surface(t),
                     texte=texte, annee_citee=annee, politesse=_politesse(t), salut=_salut(t))
