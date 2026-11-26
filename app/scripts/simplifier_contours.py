"""Contours simplifiés des 45 départements pour la carte SVG de l'Observatoire (page /observatoire).

Entrée : public/geo/departements.geojson (GADM 4.1, GID_2, NAME_2).
Sortie : public/geo/departements-svg.json : { source, viewBox, departements: [{ code, nom, d }] }.

Simplification Douglas-Peucker qui garde les frontières communes identiques : les points où l'ensemble des
départements voisins change sont fixés, et chaque tronçon entre deux points fixes est simplifié une seule fois
(même résultat des deux côtés de la frontière, sans trou ni chevauchement).
Projection : équirectangulaire corrigée par cos(latitude moyenne), y vers le bas (repère SVG).

Usage (depuis app/) : python3 scripts/simplifier_contours.py [tolérance_en_unités_svg]
"""

import json
import math
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent.parent
ENTREE = ICI / "public/geo/departements.geojson"
SORTIE = ICI / "public/geo/departements-svg.json"
LARGEUR = 1000  # largeur du viewBox
TOLERANCE = float(sys.argv[1]) if len(sys.argv) > 1 else 2.2


def douglas_peucker(points, tol):
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norme = math.hypot(dx, dy)
    pire, indice = -1.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        d = math.hypot(px - x1, py - y1) if norme == 0 else abs(dy * px - dx * py + x2 * y1 - y2 * x1) / norme
        if d > pire:
            pire, indice = d, i
    if pire <= tol:
        return [points[0], points[-1]]
    gauche = douglas_peucker(points[: indice + 1], tol)
    return gauche[:-1] + douglas_peucker(points[indice:], tol)


def main():
    geo = json.loads(ENTREE.read_text(encoding="utf-8"))
    tous = [c for f in geo["features"] for poly in f["geometry"]["coordinates"] for anneau in poly for c in anneau]
    lon_min, lon_max = min(c[0] for c in tous), max(c[0] for c in tous)
    lat_min, lat_max = min(c[1] for c in tous), max(c[1] for c in tous)
    kx = math.cos(math.radians((lat_min + lat_max) / 2))
    echelle = LARGEUR / ((lon_max - lon_min) * kx)
    hauteur = round((lat_max - lat_min) * echelle)

    def cle(c):
        return (round(c[0], 6), round(c[1], 6))

    def projeter(c):
        return ((c[0] - lon_min) * kx * echelle, (lat_max - c[1]) * echelle)

    # Départements qui partagent chaque sommet
    proprietaires: dict[tuple, set] = {}
    for f in geo["features"]:
        for poly in f["geometry"]["coordinates"]:
            for anneau in poly:
                for c in anneau:
                    proprietaires.setdefault(cle(c), set()).add(f["properties"]["GID_2"])

    memo: dict[tuple, list] = {}

    def troncon(cles):
        """Simplifie un tronçon une seule fois, quel que soit son sens de parcours."""
        sens = cles if cles[0] <= cles[-1] else cles[::-1]
        k = tuple(sens)
        if k not in memo:
            memo[k] = douglas_peucker([projeter(c) for c in sens], TOLERANCE)
        res = memo[k]
        return res if sens is cles else res[::-1]

    def simplifier_anneau(anneau):
        cles = [cle(c) for c in anneau[:-1]]
        n = len(cles)
        fixes = [i for i in range(n) if proprietaires[cles[i]] != proprietaires[cles[i - 1]] or proprietaires[cles[i]] != proprietaires[cles[(i + 1) % n]]]
        if not fixes:
            fixes = [0, n // 3, 2 * n // 3]
        points = []
        for j, debut in enumerate(fixes):
            fin = fixes[(j + 1) % len(fixes)]
            morceau = cles[debut : fin + 1] if fin > debut else cles[debut:] + cles[: fin + 1]
            points.extend(troncon(morceau)[:-1])
        return points

    departements = []
    for f in geo["features"]:
        morceaux = []
        for poly in f["geometry"]["coordinates"]:
            for anneau in poly:
                pts = simplifier_anneau(anneau)
                if len(pts) < 3:
                    continue
                morceaux.append("M" + "L".join(f"{round(x, 1):g} {round(y, 1):g}" for x, y in pts) + "Z")
        departements.append({"code": f["properties"]["GID_2"], "nom": f["properties"]["NAME_2"], "d": "".join(morceaux)})

    SORTIE.write_text(
        json.dumps({"source": "GADM 4.1 (gadm.org), contours simplifiés", "viewBox": f"0 0 {LARGEUR} {hauteur}", "departements": departements},
                   ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    nb = sum(d["d"].count("L") + d["d"].count("M") for d in departements)
    print(f"{len(departements)} départements, {nb} points, {SORTIE.stat().st_size / 1024:.1f} Ko -> {SORTIE}")


if __name__ == "__main__":
    main()
