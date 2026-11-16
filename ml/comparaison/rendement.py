"""Comparaison des 6 familles — partie 2 : rendement prévu et risque de chute de la récolte.

Lancer depuis la racine du dépôt :
    venv/bin/python -m ml.comparaison.rendement      (quelques minutes)

Même préparation que le modèle 3 (`ml.m3_rendement.entrainer`) : 5 cultures pluviales, cible =
rendement / tendance des 10 campagnes précédentes, 1991-2015, quatre moments (fin mai à fin août),
mêmes variables par moment. Deux tâches :
    - le rendement de la campagne (régression sur le logarithme du rapport rendement / tendance) ;
    - la chute de la récolte, rendement < 80 % de la tendance (classification).
Protocole : chaque année est prévue par un modèle entraîné sur les années d'avant ;
validation 2001-2008 (choix du réglage), test 2009-2015 (réglage figé).
Écrit ml/sorties/comparaison_rendement.csv et comparaison_rendement_moments.csv.
"""

import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from joblib import Parallel, delayed
from sklearn.metrics import roc_auc_score

from ml.comparaison.modeles import FAMILLES, libelle
from ml.comparaison.selection import choisir, gain
from ml.m3_rendement import entrainer as m3

SORTIES = Path(__file__).resolve().parents[1] / "sorties"
VALIDATION, TEST = list(m3.VALIDATION), list(m3.TEST)
TACHES = ("rendement (kg/ha)", "chute de la récolte")
ACTUEL = "Modèle actuel m3-v1 (12 seuils logistiques)"
RAPPORT_MIN = 0.05   # borne basse avant le logarithme (récolte presque nulle)


def preparer() -> dict[str, pd.DataFrame]:
    """Par moment : les lignes observées et complètes, 1991-2015."""
    d = m3.preparer()
    m3.verifier_absence_de_fuite(d)
    d = d[d.rendement_kg_ha.notna()]
    return {moment: d[d[m3.variables(moment)].notna().all(axis=1)].reset_index(drop=True) for moment in m3.MOMENTS}


def prevoir(donnees: dict, annees: list[int], famille, reglage: dict) -> pd.DataFrame:
    """Rendement prévu et probabilité de chute, pour chaque moment et chaque année demandée."""
    morceaux = []
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for moment, d in donnees.items():
            v = m3.variables(moment)
            for annee in annees:
                passe, cible = d[d.annee < annee], d[d.annee == annee]
                x, xc = passe[v].to_numpy(float), cible[v].to_numpy(float)
                log_rapport = famille.reg(reglage).fit(x, np.log(passe.rapport.clip(lower=RAPPORT_MIN))).predict(xc)
                proba = famille.clf(reglage).fit(x, (passe.rapport < m3.SEUIL_CHUTE).astype(int)).predict_proba(xc)[:, 1]
                morceaux.append(pd.DataFrame({"moment": moment, "ligne": cible.index, "annee": annee,
                                              "prevu_kg_ha": cible.tendance_kg_ha.to_numpy() * np.exp(log_rapport),
                                              "proba_chute": proba}))
    return pd.concat(morceaux, ignore_index=True)


def references(donnees: dict, annees: list[int]) -> dict[str, pd.DataFrame]:
    """Références (tendance, passé de la culture) et modèle actuel, année par année."""
    sorties = {"Tendance (moyenne des 10 campagnes précédentes)": [], "Passé de la culture (médiane, fréquence des chutes)": [], ACTUEL: []}
    for moment, d in donnees.items():
        for annee in annees:
            passe, cible = d[d.annee < annee], d[d.annee == annee]
            ref = m3.reference(passe, cible)
            actuel = m3.prevoir(passe, cible, moment)
            base = {"moment": moment, "ligne": cible.index, "annee": annee}
            t = cible.tendance_kg_ha.to_numpy()
            sorties["Tendance (moyenne des 10 campagnes précédentes)"].append(pd.DataFrame({**base, "prevu_kg_ha": t, "proba_chute": np.nan}))
            sorties["Passé de la culture (médiane, fréquence des chutes)"].append(pd.DataFrame({
                **base, "prevu_kg_ha": t * ref.ref_rapport_median.to_numpy(), "proba_chute": ref.ref_proba_chute.to_numpy()}))
            sorties[ACTUEL].append(pd.DataFrame({**base, "prevu_kg_ha": t * actuel.rapport_median.to_numpy(),
                                                 "proba_chute": actuel.proba_chute.to_numpy()}))
    return {nom: pd.concat(m, ignore_index=True) for nom, m in sorties.items()}


def observer(donnees: dict, p: pd.DataFrame) -> pd.DataFrame:
    """Ajoute l'observé (rendement, chute) aux prévisions."""
    obs = pd.concat([d[["rendement_kg_ha", "rapport", "culture"]].assign(moment=m, ligne=d.index) for m, d in donnees.items()])
    p = p.merge(obs, on=["moment", "ligne"])
    p["chute"] = (p.rapport < m3.SEUIL_CHUTE).astype(float)
    p["erreur_kg"] = (p.prevu_kg_ha - p.rendement_kg_ha).abs()
    p["erreur_chute"] = (p.proba_chute - p.chute) ** 2
    return p.sort_values(["moment", "ligne"]).reset_index(drop=True)


