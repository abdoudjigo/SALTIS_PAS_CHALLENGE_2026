"""Compresse les icônes PNG de public/ (palette de 256 couleurs, tramage, transparence gardée).

Usage : npm run images   (à relancer après avoir ajouté ou régénéré un PNG)

- Méthode : libimagequant (celle de pngquant), sans bande visible dans les dégradés.
- Un fichier déjà en palette est laissé tel quel : le script peut être relancé sans dégrader les images.
- Les logos WebP de public/logos/ sont déjà compressés avec perte : les recompresser les abîmerait pour un gain faible.
"""
from pathlib import Path

from PIL import Image, features

PUBLIC = Path(__file__).resolve().parent.parent / "public"

if not features.check("libimagequant"):
    raise SystemExit("Pillow sans libimagequant : installer une version de Pillow qui l'inclut (pip install -U pillow).")

total_avant = total_apres = 0
for fichier in sorted(PUBLIC.rglob("*.png")):
    avant = fichier.stat().st_size
    with Image.open(fichier) as image:
        if image.mode == "P":
            print(f"{fichier.relative_to(PUBLIC)} : déjà compressé ({avant} octets)")
            continue
        reduite = image.convert("RGBA").quantize(256, method=Image.Quantize.LIBIMAGEQUANT, dither=Image.Dither.FLOYDSTEINBERG)
    temporaire = fichier.with_suffix(".tmp.png")
    reduite.save(temporaire, optimize=True)
    apres = temporaire.stat().st_size
    if apres < avant:
        temporaire.replace(fichier)
        total_avant, total_apres = total_avant + avant, total_apres + apres
        print(f"{fichier.relative_to(PUBLIC)} : {avant} -> {apres} octets ({100 * (avant - apres) // avant} % de moins)")
    else:
        temporaire.unlink()
        print(f"{fichier.relative_to(PUBLIC)} : laissé tel quel (aucun gain)")

if total_avant:
    print(f"Total : {total_avant} -> {total_apres} octets ({100 * (total_avant - total_apres) // total_avant} % de moins)")
