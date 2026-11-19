"""Génère les icônes PNG de la PWA (même dessin que public/favicon.svg). Usage : npm run icons"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

PUBLIC = Path(__file__).resolve().parent.parent / "public"
VERT, SOLEIL, TERRE, TERRE_FONCEE = "#1f5f3a", "#f2b544", "#b7793f", "#8a5527"


def vague(d, s, y, amplitude, couleur):
    points = []
    for i in range(101):
        x = i / 100
        # une onde complète, comme le chemin SVG
        points.append((x * s, (y - amplitude * math.sin(math.pi * 2 * x)) * s / 64))
    points += [(s, s), (0, s)]
    d.polygon(points, fill=couleur)


def icone(taille, marge=0.0, arrondi=True):
    s = taille * 4  # sur-échantillonnage pour l'anticrénelage
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if arrondi:
        d.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 14 / 64), fill=VERT)
    else:
        d.rectangle((0, 0, s, s), fill=VERT)
    k = 1 - 2 * marge
    cx, cy, r = s / 2, s * (marge + k * 25 / 64), s * k * 11 / 64
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=SOLEIL)
    vague(d, s, 64 * (marge + k * 44 / 64), 3 * k, TERRE)
    vague(d, s, 64 * (marge + k * 51 / 64), 2.5 * k, TERRE_FONCEE)
    return img.resize((taille, taille), Image.LANCZOS)


icone(192).save(PUBLIC / "pwa-192x192.png")
icone(512).save(PUBLIC / "pwa-512x512.png")
icone(512, marge=0.1, arrondi=False).save(PUBLIC / "maskable-512x512.png")
icone(180, arrondi=False).save(PUBLIC / "apple-touch-icon.png")
print("Icônes écrites dans", PUBLIC)
