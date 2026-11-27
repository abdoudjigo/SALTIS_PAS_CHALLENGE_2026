"""Bulletins agrométéorologiques décadaires de l'ANACIM (texte extrait des PDF) → base compacte de l'assistant.

Entrée : data/text/anacim/bulletin_dec{1,2,3}_{mois}_{année}.txt (non versionné, hors Git).
Sortie : api/voix/bulletins_anacim.json.gz (versionnée, ~200 Ko), lue par api/voix/bulletins.py.

Chaque bulletin donne : sa décade (dates), son sommaire (une ligne par thème) et ses sections
(pluie, perspectives, hydrologie, phytosanitaire, pastorale, zoo-sanitaire, marchés, recommandations…).
Le texte est celui de l'ANACIM, nettoyé (coupures de mots, en-têtes de page) ; rien n'est résumé ni inventé.

    python ingestion/collecte/bulletins_anacim/construire.py
"""

import gzip
import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[3]
ENTREE = RACINE / "data" / "text" / "anacim"
SORTIE = RACINE / "api" / "voix" / "bulletins_anacim.json.gz"

MOIS = {"janvier": 1, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6, "juillet": 7, "aout": 8,
        "septembre": 9, "octobre": 10, "novembre": 11, "decembre": 12}
FIN_MOIS = {1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30, 7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31}

# Titre de section (début de ligne) → thème. L'ordre compte : le plus précis d'abord.
TITRES: list[tuple[str, str]] = [
    (r"(?:situation )?pluviom[ée]tri(?:que|e)", "pluie"),
    (r"perspectives?\b", "perspectives"),
    (r"situation hydrologique", "hydrologie"),
    (r"situation phytosanitaire", "phytosanitaire"),
    (r"situation pastorale", "pastorale"),
    (r"situation zoo[- ]?sanitaire", "zoosanitaire"),
    (r"situation des march[ée]s", "marches"),
    (r"situation agricole|situation des cultures", "agricole"),
    (r"suivi de la v[ée]g[ée]tation", "vegetation"),
    (r"recommandations?|conseils agricoles", "recommandations"),
]
# Un titre occupe sa ligne ; « Situation pastorale : faible fourrage… » est une ligne du sommaire, pas un titre
MOTIF_TITRE = re.compile(r"^\s*(" + "|".join(m for m, _ in TITRES) + r")(?![^\n]*:\s*\S)[^\n]{0,90}$", re.IGNORECASE | re.MULTILINE)
BRUIT = [
    re.compile(r"^.*Agence Nationale de l.Aviation Civile.*$", re.MULTILINE),
    re.compile(r"^\s*Page \d+.*$", re.MULTILINE),
    re.compile(r"^\s*Groupe de Travail Pluridisciplinaire\s*$", re.MULTILINE),
    re.compile(r"^\s*Cadre National d[e]?s? Services\s*$", re.MULTILINE),
    re.compile(r"^\s*Climatologiques\s*$", re.MULTILINE),
    re.compile(r"^\s*\(suite\)\s*$", re.MULTILINE),
]


def theme_de(titre: str) -> str:
    for motif, theme in TITRES:
        if re.match(motif, titre.strip(), re.IGNORECASE):
            return theme
    return "autre"


def nettoyer(texte: str) -> str:
    """Recolle les mots coupés en fin de ligne (« poi-\\nlue »), retire les puces et les espaces en trop."""
    texte = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", texte)
    texte = re.sub(r"[•▪●◦]", " ", texte)
    texte = texte.replace("’", "'").replace(" ", " ")
    return re.sub(r"\s+", " ", texte).strip()


def phrases(texte: str) -> list[str]:
    return [p.strip() for p in re.split(r"(?<=[.;!?])\s+(?=[A-ZÉÈÀÂ«(])", texte) if len(p.strip()) > 2]


