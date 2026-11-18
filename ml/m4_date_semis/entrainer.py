"""Modèle 4 — Quand semer : la décade de semis la plus sûre, par culture.

Lancer depuis la racine du dépôt (après le modèle 1, dont il utilise la sortie) :
    venv/bin/python -m ml.m4_date_semis.entrainer

Deux risques pour chaque décade de semis (16 = 1re décade de juin … 23 = 2e décade d'août) :
  1. faux départ : après la pluie de semis, une des deux décades suivantes est sèche ;
  2. fin trop tôt : la saison s'arrête avant que la culture ait fini son cycle.
Semer tôt augmente le premier, semer tard augmente le second : la décade conseillée
est celle où le risque total est le plus bas.

Écrit dans ml/sorties/ :
    risque_semis.csv     département × année × culture × décade de semis
    evaluation_m4.csv    fiabilité comparée à la fréquence passée
Rien n'est écrit dans Snowflake.
"""

from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import norm
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from ml.commun.donnees import lire

VERSION = "m4-v1"
SORTIES = Path(__file__).resolve().parents[1] / "sorties"
DERNIERE_ANNEE_ENTRAINEMENT = 2015
PREMIERE_ANNEE = 1986

DECADES_SEMIS = range(16, 24)  # 1re décade de juin → 2e décade d'août
PLUIE_SEMIS_MM = 20            # pluie de la décade qui permet de semer
DECADE_SECHE_MM = 10           # définition de la source (colonne decade_seche)
MARGE_FIN_CYCLE_J = 20         # les 20 derniers jours du cycle (maturité) demandent peu d'eau
CHANCE_PLUIE_MIN = 0.5         # une décade n'est conseillée que si la pluie de semis y arrive 1 année sur 2

# Cultures pluviales : les cultures irriguées et le manioc (pluriannuel) sont exclues.
CULTURES = ["ARACHIDE", "COTON", "MAÏS", "MIL (SOUNA)", "NIÉBÉ", "PASTÈQUE", "SÉSAME", "SORGHO"]
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]


def jour_milieu_decade(decade: int) -> int:
    """Jour de l'année au milieu de la décade (année non bissextile)."""
    mois, rang = (decade - 1) // 3 + 1, (decade - 1) % 3
    return pd.Timestamp(2001, mois, 1 + 10 * rang).day_of_year + 4


def libelle_decade(decade: int) -> str:
    rang = (decade - 1) % 3
    return f"{['1re', '2e', '3e'][rang]} décade de {MOIS[(decade - 1) // 3]}"


def prevision_saison() -> pd.DataFrame:
    """Probabilité de saison sèche du modèle 1, connue fin mai (une valeur par année)."""
    fichier = SORTIES / "prevision_saison.csv"
    if not fichier.exists():
        raise SystemExit("Lancer d'abord le modèle 1 : venv/bin/python -m ml.m1_prevision_saison.entrainer")
    m1 = pd.read_csv(fichier)
    g = m1.groupby("annee").agg(proba_seche_m1=("proba_seche_pct", "first"), type_m1=("type_prevision", "first")).reset_index()
    g["proba_seche_m1"] = g.proba_seche_m1 / 100
    return g


# --- 1. Faux départ ----------------------------------------------------------------------------

def donnees_faux_depart(m1: pd.DataFrame) -> pd.DataFrame:
    """Une ligne par département × année × décade où une pluie de semis est tombée."""
    geo = lire("DIM_GEOGRAPHIE")[["id_departement", "code_departement", "departement", "latitude"]]
    p = lire("FACT_PLUVIOMETRIE_DECADAIRE").merge(geo, on="id_departement")
    p = p.sort_values(["code_departement", "annee", "numero_decade_annee"])
    g = p.groupby(["code_departement", "annee"])
    for k in (1, 2):
        p[f"pluie_d{k}"] = g.pluie_mm.shift(-k)
        p[f"normale_d{k}"] = g.pluie_normale_mm.shift(-k)
    p = p[p.numero_decade_annee.isin(DECADES_SEMIS) & (p.annee >= PREMIERE_ANNEE)]
    p = p.merge(m1, on="annee", how="left")
    p["faux_depart"] = (p[["pluie_d1", "pluie_d2"]].min(axis=1) < DECADE_SECHE_MM).astype(int)
    return p


