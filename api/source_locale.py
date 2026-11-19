"""Secours : les résultats des modèles lus dans ml/sorties/*.csv quand SALTIS.ML n'est pas chargé.

Ainsi `python -m api` sert toujours les prévisions, même avant le chargement dans Snowflake.
Les lignes ont la même forme que les tables de SALTIS.ML : le territoire (région, zone) est complété
avec les départements des marts.
"""

import csv
import logging
import re
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

DOSSIER_SORTIES = Path(__file__).resolve().parents[1] / "ml" / "sorties"
TERRITOIRE = ("code_departement", "departement", "code_region", "region", "zone_agroecologique")

# clé du registre → fichier CSV produit par ml/
FICHIERS = {
    "prev_saison": "prevision_saison.csv",
    "semblables": "annees_semblables.csv",
    "prev_rendement": "prevision_rendement.csv",
    "semis": "risque_semis.csv",
}
EVALUATIONS = {"M1": "evaluation_m1.csv", "M2": "evaluation_m2.csv", "M3": "evaluation_m3.csv", "M4": "evaluation_m4.csv"}
IDENTIFIANTS_EVALUATION = ("version_modele", "periode", "moment", "culture", "risque", "variables")
_ENTIER_EN_FLOTTANT = re.compile(r"^-?\d+\.0$")


def _valeur(texte: str) -> str | None:
    """Vide → None (jamais 0) ; « 2016.0 » → « 2016 » pour les colonnes entières écrites en flottant."""
    if texte == "":
        return None
    return texte[:-2] if _ENTIER_EN_FLOTTANT.match(texte) else texte


def _lire_csv(fichier: Path) -> list[dict[str, Any]]:
    with fichier.open(encoding="utf-8", newline="") as f:
        return [{k: _valeur(v) for k, v in ligne.items()} for ligne in csv.DictReader(f)]


def _evaluation(dossier: Path) -> list[dict[str, Any]]:
    """Les 4 fichiers d'évaluation en format long : une ligne par mesure (comme SALTIS.ML.EVALUATION_MODELES)."""
    lignes = []
    for modele, nom in EVALUATIONS.items():
        if not (dossier / nom).exists():
            continue
        for ligne in _lire_csv(dossier / nom):
            ids = {k: ligne.get(k) for k in IDENTIFIANTS_EVALUATION}
            for mesure, valeur in ligne.items():
                if mesure in IDENTIFIANTS_EVALUATION or valeur is None:
                    continue
                valeur = {"True": "1", "False": "0"}.get(valeur, valeur)
                try:
                    float(valeur)
                except ValueError:
                    continue
                lignes.append({"modele": modele, **ids, "mesure": mesure, "valeur": valeur})
    return lignes


def lire_resultats_ml(cles: set[str], territoires: list[dict[str, Any]], dossier: Path = DOSSIER_SORTIES) -> dict[str, list]:
    """Rend {cle: lignes} pour les clés demandées dont le fichier existe. `territoires` : lignes des marts
    portant code_departement, departement, code_region, region, zone_agroecologique."""
    territoire = {t["code_departement"]: {k: t[k] for k in TERRITOIRE} for t in territoires}
    resultat: dict[str, list] = {}
    for cle in cles:
        if cle == "evaluation":
            lignes = _evaluation(dossier)
        elif cle in FICHIERS and (dossier / FICHIERS[cle]).exists():
            lignes = [{**ligne, **territoire.get(ligne["code_departement"], {})} for ligne in _lire_csv(dossier / FICHIERS[cle])]
        else:
            continue
        if lignes:
            resultat[cle] = lignes
            log.info("Prévisions lues localement (SALTIS.ML non chargé) : %s, %d lignes", cle, len(lignes))
    return resultat