def periode(nom: str) -> dict | None:
    m = re.match(r"bulletin_dec([123])_([a-zé]+)_(\d{4})\.txt$", nom)
    if not m:
        return None
    decade, mois_nom, annee = int(m.group(1)), m.group(2).replace("é", "e").replace("û", "u"), int(m.group(3))
    mois = MOIS[mois_nom]
    debut = 1 + 10 * (decade - 1)
    fin = FIN_MOIS[mois] if decade == 3 else debut + 9
    return {"annee": annee, "mois": mois, "decade": decade, "debut": f"{annee}-{mois:02d}-{debut:02d}",
            "fin": f"{annee}-{mois:02d}-{fin:02d}", "numero_decade_annee": 3 * (mois - 1) + decade}


def sans_bruit(brut: str) -> str:
    for motif in BRUIT:
        brut = motif.sub("", brut)
    return brut


def sommaire(brut: str) -> list[dict]:
    """Les lignes du sommaire (« Météo : … », « Hydrologie : … »), entre « Sommaire » et la première section."""
    brut = sans_bruit(brut)
    debut = re.search(r"Sommaire", brut, re.IGNORECASE)
    if not debut:
        return []
    suite = brut[debut.end():]
    titre = MOTIF_TITRE.search(suite)
    texte = nettoyer(suite[: titre.start()] if titre else suite[:2500])
    morceaux = re.split(r"\s(?=(?:M[ée]t[ée]o|Hydrologie|Protection des v[ée]g[ée]taux|Situation [a-zé -]+?|Elevage|Élevage|"
                        r"Suivi de la v[ée]g[ée]tation|Agricul\w*|March[ée]s|Sant[ée] animale|Phytosanitaire)\s*:)", " " + texte)
    lignes = []
    for morceau in morceaux:
        if ":" not in morceau:
            continue
        theme, _, contenu = morceau.partition(":")
        contenu = contenu.strip(" ;.")
        if len(contenu) > 5:
            lignes.append({"theme": theme.strip(), "texte": contenu[:400]})
    return lignes


def sections(brut: str) -> dict[str, str]:
    """Texte de chaque thème ; un thème coupé sur plusieurs pages (« (suite) ») est recollé."""
    corps = sans_bruit(brut)
    titres = list(MOTIF_TITRE.finditer(corps))
    resultat: dict[str, list[str]] = {}
    for i, t in enumerate(titres):
        fin = titres[i + 1].start() if i + 1 < len(titres) else len(corps)
        texte = nettoyer(corps[t.end():fin])
        theme = theme_de(t.group(1))
        if theme == "perspectives":
            texte = nettoyer(t.group(0)) + " : " + texte
        if len(texte) > 30:
            resultat.setdefault(theme, []).append(texte)
    return {k: " ".join(v) for k, v in resultat.items()}


def construire(entree: Path = ENTREE) -> list[dict]:
    bulletins = []
    for f in sorted(entree.glob("bulletin_dec*.txt")):
        p = periode(f.name)
        if not p:
            continue
        brut = f.read_text(encoding="utf-8", errors="replace")
        bulletins.append({**p, "fichier": f.name, "sommaire": sommaire(brut), "sections": sections(brut)})
    bulletins.sort(key=lambda b: (b["annee"], b["numero_decade_annee"]))
    return bulletins


def main() -> int:
    if not ENTREE.exists():
        print(f"Dossier absent : {ENTREE}", file=sys.stderr)
        return 1
    bulletins = construire()
    SORTIE.write_bytes(gzip.compress(json.dumps(bulletins, ensure_ascii=False, separators=(",", ":")).encode(), mtime=0))
    vides = [b["fichier"] for b in bulletins if not b["sections"]]
    print(f"{len(bulletins)} bulletins → {SORTIE.relative_to(RACINE)} ({SORTIE.stat().st_size // 1024} Ko)")
    print(f"Période : {bulletins[0]['debut']} → {bulletins[-1]['fin']}")
    if vides:
        print(f"Sans section reconnue : {', '.join(vides)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
