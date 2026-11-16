"""Comparaison des 6 familles — partie 1 : prévision de la pluie de saison, faite fin mai.

Lancer depuis la racine du dépôt :
    venv/bin/python -m ml.comparaison.pluie

Deux tâches : la pluie de la saison en mm (régression) et la classe sèche / normale /
humide (classification). Protocole :
    - validation glissante sur 2001-2015 : 5 blocs de 3 années, chaque bloc est prévu par
      un modèle entraîné sur les seules années d'avant ;
    - le réglage et le jeu de variables de chaque famille sont choisis sur cette validation ;
    - test 2016-2025 : modèle entraîné sur 1982-2015, réglage figé, regardé une seule fois ;
    - modèle retenu : règle de `ml/comparaison/selection.py`.
Écrit ml/sorties/comparaison_pluie.csv (et le détail des essais). Rien n'est écrit dans Snowflake.
"""

import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from joblib import Parallel, delayed

from ml.commun.donnees import lire
from ml.commun.evaluation import rmse
from ml.comparaison.modeles import FAMILLES, libelle
from ml.comparaison.selection import choisir, gain
from ml.m1_prevision_saison import entrainer as m1

SORTIES = Path(__file__).resolve().parents[1] / "sorties"
PREMIERE_ANNEE = 1982                      # 1981 n'a pas de pluie de l'année précédente
BLOCS_VALIDATION = [range(a, a + 3) for a in range(2001, 2016, 3)]
TEST = range(2016, 2026)
FENETRE_TENDANCE = 15

OCEAN_2 = ["indice_oni_mars_mai", "indice_tsa_mars_mai"]
OCEAN_3 = ["indice_oni_mars_mai", "indice_tna_mars_mai", "indice_tsa_mars_mai"]
JEUX = {
    "océan (ONI, TSA)": OCEAN_2,
    "océan (ONI, TNA, TSA)": OCEAN_3,
    "océan + département": OCEAN_3 + ["pluie_n_moins_1_vs_normale", "latitude", "longitude", "pluie_normale_saison_mm"],
}
# Écartées pour toutes les familles : l'AMO (série arrêtée en 2022, absente pour prévoir 2026)
# et l'humidité du sol (absente pour 6 départements côtiers).

# Références. La normale 1991-2020 contient les années de validation et une partie du test :
# la référence équitable est la moyenne des 15 dernières saisons, calculée avec le seul passé.
NORMALE, TENDANCE = "Normale 1991-2020", "Moyenne des 15 dernières saisons"
CLIMATOLOGIE = "Climatologie (fréquence passée des classes)"
TACHES = ("pluie (mm)", "classe (3)")


def preparer() -> pd.DataFrame:
    d = m1.preparer()
    d = d.merge(lire("DIM_GEOGRAPHIE")[["code_departement", "latitude", "longitude"]], on="code_departement")
    d["pluie_n_moins_1_vs_normale"] = d.pluie_saison_n_moins_1_mm / d.pluie_normale_saison_mm - 1
    return d[d.annee >= PREMIERE_ANNEE].sort_values(["annee", "code_departement"]).reset_index(drop=True)


def decoupes(d: pd.DataFrame) -> dict[str, list[tuple[np.ndarray, np.ndarray]]]:
    """(lignes d'entraînement, lignes prévues) de chaque bloc, toujours passé → futur."""
    a = d.annee.to_numpy()
    return {
        "validation": [(np.flatnonzero(a < b[0]), np.flatnonzero(np.isin(a, b))) for b in BLOCS_VALIDATION],
        "test": [(np.flatnonzero(a < TEST[0]), np.flatnonzero(np.isin(a, TEST)))],
    }


def prevoir(d: pd.DataFrame, blocs, famille, reglage: dict, variables: list[str]):
    """Pluie prévue (mm) et probabilités des 3 classes, sur les lignes prévues des blocs."""
    anomalie, probas = np.full(len(d), np.nan), np.full((len(d), 3), np.nan)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for passe, cible in blocs:
            x, xc = d.loc[passe, variables].to_numpy(), d.loc[cible, variables].to_numpy()
            anomalie[cible] = famille.reg(reglage).fit(x, d.anomalie.to_numpy()[passe]).predict(xc)
            probas[cible] = famille.clf(reglage).fit(x, d.classe.to_numpy()[passe]).predict_proba(xc)
    return d.pluie_normale_saison_mm.to_numpy() * (1 + anomalie), probas


def references(d: pd.DataFrame, blocs):
    """Prévisions simples, calculées avec les mêmes années passées que les modèles."""
    n = len(d)
    reg = {nom: np.full(n, np.nan) for nom in [NORMALE, TENDANCE, "Moyenne passée du département", "Pluie de l'année précédente"]}
    climato = np.full((n, 3), np.nan)
    for passe, cible in blocs:
        p, c = d.loc[passe], d.loc[cible]
        reg[NORMALE][cible] = c.pluie_normale_saison_mm
        reg["Moyenne passée du département"][cible] = c.code_departement.map(p.groupby("code_departement").pluie_saison_mm.mean())
        recent = p[p.annee > p.annee.max() - FENETRE_TENDANCE]
        reg[TENDANCE][cible] = c.code_departement.map(recent.groupby("code_departement").pluie_saison_mm.mean())
        reg["Pluie de l'année précédente"][cible] = c.pluie_saison_n_moins_1_mm
        climato[cible] = np.bincount(p.classe, minlength=3) / len(p)
    return reg, climato


def erreur_mm(d, pluie) -> np.ndarray:
    return (pluie - d.pluie_saison_mm.to_numpy()) ** 2