def mesurer(p: pd.DataFrame, tendance: pd.DataFrame, passe: pd.DataFrame, prefixe: str) -> dict:
    """Mesures d'un jeu de prévisions, comparé aux deux références (mêmes lignes, même ordre)."""
    m = {"nb_lignes": len(p), "mae_kg_ha": round(float(p.erreur_kg.mean()), 1)}
    g, bas, haut = gain(p.erreur_kg, tendance.erreur_kg, p.annee)
    m |= {"gain_mae_vs_tendance": g, "gain_mae_bas": bas, "gain_mae_haut": haut}
    if p.proba_chute.notna().all():
        g, bas, haut = gain(p.erreur_chute, passe.erreur_chute, p.annee)
        m |= {"brier": round(float(p.erreur_chute.mean()), 4), "brier_skill_score": g, "bss_bas": bas, "bss_haut": haut,
              "auc": round(roc_auc_score(p.chute, p.proba_chute), 3)}
    return {f"{prefixe}_{k}": v for k, v in m.items()}


def essai(donnees, famille, reglage):
    p = observer(donnees, prevoir(donnees, VALIDATION, famille, reglage))
    return famille.nom, reglage, float(p.erreur_kg.mean()), float(p.erreur_chute.mean())


def main():
    donnees = preparer()

    # 1. Validation : toutes les familles × réglages (un seul réglage par famille pour les 4 moments).
    essais = Parallel(n_jobs=-2)(delayed(essai)(donnees, f, r) for f in FAMILLES for r in f.grille)
    essais = pd.DataFrame(essais, columns=["modele", "reglage", "mae_val_kg_ha", "brier_val"])

    refs = {periode: {nom: observer(donnees, p) for nom, p in references(donnees, annees).items()}
            for periode, annees in [("val", VALIDATION), ("test", TEST)]}
    nom_tendance, nom_passe = list(refs["val"])[:2]

    def toutes_mesures(pv, pt):
        return (mesurer(pv, refs["val"][nom_tendance], refs["val"][nom_passe], "val")
                | mesurer(pt, refs["test"][nom_tendance], refs["test"][nom_passe], "test"))

    def par_moment(nom, tache, pt):
        return [{"tache": tache, "modele": nom, "moment": moment,
                 **mesurer(g, refs["test"][nom_tendance].query("moment == @moment"),
                           refs["test"][nom_passe].query("moment == @moment"), "test")}
                for moment, g in pt.groupby("moment", sort=False)]

    lignes, detail = [], []
    for nom in refs["val"]:
        for tache in TACHES:
            if tache == TACHES[1] and nom == nom_tendance:
                continue   # la tendance ne donne pas de probabilité de chute
            lignes.append({"tache": tache, "type": "ACTUEL" if nom == ACTUEL else "REFERENCE", "modele": nom,
                           **toutes_mesures(refs["val"][nom], refs["test"][nom])})
            detail += par_moment(nom, tache, refs["test"][nom])

    # 2. Pour chaque famille et chaque tâche : le meilleur réglage de validation, figé, puis le test.
    erreurs_val = {t: {} for t in TACHES}
    def finir(famille, tache, critere):
        e = essais[essais.modele == famille.nom]
        reglage = e.loc[e[critere].idxmin()].reglage
        return famille.nom, tache, reglage, observer(donnees, prevoir(donnees, VALIDATION, famille, reglage)), \
            observer(donnees, prevoir(donnees, TEST, famille, reglage))
    finis = Parallel(n_jobs=-2)(delayed(finir)(f, t, c) for f in FAMILLES for t, c in zip(TACHES, ["mae_val_kg_ha", "brier_val"]))
    for nom, tache, reglage, pv, pt in finis:
        erreurs_val[tache][nom] = (pv.erreur_kg if tache == TACHES[0] else pv.erreur_chute).to_numpy()
        lignes.append({"tache": tache, "type": "MODELE", "modele": nom, "reglage": libelle(reglage), **toutes_mesures(pv, pt)})
        detail += par_moment(nom, tache, pt)
    c = pd.DataFrame(lignes)

    # 3. Modèle retenu (règle de selection.py, sur la validation seulement).
    ordre = [f.nom for f in FAMILLES]
    annees_val = refs["val"][nom_tendance].annee
    choix = pd.concat([choisir(erreurs_val[t], annees_val, ordre).assign(tache=t) for t in TACHES])
    c = c.merge(choix, on=["tache", "modele"], how="left")
    # Une colonne ne garde que les mesures de sa tâche.
    c.loc[c.tache == TACHES[0], [x for x in c.columns if "brier" in x or "bss" in x or x.endswith("_auc")]] = np.nan
    c.loc[c.tache == TACHES[1], [x for x in c.columns if "mae" in x]] = np.nan
    c.insert(0, "partie", "2 - rendement")

    SORTIES.mkdir(exist_ok=True)
    c.to_csv(SORTIES / "comparaison_rendement.csv", index=False)
    pd.DataFrame(detail).to_csv(SORTIES / "comparaison_rendement_moments.csv", index=False)
    essais.assign(reglage=essais.reglage.map(libelle)).round(4).to_csv(SORTIES / "comparaison_rendement_essais.csv", index=False)
    pd.set_option("display.width", 250, "display.max_columns", 40)
    for tache in TACHES:
        print(f"\n== {tache}")
        print(c[c.tache == tache].dropna(axis=1, how="all").drop(columns=["partie", "tache"]).to_string(index=False))


if __name__ == "__main__":
    main()
