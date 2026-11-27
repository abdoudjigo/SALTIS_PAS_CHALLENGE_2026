"""Bulletins agrométéorologiques décadaires de l'ANACIM (juin 2023 → août 2026), pour l'assistant.

Base : bulletins_anacim.json.gz, produite par ingestion/collecte/bulletins_anacim/construire.py à partir des PDF
de l'ANACIM. Le texte est celui des bulletins : l'assistant le cite, il ne le résume pas avec ses propres mots.

- `choisir` : le bulletin demandé (mois, année, décade) ou, à défaut, le plus récent ;
- `extrait` : ce que dit ce bulletin sur un thème (pluie, ravageurs, bétail, marchés…) et, si on l'a nommé, sur un lieu ;
- `chercher` : les passages les plus proches d'une question libre (BM25), dans tous les bulletins.
"""

import gzip
import json
import math
import re
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from .comprendre import normaliser

FICHIER = Path(__file__).with_name("bulletins_anacim.json.gz")
MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
MOIS_WO = ["samwiye", "fewriye", "mars", "awril", "me", "suwe", "sulet", "ut", "sektàmbar", "oktoobar", "nowàmbar", "desàmbar"]
LONGUEUR_REPONSE = 520  # caractères tirés du bulletin : 3 phrases environ, le temps d'une écoute

# Thème → (mots de la question, sections du bulletin dans l'ordre de préférence, ligne du sommaire)
# Mots wolof À FAIRE RELIRE par un locuteur de l'équipe.
THEMES: dict[str, tuple[tuple[str, ...], tuple[str, ...], tuple[str, ...]]] = {
    "phytosanitaire": (("ravageur", "chenille", "criquet", "sauteriau", "oiseau", "granivore", "insecte", "maladie des plantes",
                        "phytosanitaire", "picc", "gunoor", "gunóor", "lema", "iule", "mange les cultures"),
                       ("phytosanitaire", "agricole"), ("phyto", "protection")),
    "pastorale": (("betail", "bétail", "élevage", "elevage", "éleveur", "eleveur", "berger", "troupeau", "paturage", "pâturage", "fourrage", "transhumance",
                   "nag", "xar", "jur", "animaux"),
                  ("pastorale", "vegetation", "zoosanitaire"), ("pastoral", "elevage", "élevage")),
    "zoosanitaire": (("maladie animale", "vaccin", "zoo", "epizootie", "peste", "fievre", "fièvre", "dermatose"),
                     ("zoosanitaire",), ("zoo", "santé animale")),
    "hydrologie": (("fleuve", "crue", "inondation", "plan d'eau", "hydrologie", "niveau d'eau", "dex", "kidira", "bakel", "gambie",
                    "casamance", "faleme", "falémé"),
                   ("hydrologie",), ("hydrolog",)),
    "marches": (("marché", "marche", "prix du", "prix des", "soudure", "céréales au marché", "njëg", "jënd"),
                ("marches",), ("march",)),
    "recommandations": (("conseil", "recommand", "digle"),
                        ("recommandations",), ()),
    "perspectives": (("prochaine", "prochains jours", "à venir", "va pleuvoir", "pleuvra", "prévision", "perspective",
                      "dinañu", "dina tàw", "dina taw", "ëllëg", "ellëg"),
                     ("perspectives",), ()),
    "pluie": (("pluie", "pluviom", "il a plu", "a t il plu", "tombé", "cumul", "taw", "tàw", "météo", "meteo"),
              ("pluie", "perspectives"), ("météo", "meteo")),
}
ORDRE_THEMES = ("recommandations", "zoosanitaire", "phytosanitaire", "pastorale", "hydrologie", "marches", "perspectives", "pluie")
THEMES_FR = {"phytosanitaire": "ravageurs des cultures", "pastorale": "élevage et pâturages", "zoosanitaire": "santé animale",
             "hydrologie": "fleuves", "marches": "marchés", "recommandations": "conseils", "perspectives": "prévisions",
             "pluie": "pluie", "sommaire": "l'essentiel"}
THEMES_WO = {"phytosanitaire": "gunóor yiy yàq tool yi", "pastorale": "jur ak parcours", "zoosanitaire": "wér-gi-yaramu jur",
             "hydrologie": "dex yi", "marches": "marse yi", "recommandations": "digle yi", "perspectives": "li ñuy xaar",
             "pluie": "taw bi", "sommaire": "li ëpp solo"}


