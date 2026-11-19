"""Étape 1 de la carte des opportunités : télécharger les sources « eau » et les ramener à une ligne par département.

Pourquoi : les sources (BGS, FAO GMIA) sont des grilles couvrant toute l'Afrique ou le monde. L'API et dbt
travaillent par département. Ce script fait le passage grille → département une fois pour toutes, et produit
des CSV de 45 lignes, chargés ensuite dans SALTIS.RAW comme les autres tables du projet.

Sorties (data/modules/, non versionné) :
    e_eau_souterraine_departement.csv   nappes : profondeur, débit des forages, stock (BGS)
    e_irrigation_departement.csv        irrigation déjà en place vers 2005 (FAO GMIA v5)

Usage, depuis la racine du dépôt :
    venv/bin/python -m ingestion.collecte.eau.preparer_eau              # télécharge ce qui manque, puis prépare
    venv/bin/python -m ingestion.collecte.eau.preparer_eau --hors-ligne # prépare avec les fichiers déjà présents

Les cartes BGS ne sont pas téléchargeables par un lien direct stable : les déposer à la main dans data/raw/eau/bgs/
(voir docs/carte-opportunites.md, étape 1). Le script reconnaît les fichiers à leur nom (depth, productivity, storage),
en .zip ou en .txt.

Méthode : un point de grille (centre de cellule) appartient au département dont le contour GADM le contient.
Un département trop petit pour contenir un point (Dakar, Guédiawaye, Pikine) reçoit le point le plus proche
de son centre, et la colonne point_le_plus_proche le signale.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
import zipfile
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

RACINE = Path(__file__).resolve().parents[3]
BRUT = RACINE / "data" / "raw" / "eau"
SORTIE = RACINE / "data" / "modules"
REFERENTIEL = RACINE / "data" / "referentiels" / "departements_zones_agroecologiques.csv"

# Emprise du Sénégal, avec une marge (degrés, WGS 84)
OUEST, EST, SUD, NORD = -17.7, -11.2, 12.2, 16.8

SOURCES = {
    "gadm": ("https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_SEN_2.json", BRUT / "gadm41_SEN_2.json"),
    "aei_pct": ("https://firebasestorage.googleapis.com/v0/b/fao-aquastat.appspot.com/o/GIS%2Fgmia_v5_aei_pct_asc.zip"
                "?alt=media&token=e448ce53-296f-4756-90c1-75c87f74e569", BRUT / "gmia" / "gmia_v5_aei_pct_asc.zip"),
    "aei_ha": ("https://firebasestorage.googleapis.com/v0/b/fao-aquastat.appspot.com/o/GIS%2Fgmia_v5_aei_ha_asc.zip"
               "?alt=media&token=416b27f5-fcb5-4178-ab49-1658d5c2c3ad", BRUT / "gmia" / "gmia_v5_aei_ha_asc.zip"),
    "aai_pct_aei": ("https://firebasestorage.googleapis.com/v0/b/fao-aquastat.appspot.com/o/GIS%2Fgmia_v5_aai_pct_aei_asc.zip"
                    "?alt=media&token=9c2d8e5a-2e3e-4bee-9df2-08c1c234b1d5", BRUT / "gmia" / "gmia_v5_aai_pct_aei_asc.zip"),
    "aeigw_pct_aei": ("https://firebasestorage.googleapis.com/v0/b/fao-aquastat.appspot.com/o/GIS%2Fgmia_v5_aeigw_pct_aei_asc.zip"
                      "?alt=media&token=ee5bd6d1-c8e2-44fd-a4cf-58d7563abbf6", BRUT / "gmia" / "gmia_v5_aeigw_pct_aei_asc.zip"),
    "aeisw_pct_aei": ("https://firebasestorage.googleapis.com/v0/b/fao-aquastat.appspot.com/o/GIS%2Fgmia_v5_aeisw_pct_aei_asc.zip"
                      "?alt=media&token=38b7da06-ddfa-4500-90df-2db65e27c9a7", BRUT / "gmia" / "gmia_v5_aeisw_pct_aei_asc.zip"),
}
PAGE_BGS = "https://www.bgs.ac.uk/groundwater/?p=5887"

# Classes des cartes BGS (MacDonald et al. 2012) : code → (libellé, valeur représentative)
PROFONDEUR = {  # profondeur de la nappe, mètres
    "VS": ("0-7 m", 3.5), "S": ("7-25 m", 16.0), "SM": ("25-50 m", 37.5),
    "M": ("50-100 m", 75.0), "D": ("100-250 m", 175.0), "VD": ("plus de 250 m", 300.0),
}
PRODUCTIVITE = {  # débit qu'on peut attendre d'un forage bien implanté, litres par seconde
    "VH": ("plus de 20 L/s", 25.0), "H": ("5-20 L/s", 12.5), "M": ("1-5 L/s", 3.0),
    "LM": ("0,5-1 L/s", 0.75), "L": ("0,1-0,5 L/s", 0.3), "VL": ("moins de 0,1 L/s", 0.05),
}
STOCK = {  # eau stockée dans l'aquifère, millimètres d'eau
    "0": ("aucun", 0.0), "L": ("moins de 1 000 mm", 500.0), "LM": ("1 000-10 000 mm", 5500.0),
    "M": ("10 000-25 000 mm", 17500.0), "H": ("25 000-50 000 mm", 37500.0), "VH": ("plus de 50 000 mm", 60000.0),
}
NOMS_LONGS = {
    "VERYSHALLOW": "VS", "SHALLOW": "S", "SHALLOWMODERATE": "SM", "MODERATE": "M", "DEEP": "D", "VERYDEEP": "VD",
    "VERYHIGH": "VH", "HIGH": "H", "LOWMODERATE": "LM", "LOW": "L", "VERYLOW": "VL", "NONE": "0",
}
PEU_PROFONDE = {"VS", "S"}          # nappe à 25 m au plus : puits ou forage peu coûteux
DEBIT_SUFFISANT = {"M", "H", "VH"}  # au moins 1 L/s : de quoi irriguer un périmètre maraîcher


# ------------------------------------------------------------------ téléchargement


def telecharger(hors_ligne: bool) -> None:
    for nom, (url, fichier) in SOURCES.items():
        if fichier.exists():
            continue
        if hors_ligne:
            raise SystemExit(f"{fichier.relative_to(RACINE)} absent (mode --hors-ligne)")
        fichier.parent.mkdir(parents=True, exist_ok=True)
        print(f"Téléchargement {nom} → {fichier.relative_to(RACINE)}")
        requete = urllib.request.Request(url, headers={"User-Agent": "saltis-akai/1.0"})
        with urllib.request.urlopen(requete, timeout=300) as reponse:
            fichier.write_bytes(reponse.read())


def fichier_bgs(mot: str) -> Path | None:
    dossier = BRUT / "bgs"
    candidats = sorted(p for p in dossier.glob("*") if mot in p.name.lower() and p.suffix.lower() in {".zip", ".txt", ".xyz", ".csv"})
    return candidats[0] if candidats else None


def lire_texte(fichier: Path, extensions: tuple[str, ...]) -> str:
    """Contenu texte d'un fichier, ou du premier fichier utile d'une archive (le readme est ignoré)."""
    if fichier.suffix.lower() != ".zip":
        return fichier.read_text(encoding="latin-1")
    with zipfile.ZipFile(fichier) as z:
        noms = [n for n in z.namelist() if n.lower().endswith(extensions) and "readme" not in n.lower()]
        if not noms:
            raise SystemExit(f"{fichier.name} : aucun fichier {extensions} dans l'archive ({z.namelist()})")
        # La grille elle-même : « xyzASCII_… » si présent, sinon le plus gros fichier (pas les notes d'accompagnement)
        grilles = [n for n in noms if "xyzascii" in n.lower()]
        nom = grilles[0] if grilles else max(noms, key=lambda n: z.getinfo(n).file_size)
        return z.read(nom).decode("latin-1")


# ------------------------------------------------------------------ géométrie


def charger_departements() -> list[dict]:
    """Contours GADM niveau 2 : [{code, nom, anneaux: [array (n, 2)], centre: (x, y)}]."""
    donnees = json.loads(SOURCES["gadm"][1].read_text(encoding="utf-8"))
    departements = []
    for f in donnees["features"]:
        geom = f["geometry"]
        polygones = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        anneaux = [np.asarray(anneau, dtype=float)[:, :2] for polygone in polygones for anneau in polygone]
        exterieurs = np.vstack([np.asarray(p[0], dtype=float)[:, :2] for p in polygones])
        departements.append({
            "code": f["properties"]["GID_2"],
            "nom": f["properties"]["NAME_2"],
            "anneaux": anneaux,
            "centre": tuple(exterieurs.mean(axis=0)),
        })
    attendus = set(pd.read_csv(REFERENTIEL)["code"])
    trouves = {d["code"] for d in departements}
    if attendus != trouves:
        raise SystemExit(f"Codes GADM différents du référentiel : manquants {sorted(attendus - trouves)}, en trop {sorted(trouves - attendus)}")
    return departements


def dans_polygone(x: np.ndarray, y: np.ndarray, anneaux: list[np.ndarray]) -> np.ndarray:
    """Règle pair-impair sur tous les anneaux : un trou (anneau intérieur) est bien exclu."""
    dedans = np.zeros(x.shape, dtype=bool)
    for a in anneaux:
        x1, y1 = a[:-1, 0], a[:-1, 1]
        x2, y2 = a[1:, 0], a[1:, 1]
        # boîte englobante de l'anneau : on ne teste que les points proches
        proche = (x >= a[:, 0].min()) & (x <= a[:, 0].max()) & (y >= a[:, 1].min()) & (y <= a[:, 1].max())
        if not proche.any():
            continue
        px, py = x[proche][:, None], y[proche][:, None]
        traverse = ((y1 > py) != (y2 > py)) & (px < (x2 - x1) * (py - y1) / np.where(y2 - y1 == 0, 1e-12, y2 - y1) + x1)
        dedans[proche] ^= (traverse.sum(axis=1) % 2).astype(bool)
    return dedans


def affecter(x: np.ndarray, y: np.ndarray, departements: list[dict]) -> dict[str, tuple[np.ndarray, bool]]:
    """{code: (indices des points du département, point_le_plus_proche)}."""
    resultat = {}
    for d in departements:
        idx = np.flatnonzero(dans_polygone(x, y, d["anneaux"]))
        if idx.size:
            resultat[d["code"]] = (idx, False)
        else:
            cx, cy = d["centre"]
            resultat[d["code"]] = (np.array([int(np.argmin((x - cx) ** 2 + (y - cy) ** 2))]), True)
    return resultat


# ------------------------------------------------------------------ BGS (nappes)


def code_bgs(valeur: str) -> str:
    v = "".join(c for c in valeur.upper() if c.isalnum())
    return NOMS_LONGS.get(v, v)


def lire_xyz(fichier: Path) -> pd.DataFrame:
    """Grille XYZ de la BGS : colonnes X, Y, valeur (texte). Seuls les points du Sénégal sont gardés."""
    lignes = lire_texte(fichier, (".txt", ".xyz", ".csv")).splitlines()
    sep = "\t" if "\t" in lignes[0] else ("," if "," in lignes[0] else None)
    enregistrements = []
    for ligne in lignes:
        morceaux = [m.strip().strip('"') for m in (ligne.split(sep) if sep else ligne.split())]
        if len(morceaux) < 3:
            continue
        try:
            x, y = float(morceaux[0]), float(morceaux[1])
        except ValueError:
            continue  # en-tête
        # Cases sans donnée de la BGS (lacs, bords de carte) : ignorées, jamais lues comme une valeur nulle
        if code_bgs(morceaux[2]) in {"NULL", "NODATA", "NA", "NAN", ""}:
            continue
        if OUEST <= x <= EST and SUD <= y <= NORD:
            enregistrements.append((x, y, morceaux[2]))
    if not enregistrements:
        raise SystemExit(f"{fichier.name} : aucun point dans l'emprise du Sénégal")
    return pd.DataFrame(enregistrements, columns=["x", "y", "valeur"])


def classes(df: pd.DataFrame, table: dict, nom: str) -> pd.Series:
    codes = df["valeur"].map(code_bgs)
    inconnus = sorted(set(codes) - set(table))
    if inconnus:
        raise SystemExit(f"BGS {nom} : codes inattendus {inconnus}. Compléter la table {nom.upper()} du script.")
    return codes


def dominante(codes: pd.Series, poids: np.ndarray, table: dict) -> str:
    compte = Counter()
    for c, p in zip(codes, poids):
        compte[c] += p
    return table[compte.most_common(1)[0][0]][0]


def mediane_ponderee(valeurs: np.ndarray, poids: np.ndarray) -> float:
    ordre = np.argsort(valeurs)
    cumul = np.cumsum(poids[ordre])
    return float(valeurs[ordre][np.searchsorted(cumul, cumul[-1] / 2)])


def part(masque: np.ndarray, poids: np.ndarray) -> float:
    return round(float(100 * poids[masque].sum() / poids.sum()), 1)


def preparer_bgs(departements: list[dict]) -> pd.DataFrame:
    chemins = {nom: fichier_bgs(mot) for nom, mot in [("profondeur", "depth"), ("productivite", "productiv"), ("stock", "storage")]}
    manquants = [n for n in ("profondeur", "productivite") if chemins[n] is None]
    if manquants:
        raise SystemExit(
            f"Cartes BGS manquantes ({', '.join(manquants)}) dans {(BRUT / 'bgs').relative_to(RACINE)}/.\n"
            f"Les télécharger depuis {PAGE_BGS} (fichiers « XYZ ASCII »), sans les renommer."
        )
    prof = lire_xyz(chemins["profondeur"])
    prod = lire_xyz(chemins["productivite"]).rename(columns={"valeur": "valeur_prod"})
    # Les trois cartes n'ont pas la même origine de grille (la profondeur v2 est décalée d'environ 1 km, le stock
    # d'environ 3 km) : chaque point est ramené à la cellule la plus proche de la grille de productivité (pas de 0,05°).
    pas, x0, y0 = 0.05, prod["x"].min(), prod["y"].min()

    def cellule(df: pd.DataFrame) -> pd.DataFrame:
        return df.assign(i=((df["x"] - x0) / pas).round().astype(int), j=((df["y"] - y0) / pas).round().astype(int))

    def sur_grille(df: pd.DataFrame) -> pd.DataFrame:
        return cellule(df).drop(columns=["x", "y"]).drop_duplicates(["i", "j"])

    grille = cellule(prod).merge(sur_grille(prof), on=["i", "j"], how="inner")
    if chemins["stock"]:
        grille = grille.merge(sur_grille(lire_xyz(chemins["stock"])).rename(columns={"valeur": "valeur_stock"}), on=["i", "j"], how="left")
    if grille.empty:
        raise SystemExit("BGS : aucune cellule commune entre la carte de profondeur et celle de productivité.")
    grille = grille.reset_index(drop=True)
    grille["c_prof"] = classes(grille, PROFONDEUR, "profondeur")
    grille["c_prod"] = classes(grille.rename(columns={"valeur": "_", "valeur_prod": "valeur"}), PRODUCTIVITE, "productivite")
    if "valeur_stock" in grille:
        grille["c_stock"] = classes(grille.rename(columns={"valeur": "_", "valeur_stock": "valeur"}).fillna({"valeur": "0"}), STOCK, "stock")

    x, y = grille["x"].to_numpy(), grille["y"].to_numpy()
    poids_tous = np.cos(np.radians(y))  # une cellule de grille en degrés rétrécit vers le nord
    lignes = []
    for code, (idx, plus_proche) in affecter(x, y, departements).items():
        g, poids = grille.iloc[idx], poids_tous[idx]
        peu_profonde = g["c_prof"].isin(PEU_PROFONDE).to_numpy()
        debit = g["c_prod"].isin(DEBIT_SUFFISANT).to_numpy()
        ligne = {
            "code_departement": code,
            "nb_points_grille": len(idx),
            "point_le_plus_proche": plus_proche,
            "profondeur_classe_dominante": dominante(g["c_prof"], poids, PROFONDEUR),
            "profondeur_mediane_m": mediane_ponderee(g["c_prof"].map(lambda c: PROFONDEUR[c][1]).to_numpy(), poids),
            "part_nappe_peu_profonde_pct": part(peu_profonde, poids),
            "productivite_classe_dominante": dominante(g["c_prod"], poids, PRODUCTIVITE),
            "productivite_mediane_l_s": mediane_ponderee(g["c_prod"].map(lambda c: PRODUCTIVITE[c][1]).to_numpy(), poids),
            "part_debit_suffisant_pct": part(debit, poids),
            "part_nappe_accessible_pct": part(peu_profonde & debit, poids),
            "stock_classe_dominante": dominante(g["c_stock"], poids, STOCK) if "c_stock" in g else None,
            "stock_median_mm": mediane_ponderee(g["c_stock"].map(lambda c: STOCK[c][1]).to_numpy(), poids) if "c_stock" in g else None,
            "source": "BGS, cartes quantitatives des eaux souterraines d'Afrique (MacDonald et al. 2012), grille 5 km",
        }
        lignes.append(ligne)
    return pd.DataFrame(lignes).sort_values("code_departement")


# ------------------------------------------------------------------ FAO GMIA (irrigation en place)


def lire_asc(fichier: Path) -> pd.DataFrame:
    """Grille ESRI ASCII mondiale (5 minutes d'arc) : seules les lignes et colonnes du Sénégal sont lues."""
    lignes = lire_texte(fichier, (".asc",)).splitlines()
    entete = {}
    for ligne in lignes[:6]:
        cle, valeur = ligne.split()[:2]
        entete[cle.lower()] = float(valeur)
    taille, x0, y0 = entete["cellsize"], entete["xllcorner"], entete["yllcorner"]
    nrows, nodata = int(entete["nrows"]), entete.get("nodata_value", -9999)
    col_min, col_max = int((OUEST - x0) / taille), int((EST - x0) / taille) + 1
    enregistrements = []
    for r in range(nrows):
        yc = y0 + (nrows - r - 0.5) * taille  # la première ligne est au nord
        if not (SUD <= yc <= NORD):
            continue
        valeurs = lignes[6 + r].split()[col_min:col_max + 1]
        for k, v in enumerate(valeurs):
            valeur = float(v)
            if valeur != nodata and valeur >= 0:
                enregistrements.append((x0 + (col_min + k + 0.5) * taille, yc, valeur))
    return pd.DataFrame(enregistrements, columns=["x", "y", fichier.name.split("_asc")[0]])


def moyenne_ponderee(valeurs: pd.Series, poids: pd.Series) -> float | None:
    ok = valeurs.notna() & poids.notna() & (poids > 0)
    return round(float((valeurs[ok] * poids[ok]).sum() / poids[ok].sum()), 1) if ok.any() else None


def preparer_gmia(departements: list[dict]) -> pd.DataFrame:
    grille = None
    for nom in ("aei_pct", "aei_ha", "aai_pct_aei", "aeigw_pct_aei", "aeisw_pct_aei"):
        g = lire_asc(SOURCES[nom][1])
        g.columns = ["x", "y", nom]
        g[["x", "y"]] = g[["x", "y"]].round(5)
        grille = g if grille is None else grille.merge(g, on=["x", "y"], how="outer")
    x, y = grille["x"].to_numpy(), grille["y"].to_numpy()
    grille["poids"] = np.cos(np.radians(y))
    lignes = []
    for code, (idx, plus_proche) in affecter(x, y, departements).items():
        g = grille.iloc[idx]
        lignes.append({
            "code_departement": code,
            "nb_cellules_grille": len(idx),
            "point_le_plus_proche": plus_proche,
            "surface_equipee_irrigation_ha": round(float(g["aei_ha"].fillna(0).sum()), 0),
            "part_surface_equipee_pct": moyenne_ponderee(g["aei_pct"].fillna(0), g["poids"]),
            "part_equipee_irriguee_pct": moyenne_ponderee(g["aai_pct_aei"], g["aei_ha"]),
            "part_irrigation_nappe_pct": moyenne_ponderee(g["aeigw_pct_aei"], g["aei_ha"]),
            "part_irrigation_eau_surface_pct": moyenne_ponderee(g["aeisw_pct_aei"], g["aei_ha"]),
            "annee_reference": 2005,
            "source": "FAO AQUASTAT, Global Map of Irrigation Areas v5 (Siebert et al. 2013), grille 5' (environ 9 km)",
        })
    return pd.DataFrame(lignes).sort_values("code_departement")


# ------------------------------------------------------------------ programme


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--hors-ligne", action="store_true", help="ne rien télécharger, utiliser data/raw/eau/")
    args = parser.parse_args()

    telecharger(args.hors_ligne)
    departements = charger_departements()
    SORTIE.mkdir(parents=True, exist_ok=True)

    gmia = preparer_gmia(departements)
    gmia.to_csv(SORTIE / "e_irrigation_departement.csv", index=False)
    print(f"e_irrigation_departement.csv : {len(gmia)} départements, "
          f"{gmia.surface_equipee_irrigation_ha.sum():,.0f} ha équipés au total (AQUASTAT Sénégal : environ 120 000 ha)")

    bgs = preparer_bgs(departements)
    bgs.to_csv(SORTIE / "e_eau_souterraine_departement.csv", index=False)
    print(f"e_eau_souterraine_departement.csv : {len(bgs)} départements, "
          f"{int(bgs.part_nappe_accessible_pct.gt(50).sum())} avec une nappe accessible sur plus de la moitié du territoire")

    print("\nÉtape suivante : exporter e_eau_surface_departement.csv avec ingestion/collecte/eau/gee_eau_surface.js,"
          " puis charger les trois fichiers : venv/bin/python -m ingestion.collecte.eau.charger_snowflake")


if __name__ == "__main__":
    sys.exit(main())