VARIABLES_FD = ["numero_decade_annee", "normale_d1", "normale_d2", "latitude", "proba_seche_m1"]


def modele_faux_depart():
    return make_pipeline(StandardScaler(), LogisticRegression(C=1.0, max_iter=2000))


def risque_faux_depart_climatologique(passe: pd.DataFrame) -> pd.DataFrame:
    """Référence : fréquence passée du faux départ, par département × décade."""
    semis = passe[passe.pluie_mm >= PLUIE_SEMIS_MM]
    return semis.groupby(["code_departement", "numero_decade_annee"]).faux_depart.mean().rename("ref").reset_index()


# --- 2. Fin de saison trop tôt ------------------------------------------------------------------

def donnees_fin(m1: pd.DataFrame) -> pd.DataFrame:
    geo = lire("DIM_GEOGRAPHIE")[["id_departement", "code_departement"]]
    s = lire("FACT_SAISON_DEPARTEMENT").merge(geo, on="id_departement")
    s = s.rename(columns={"campagne_agricole": "annee"})[["code_departement", "annee", "fin_saison_jour"]]
    s = s[(s.annee >= PREMIERE_ANNEE) & s.fin_saison_jour.notna()].merge(m1, on="annee", how="left")
    return s


class ModeleFin:
    """Date de fin de saison : moyenne du département, avec une erreur supposée normale
    et un écart-type commun à tous les départements :
        P(fin avant tel jour) = Φ((jour − fin moyenne du département) / écart-type).
    Le modèle 1 a été testé ici : il ne décale la fin que d'un demi-jour, il n'est pas utilisé."""

    def fit(self, s: pd.DataFrame):
        self.moyennes = s.groupby("code_departement").fin_saison_jour.mean()
        self.sigma = float(np.std(s.fin_saison_jour - s.code_departement.map(self.moyennes)))
        return self

    def proba_fin_avant(self, codes: pd.Series, jour) -> np.ndarray:
        return norm.cdf((np.asarray(jour) - codes.map(self.moyennes).to_numpy()) / self.sigma)


# --- 3. Évaluation ------------------------------------------------------------------------------

def brier(p, y) -> float:
    return float(np.mean((np.asarray(p) - np.asarray(y)) ** 2))