# Hors du champ d'Assaman & Suuf : ravageurs, élevage, santé animale, fleuves, marchés. L'assistant n'en parle pas,
# même quand le bulletin en parle (seuls la pluie, l'agriculture, les prévisions et les conseils sont cités).
SECTIONS_HORS_CHAMP = frozenset({"phytosanitaire", "pastorale", "zoosanitaire", "hydrologie", "marches", "vegetation"})
THEMES_HORS_CHAMP = ("phytosanitaire", "pastorale", "zoosanitaire", "hydrologie", "marches")
SOMMAIRE_HORS_CHAMP = ("hydrolog", "vegetation", "pastoral", "elevage", "march", "phyto", "protection des vegetaux")
# Mots qui, dans une phrase d'une section gardée, la font écarter (« attaques de chenilles » dans « agricole »)
MOTS_HORS_CHAMP = tuple(normaliser(m) for t in ("phytosanitaire", "pastorale", "zoosanitaire", "marches") for m in THEMES[t][0]) + (
    "fleuve", "crue", "plan d'eau", "hydrolog", "niveau d'eau", "station hydrom", "ravageur", "cheptel", "chenille", "sauteriau",
    "mouton", "chevre", "bovin", "ovin", "caprin", "volaille", "pature", "fourrage", "comites de lutte", "lutte villageois",
    "lutte contre", "protection des vegetaux", "protection des cultures", "traitement phyto", "pesticide", "insecticide")


def hors_champ(phrase: str) -> bool:
    t = normaliser(phrase)
    return any(re.search(rf"(?<![a-z]){re.escape(normaliser(m))}", t) for m in MOTS_HORS_CHAMP)


def phrases_gardees(b: "Bulletin", section: str) -> list[str]:
    if section in SECTIONS_HORS_CHAMP:
        return []
    return [p for p in phrases(b.sections.get(section, "")) if not hors_champ(p)]


def sommaire_garde(b: "Bulletin") -> list[dict]:
    return [s for s in b.sommaire if not any(m in normaliser(s["theme"]) for m in SOMMAIRE_HORS_CHAMP) and not hors_champ(s["texte"])]


@dataclass
class Bulletin:
    annee: int
    mois: int
    decade: int
    debut: str
    fin: str
    numero_decade_annee: int
    fichier: str
    sommaire: list[dict]
    sections: dict[str, str]

    @property
    def periode_fr(self) -> str:
        j1, j2 = int(self.debut[-2:]), int(self.fin[-2:])
        return f"du {'1er' if j1 == 1 else j1} au {j2} {MOIS_FR[self.mois - 1]} {self.annee}"

    @property
    def mois_wo(self) -> str:
        return MOIS_WO[self.mois - 1]


@dataclass
class Passage:
    bulletin: Bulletin
    theme: str
    texte: str


@lru_cache(maxsize=1)
def charger() -> tuple[Bulletin, ...]:
    if not FICHIER.exists():
        return ()
    return tuple(Bulletin(**b) for b in json.loads(gzip.decompress(FICHIER.read_bytes())))


def disponibles() -> bool:
    return bool(charger())


def etendue_fr() -> str:
    """« de juin 2023 à août 2026 » : la période couverte par la base."""
    tous = charger()
    return f"de {MOIS_FR[tous[0].mois - 1]} {tous[0].annee} à {MOIS_FR[tous[-1].mois - 1]} {tous[-1].annee}" if tous else ""


def trouver_theme(texte_normalise: str) -> str | None:
    for theme in ORDRE_THEMES:
        if any(re.search(rf"(?<![a-z]){re.escape(normaliser(m))}", texte_normalise) for m in THEMES[theme][0]):
            return theme
    return None


def trouver_mois(texte_normalise: str) -> int | None:
    """Mois nommé en français ou en wolof (noms wolof de 4 lettres au moins : « me », « ut » sont trop ambigus)."""
    for i, (fr, wo) in enumerate(zip(MOIS_FR, MOIS_WO, strict=True)):
        noms = {normaliser(fr)} | ({normaliser(wo)} if len(wo) >= 4 else set())
        if any(re.search(rf"(?<![a-z]){n}(?![a-z])", texte_normalise) for n in noms):
            return i + 1
    return None


def trouver_decade(texte_normalise: str) -> int | None:
    if re.search(r"premiere decade|1re decade|1ere decade|debut (du mois|de)", texte_normalise):
        return 1
    if re.search(r"deuxieme decade|2e decade|2eme decade|milieu (du mois|de)", texte_normalise):
        return 2
    if re.search(r"troisieme decade|3e decade|3eme decade|derniere decade|fin (du mois|de)", texte_normalise):
        return 3
    return None


def choisir(annee: int | None = None, mois: int | None = None, decade: int | None = None) -> Bulletin | None:
    """Le bulletin le plus récent qui correspond à la demande ; sans précision, le dernier publié."""
    candidats = [b for b in charger() if (annee is None or b.annee == annee) and (mois is None or b.mois == mois)
                 and (decade is None or b.decade == decade)]
    return candidats[-1] if candidats else None


def phrases(texte: str) -> list[str]:
    return [p.strip() for p in re.split(r"(?<=[.;!?])\s+(?=[A-ZÉÈÀÂ«(])", texte) if len(p.strip()) > 15]


def couper(phrases: list[str], maxi: int = LONGUEUR_REPONSE) -> str:
    morceaux, total = [], 0
    for p in phrases:
        if morceaux and total + len(p) > maxi:
            break
        morceaux.append(p if len(p) <= maxi else p[: maxi].rsplit(" ", 1)[0] + "…")
        total += len(p) + 1
    return " ".join(morceaux)


