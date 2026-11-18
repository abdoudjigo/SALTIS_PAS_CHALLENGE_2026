"""Nombres en toutes lettres, en wolof, pour la synthèse vocale (Adia TTS lit mal les chiffres).

À FAIRE RELIRE par un locuteur wolof de l'équipe : formes liées (« ñaari téeméer »), « fanweer » pour 30,
liaison « ak » entre les rangs.
"""

UNITES = ["", "benn", "ñaar", "ñett", "ñeent", "juróom", "juróom-benn", "juróom-ñaar", "juróom-ñett", "juróom-ñeent"]
# Forme liée devant « téeméer » / « junni » : ñaar → ñaari, ñett → ñetti…
LIEES = ["", "", "ñaari", "ñetti", "ñeenti", "juróomi", "juróom-benni", "juróom-ñaari", "juróom-ñetti", "juróom-ñeenti"]
DIZAINES = ["", "fukk", "ñaar-fukk", "fanweer", "ñeent-fukk", "juróom-fukk", "juróom-benn-fukk", "juróom-ñaar-fukk",
            "juróom-ñett-fukk", "juróom-ñeent-fukk"]


def _moins_de_cent(n: int) -> list[str]:
    d, u = divmod(n, 10)
    return [m for m in (DIZAINES[d], UNITES[u]) if m]


def _moins_de_mille(n: int) -> list[str]:
    c, reste = divmod(n, 100)
    parties = [] if c == 0 else (["téeméer"] if c == 1 else [f"{LIEES[c]} téeméer"])
    return parties + _moins_de_cent(reste)


def en_lettres(n: float) -> str:
    """Entier positif (arrondi) → wolof, rangs reliés par « ak ». 0 → « tus »."""
    n = round(n)
    if n == 0:
        return "tus"
    if n < 0:
        return "mines " + en_lettres(-n)
    k, reste = divmod(n, 1000)
    parties = []
    if k:
        if k == 1:
            parties.append("junni")
        elif k < 10:
            parties.append(f"{LIEES[k]} junni")
        else:
            parties.append(f"{' ak '.join(_moins_de_mille(k))} junni")
    parties += _moins_de_mille(reste)
    return " ak ".join(parties)