def erreur_classe(d, probas) -> np.ndarray:
    """RPS ligne à ligne (classes ordonnées : une erreur d'une classe coûte moins que deux)."""
    vraies = np.eye(3)[d.classe.to_numpy()]
    return ((np.cumsum(probas, 1) - np.cumsum(vraies, 1)) ** 2).sum(1) / 2


def mesurer(d, lignes, prefixe, pluie=None, probas=None, refs=None, climato=None) -> dict:
    s, m = d.loc[lignes], {}
    if pluie is not None:
        e = erreur_mm(d, pluie)[lignes]
        m |= {"rmse_mm": round(rmse(pluie[lignes], s.pluie_saison_mm), 1),
              "mae_mm": round(float(np.mean(np.abs(pluie[lignes] - s.pluie_saison_mm))), 1)}
        for nom, cle in [(NORMALE, "normale"), (TENDANCE, "tendance")]:
            g, bas, haut = gain(e, erreur_mm(d, refs[nom])[lignes], s.annee)
            m |= {f"gain_vs_{cle}": g, f"gain_vs_{cle}_bas": bas, f"gain_vs_{cle}_haut": haut}
    if probas is not None:
        e = erreur_classe(d, probas)[lignes]
        g, bas, haut = gain(e, erreur_classe(d, climato)[lignes], s.annee)
        m |= {"rps": round(float(e.mean()), 4), "rpss_vs_climatologie": g, "rpss_bas": bas, "rpss_haut": haut,
              "classe_juste_pct": round(100 * np.mean(probas[lignes].argmax(1) == s.classe.to_numpy()), 1)}
    return {f"{prefixe}_{k}": v for k, v in m.items()}


def essai(d, blocs, val, famille, reglage, nom_jeu):
    pluie, probas = prevoir(d, blocs["validation"], famille, reglage, JEUX[nom_jeu])
    return (famille.nom, reglage, nom_jeu, float(np.sqrt(erreur_mm(d, pluie)[val].mean())), float(erreur_classe(d, probas)[val].mean()))


def main():
    d = preparer()
    blocs = decoupes(d)
    val = np.concatenate([c for _, c in blocs["validation"]])
    test = blocs["test"][0][1]

    # 1. Validation : toutes les familles × réglages × jeux de variables.
    essais = Parallel(n_jobs=-2)(delayed(essai)(d, blocs, val, f, r, j) for f in FAMILLES for r in f.grille for j in JEUX)
    essais = pd.DataFrame(essais, columns=["modele", "reglage", "variables", "rmse_val_mm", "rps_val"])

    ref_val, climato_val = references(d, blocs["validation"])
    ref_test, climato_test = references(d, blocs["test"])
    lignes = [{"tache": TACHES[0], "type": "REFERENCE", "modele": nom,
               **mesurer(d, val, "val", ref_val[nom], refs=ref_val), **mesurer(d, test, "test", ref_test[nom], refs=ref_test)}
              for nom in ref_val]
    lignes.append({"tache": TACHES[1], "type": "REFERENCE", "modele": CLIMATOLOGIE,
                   **mesurer(d, val, "val", probas=climato_val, climato=climato_val),
                   **mesurer(d, test, "test", probas=climato_test, climato=climato_test)})

    # 2. Pour chaque famille et chaque tâche : le meilleur essai de validation, figé, puis le test.
    erreurs_val = {t: {} for t in TACHES}
    for famille in FAMILLES:
        e = essais[essais.modele == famille.nom]
        for tache, critere in zip(TACHES, ["rmse_val_mm", "rps_val"]):
            choix = e.loc[e[critere].idxmin()]
            pv, qv = prevoir(d, blocs["validation"], famille, choix.reglage, JEUX[choix.variables])
            pt, qt = prevoir(d, blocs["test"], famille, choix.reglage, JEUX[choix.variables])
            if tache == TACHES[0]:
                erreurs_val[tache][famille.nom] = erreur_mm(d, pv)[val]
                mesures = mesurer(d, val, "val", pv, refs=ref_val) | mesurer(d, test, "test", pt, refs=ref_test)
            else:
                erreurs_val[tache][famille.nom] = erreur_classe(d, qv)[val]
                mesures = (mesurer(d, val, "val", probas=qv, climato=climato_val)
                           | mesurer(d, test, "test", probas=qt, climato=climato_test))
            lignes.append({"tache": tache, "type": "MODELE", "modele": famille.nom, "variables": choix.variables,
                           "reglage": libelle(choix.reglage), **mesures})
    c = pd.DataFrame(lignes)

    # 3. Modèle retenu (règle de selection.py, sur la validation seulement).
    ordre = [f.nom for f in FAMILLES]
    choix = pd.concat([choisir(erreurs_val[t], d.annee[val], ordre).assign(tache=t) for t in TACHES])
    c = c.merge(choix, on=["tache", "modele"], how="left")
    c.insert(0, "partie", "1 - pluie de saison")

    SORTIES.mkdir(exist_ok=True)
    c.to_csv(SORTIES / "comparaison_pluie.csv", index=False)
    essais.assign(reglage=essais.reglage.map(libelle)).round(4).to_csv(SORTIES / "comparaison_pluie_essais.csv", index=False)
    pd.set_option("display.width", 250, "display.max_columns", 40)
    for tache in TACHES:
        print(f"\n== {tache}")
        print(c[c.tache == tache].dropna(axis=1, how="all").drop(columns=["partie", "tache"]).to_string(index=False))


if __name__ == "__main__":
    main()