def evaluer(fd: pd.DataFrame, fin: pd.DataFrame) -> pd.DataFrame:
    lignes = []
    passe_fd, test_fd = fd[fd.annee <= DERNIERE_ANNEE_ENTRAINEMENT], fd[fd.annee > DERNIERE_ANNEE_ENTRAINEMENT]
    semis_passe = passe_fd[(passe_fd.pluie_mm >= PLUIE_SEMIS_MM) & passe_fd.pluie_d2.notna()]
    semis_test = test_fd[(test_fd.pluie_mm >= PLUIE_SEMIS_MM) & test_fd.pluie_d2.notna()]

    clf = modele_faux_depart().fit(semis_passe[VARIABLES_FD], semis_passe.faux_depart)
    p_modele = clf.predict_proba(semis_test[VARIABLES_FD])[:, 1]
    ref = semis_test.merge(risque_faux_depart_climatologique(passe_fd), on=["code_departement", "numero_decade_annee"], how="left")
    p_ref = ref.ref.fillna(semis_passe.faux_depart.mean()).to_numpy()
    y = semis_test.faux_depart.to_numpy()
    lignes.append({
        "version_modele": VERSION, "risque": "faux départ", "periode": "test 2016-2025", "nb_cas": len(y),
        "frequence_observee_pct": round(100 * y.mean(), 1),
        "brier_modele": round(brier(p_modele, y), 4), "brier_reference": round(brier(p_ref, y), 4),
        "gain_vs_reference": round(1 - brier(p_modele, y) / brier(p_ref, y), 3),
        "auc_modele": round(roc_auc_score(y, p_modele), 3), "auc_reference": round(roc_auc_score(y, p_ref), 3),
    })

    # Fin trop tôt : évaluée sur un seuil par culture (cycle moyen, semis à chaque décade).
    passe_fin, test_fin = fin[fin.annee <= DERNIERE_ANNEE_ENTRAINEMENT], fin[fin.annee > DERNIERE_ANNEE_ENTRAINEMENT]
    mf = ModeleFin().fit(passe_fin)
    cycles = cycles_cultures()
    pm, pr, yy = [], [], []
    for _, c in cycles.iterrows():
        for d in DECADES_SEMIS:
            jour = jour_milieu_decade(d) + c.cycle_jours - MARGE_FIN_CYCLE_J
            pm.append(mf.proba_fin_avant(test_fin.code_departement, np.full(len(test_fin), jour)))
            freq = passe_fin.assign(avant=passe_fin.fin_saison_jour < jour).groupby("code_departement").avant.mean()
            pr.append(test_fin.code_departement.map(freq).to_numpy())
            yy.append((test_fin.fin_saison_jour < jour).astype(int).to_numpy())
    pm, pr, yy = np.concatenate(pm), np.concatenate(pr), np.concatenate(yy)
    lignes.append({
        "version_modele": VERSION, "risque": "fin trop tôt", "periode": "test 2016-2025", "nb_cas": len(yy),
        "frequence_observee_pct": round(100 * yy.mean(), 1),
        "brier_modele": round(brier(pm, yy), 4), "brier_reference": round(brier(pr, yy), 4),
        "gain_vs_reference": round(1 - brier(pm, yy) / brier(pr, yy), 3),
        "auc_modele": round(roc_auc_score(yy, pm), 3), "auc_reference": round(roc_auc_score(yy, pr), 3),
    })
    return pd.DataFrame(lignes)


def cycles_cultures() -> pd.DataFrame:
    c = lire("DIM_CULTURE")
    c = c[c.culture.isin(CULTURES)].copy()
    c["cycle_jours"] = (c.cycle_min_jours + c.cycle_max_jours) / 2
    return c[["culture", "cycle_jours"]].reset_index(drop=True)


# --- 4. Table de sortie -------------------------------------------------------------------------