def extrait(b: Bulletin, theme: str | None, lieux: tuple[str, ...] = ()) -> tuple[str, str]:
    """(thème retenu, texte tiré du bulletin). Un lieu nommé : d'abord les phrases qui le citent."""
    if theme is None:
        lignes = [f"{s['theme']} : {s['texte'].rstrip('.')}." for s in sommaire_garde(b)[:4]]
        if lieux:  # un lieu sans thème : les phrases du bulletin qui le citent, toutes sections gardées confondues
            cites = [p for t in ("pluie", "agricole", "perspectives")
                     for p in phrases_gardees(b, t) if any(_cite(p, lieu) for lieu in lieux)]
            if cites:
                return "lieu", couper(cites)
        return "sommaire", couper(lignes)
    # La première section du thème qui a du texte (« phytosanitaire » avant « agricole », plus générale)
    du_theme = next((phrases_gardees(b, s) for s in THEMES[theme][1] if phrases_gardees(b, s)), [])
    if lieux:
        cites = [p for p in du_theme if any(_cite(p, lieu) for lieu in lieux)]
        if cites:
            return theme, couper(cites)
    ligne = next((s for s in sommaire_garde(b) if any(m in normaliser(s["theme"]) for m in THEMES[theme][2])), None)
    debut = [f"{ligne['texte'].rstrip('.')}."] if ligne else []
    if not du_theme and not debut:
        return theme, ""
    return theme, couper(debut + du_theme)


# Mots de la question qui ne précisent rien (on les retrouve dans toutes les réponses d'un thème)
MOTS_GENERIQUES = frozenset(["bulletin", "anacim", "decade", "dernier", "derniere", "moment", "semaine", "jours", "ravageurs", "ravageur", "cultures", "culture", "situation", "actuellement", "maintenant", "cette"])


def mots_precis(question: str) -> set[str]:
    """« chenille », « légionnaire », « Bakel » : ce que la réponse doit contenir pour répondre vraiment."""
    return {m for m in mots(question) if len(m) >= 5 and m not in MOTS_GENERIQUES}


def _cite(phrase: str, lieu: str) -> bool:
    return re.search(rf"(?<![a-z]){re.escape(normaliser(lieu))}(?![a-z])", normaliser(phrase)) is not None


# ---- Recherche libre (BM25) dans tous les bulletins ----

MOTS_VIDES = frozenset("""
le la les l de des du d un une et ou a au aux en dans sur pour par avec est sont ce cette ces qui que quoi quel quelle
quels quelles il elle ils elles on se sa son ses leur leurs ne pas plus moins tres y as ai je tu nous vous me te mon ma
mes ton ta tes comment combien quand pourquoi cest c qu dit dire fait faire bien aussi bon bonne bons faut peut etre avoir
tout tous toute toutes mon mien chez quoi lequel laquelle pendant avant apres depuis entre contre sans sous
""".split())  # noqa: SIM905


def mots(texte: str) -> list[str]:
    return [m for m in normaliser(texte).replace(",", " ").replace(".", " ").split() if len(m) > 2 and m not in MOTS_VIDES]


@lru_cache(maxsize=1)
def _index():
    passages: list[Passage] = []
    for b in charger():
        for theme in b.sections:
            courant: list[str] = []
            for p in phrases_gardees(b, theme):
                courant.append(p)
                if sum(len(x) for x in courant) > 450:
                    passages.append(Passage(b, theme, " ".join(courant)))
                    courant = []
            if courant:
                passages.append(Passage(b, theme, " ".join(courant)))
    sacs = [Counter(mots(p.texte)) for p in passages]
    df = Counter(m for s in sacs for m in s)
    moyenne = sum(sum(s.values()) for s in sacs) / max(1, len(sacs))
    return passages, sacs, df, moyenne


def rarete(termes: set[str]) -> float:
    """Poids des mots (IDF) : « transhumance » pèse plus que « protéger », qu'on lit partout."""
    passages, _, df, _ = _index()
    return sum(math.log(1 + len(passages) / (1 + df.get(t, 0))) for t in termes)


def chercher(question: str, n: int = 4, recents_d_abord: bool = True) -> list[tuple[float, Passage]]:
    """Les passages les plus proches de la question (BM25, k1 = 1,5, b = 0,75), les plus récents favorisés."""
    passages, sacs, df, moyenne = _index()
    if not passages:
        return []
    termes = set(mots(question))
    total = len(passages)
    dernier = passages[-1].bulletin.annee
    notes = []
    for p, sac in zip(passages, sacs, strict=True):
        longueur = sum(sac.values())
        note = 0.0
        for t in termes:
            f = sac.get(t, 0)
            if f:
                idf = math.log(1 + (total - df[t] + 0.5) / (df[t] + 0.5))
                note += idf * f * 2.5 / (f + 1.5 * (0.25 + 0.75 * longueur / moyenne))
        if note > 0:
            if recents_d_abord:
                note *= 1 + 0.08 * (p.bulletin.annee - dernier + 3)  # 2026 : ×1,24 ; 2023 : ×1,0
            notes.append((note, p))
    notes.sort(key=lambda x: -x[0])
    return notes[:n]