def main():
    m1 = prevision_saison()
    fd, fin = donnees_faux_depart(m1), donnees_fin(m1)
    evaluation = evaluer(fd, fin)

    # Modèles entraînés sur 1986-2015, appliqués à 2016-2025 (test) et à une « année type ».
    passe_fd = fd[(fd.annee <= DERNIERE_ANNEE_ENTRAINEMENT) & (fd.pluie_mm >= PLUIE_SEMIS_MM) & fd.pluie_d2.notna()]
    clf = modele_faux_depart().fit(passe_fd[VARIABLES_FD], passe_fd.faux_depart)
    mf = ModeleFin().fit(fin[fin.annee <= DERNIERE_ANNEE_ENTRAINEMENT])
    proba_type = float(m1[m1.annee <= DERNIERE_ANNEE_ENTRAINEMENT].proba_seche_m1.mean())

    # Grille : département × décade, avec les normales de la décade (constantes d'une année à l'autre).
    grille = (fd[fd.annee == fd.annee.max()][["code_departement", "departement", "numero_decade_annee", "normale_d1", "normale_d2", "latitude"]]
              .drop_duplicates(["code_departement", "numero_decade_annee"]))
    # Chance d'avoir une pluie de semis à cette décade (fréquence 1986-2015).
    chance = (fd[fd.annee <= DERNIERE_ANNEE_ENTRAINEMENT]
              .assign(pluie_semis=lambda x: x.pluie_mm >= PLUIE_SEMIS_MM)
              .groupby(["code_departement", "numero_decade_annee"]).pluie_semis.mean().rename("chance_pluie_semis"))
    grille = grille.merge(chance.reset_index(), on=["code_departement", "numero_decade_annee"])
    # 2016-2025 : années de test ; au-delà (ex. 2026) : vraie prévision, sans pluie observée.
    derniere_observee = int(fd.annee.max())
    m1i = m1.set_index("annee")
    annees = [(a, "RETROSPECTIVE_TEST" if a <= derniere_observee else str(m1i.type_m1[a]), float(m1i.proba_seche_m1[a]))
              for a in range(DERNIERE_ANNEE_ENTRAINEMENT + 1, int(m1.annee.max()) + 1)]
    annees.append((None, "ANNEE_TYPE", proba_type))

    cycles = cycles_cultures()
    morceaux = []
    for annee, type_prevision, proba in annees:
        g = grille.assign(proba_seche_m1=proba)
        g["risque_faux_depart"] = clf.predict_proba(g[VARIABLES_FD])[:, 1]
        for _, c in cycles.iterrows():
            jour_limite = g.numero_decade_annee.map(jour_milieu_decade) + c.cycle_jours - MARGE_FIN_CYCLE_J
            r_fin = mf.proba_fin_avant(g.code_departement, jour_limite)
            morceaux.append(g.assign(
                annee=annee, type_prevision=type_prevision, culture=c.culture, cycle_jours=c.cycle_jours,
                risque_fin_trop_tot=r_fin,
            ))
    s = pd.concat(morceaux, ignore_index=True)
    # Les deux risques sont supposés indépendants : risque total = 1 − (1 − a)(1 − b).
    s["risque_total"] = 1 - (1 - s.risque_faux_depart) * (1 - s.risque_fin_trop_tot)
    # Décade conseillée : le risque total le plus bas, parmi les décades où une pluie de semis
    # arrive au moins une année sur deux (on ne peut pas semer sans pluie).
    cle = ["code_departement", "type_prevision", "annee", "culture"]
    possible = s.chance_pluie_semis >= CHANCE_PLUIE_MIN
    minimum = s.risque_total.where(possible).groupby([s[k] for k in cle], dropna=False).transform("min")
    s["decade_conseillee"] = possible & s.risque_total.eq(minimum)

    sortie = pd.DataFrame({
        "code_departement": s.code_departement,
        "departement": s.departement,
        "annee": s.annee.astype("Int64"),
        "type_prevision": s.type_prevision,
        "culture": s.culture,
        "cycle_jours": s.cycle_jours,
        "decade_semis": s.numero_decade_annee,
        "libelle_decade": s.numero_decade_annee.map(libelle_decade),
        "chance_pluie_semis_pct": (100 * s.chance_pluie_semis).round(0),
        "risque_faux_depart_pct": (100 * s.risque_faux_depart).round(1),
        "risque_fin_trop_tot_pct": (100 * s.risque_fin_trop_tot).round(1),
        "risque_total_pct": (100 * s.risque_total).round(1),
        "decade_conseillee": s.decade_conseillee,
        "proba_saison_seche_m1_pct": (100 * s.proba_seche_m1).round(1),
        "version_modele": VERSION,
        "date_calcul": date.today().isoformat(),
    }).sort_values(["type_prevision", "annee", "code_departement", "culture", "decade_semis"])

    SORTIES.mkdir(exist_ok=True)
    sortie.to_csv(SORTIES / "risque_semis.csv", index=False)
    evaluation.to_csv(SORTIES / "evaluation_m4.csv", index=False)

    pd.set_option("display.width", 220)
    print(evaluation.to_string(index=False))
    print(f"\nFin de saison : écart-type autour de la moyenne du département {mf.sigma:.1f} jours")
    print("Poids faux départ :", dict(zip(VARIABLES_FD, clf[-1].coef_[0].round(2), strict=True)))
    print(f"{len(sortie)} lignes → {SORTIES / 'risque_semis.csv'}")


if __name__ == "__main__":
    main()
