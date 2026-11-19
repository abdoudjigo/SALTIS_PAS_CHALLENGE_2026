"""Modèle 1 — Prévision de la saison des pluies, faite fin mai.

Lancer depuis la racine du dépôt :
    venv/bin/python -m ml.m1_prevision_saison.entrainer

Lit SALTIS.MARTS (lecture seule) et écrit dans ml/sorties/ :
    prevision_saison.csv    une ligne par département × année
    evaluation_m1.csv       fiabilité du modèle comparée à la climatologie
Rien n'est écrit dans Snowflake.
"""

from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from ml.commun.donnees import lire
from ml.commun.evaluation import CLASSES_3, rmse, rpss

VERSION = "m1-v1"
DERNIERE_ANNEE_ENTRAINEMENT = 2015
SORTIES = Path(__file__).resolve().parents[1] / "sorties"

# Les 5 classes de la source (SPI) regroupées en 3.
REGROUPEMENT = {"très sèche": 0, "sèche": 0, "normale": 1, "humide": 2, "très humide": 2}

# Deux indices océaniques, mêmes valeurs pour tous les départements d'une année.
# Choisis parce qu'ils donnent la meilleure validation (voir README) ; les autres
# variables testées n'amélioraient rien.
VARIABLES = ["indice_oni_mars_mai", "indice_tsa_mars_mai"]
REGULARISATION = 0.01  # forte : peu d'années, on évite d'apprendre le bruit


def preparer() -> pd.DataFrame:
    d = lire("MART_ML_PREVISION_PLUIE").copy()
    d["anomalie"] = d.pluie_saison_mm / d.pluie_normale_saison_mm - 1
    d["classe"] = d.classe_saison.map(REGROUPEMENT)
    return d.reset_index(drop=True)


def entrainer(donnees: pd.DataFrame):
    clf = make_pipeline(StandardScaler(), LogisticRegression(C=REGULARISATION, max_iter=2000))
    reg = make_pipeline(StandardScaler(), Ridge(alpha=1 / REGULARISATION))
    clf.fit(donnees[VARIABLES], donnees.classe)
    reg.fit(donnees[VARIABLES], donnees.anomalie)
    return clf, reg


def frequences(classes: pd.Series) -> np.ndarray:
    """Prévision de référence (climatologie) : la fréquence passée de chaque classe."""
    return np.bincount(classes, minlength=3) / len(classes)


ENTREES = Path(__file__).resolve().parents[1] / "entrees" / "indices_ocean.csv"


def prevision_operationnelle(d: pd.DataFrame, bas: float, haut: float) -> pd.DataFrame:
    """Prévision des années absentes du mart, à partir des indices de ml/entrees/indices_ocean.csv.
    Pas d'observation : pluie et classe observées restent vides."""
    if not ENTREES.exists():
        return pd.DataFrame()
    indices = pd.read_csv(ENTREES)
    indices = indices[~indices.annee.isin(d.annee)]
    if indices.empty:
        return pd.DataFrame()
    clf, reg = entrainer(d)  # toutes les années connues
    derniere = d[d.annee == d.annee.max()][["code_departement", "departement", "zone_agroecologique", "pluie_normale_saison_mm"]]
    lignes = derniere.merge(indices[["annee", *VARIABLES]], how="cross")
    p = clf.predict_proba(lignes[VARIABLES])
    a = reg.predict(lignes[VARIABLES])
    n = lignes.pluie_normale_saison_mm.to_numpy()
    return pd.DataFrame({
        "code_departement": lignes.code_departement,
        "departement": lignes.departement,
        "zone_agroecologique": lignes.zone_agroecologique,
        "annee": lignes.annee,
        "type_prevision": "PREVISION_OCEAN",
        "proba_seche_pct": (100 * p[:, 0]).round(1),
        "proba_normale_pct": (100 * p[:, 1]).round(1),
        "proba_humide_pct": (100 * p[:, 2]).round(1),
        "classe_prevue": np.array(CLASSES_3)[p.argmax(1)],
        "pluie_prevue_mm": (n * (1 + a)).round(0),
        "pluie_basse_mm": np.maximum(n * (1 + a + bas), 0).round(0),
        "pluie_haute_mm": (n * (1 + a + haut)).round(0),
        "pluie_normale_mm": n.round(0),
        "pluie_observee_mm": np.nan,
        "classe_observee": None,
        "version_modele": VERSION,
        "date_calcul": date.today().isoformat(),
    })


DERNIERE_ANNEE_SAISISSABLE = 2035
FENETRE_TENDANCE = 15  # saisons récentes


def prevision_tendance(d: pd.DataFrame, annees: list[int]) -> tuple[pd.DataFrame, dict]:
    """Prévision de tendance, pour les années dont l'océan de mars-mai n'est pas encore connu (ex. 2027).

    Pluie attendue = moyenne des 15 dernières saisons observées du département ; fourchette = 10e et 90e
    centiles des écarts mesurés quand on prévoit ainsi une saison à 1-5 ans (2001-2025) ; probabilités =
    fréquence des classes sur ces 15 saisons, lissée vers la climatologie. Remplacée par la prévision océan
    dès que les indices de mai de l'année sont publiés.
    """
    d = d.sort_values(["code_departement", "annee"])
    # Fiabilité et fourchette, mesurées en prévoyant chaque saison 2001-2025 avec les 15 saisons d'avant (horizons 1 à 5 ans).
    ecarts, erreurs_tendance, erreurs_normale, probas, observes, refs = [], [], [], [], [], []
    climato = np.bincount(d.classe, minlength=3) / len(d)
    for annee in range(2001, int(d.annee.max()) + 1):
        obs = d[d.annee == annee].set_index("code_departement")
        for horizon in range(1, 6):
            fen = d[(d.annee <= annee - horizon) & (d.annee > annee - horizon - FENETRE_TENDANCE)]
            moy = fen.groupby("code_departement").pluie_saison_mm.mean().reindex(obs.index)
            ecarts.append((obs.pluie_saison_mm / moy - 1).dropna())
            if horizon == 1 and annee > DERNIERE_ANNEE_ENTRAINEMENT:
                erreurs_tendance.append((moy - obs.pluie_saison_mm).dropna())
                erreurs_normale.append((obs.pluie_normale_saison_mm - obs.pluie_saison_mm).dropna())
                comptes = fen.groupby("code_departement").classe.apply(lambda c: np.bincount(c, minlength=3)).reindex(obs.index)
                for code, compte in comptes.items():
                    probas.append((compte + 2 * climato) / (compte.sum() + 2))
                    observes.append(int(obs.classe[code]))
                    refs.append(climato)
    ecarts = pd.concat(ecarts)
    bas, haut = np.quantile(ecarts, [0.10, 0.90])
    fiabilite = {
        "rmse_tendance_mm": round(float(np.sqrt((pd.concat(erreurs_tendance) ** 2).mean())), 1),
        "rmse_normale_mm": round(float(np.sqrt((pd.concat(erreurs_normale) ** 2).mean())), 1),
        "rpss_vs_climatologie": round(rpss(np.array(probas), np.array(observes), np.array(refs)), 3),
        "fourchette_basse_pct": round(100 * bas, 1), "fourchette_haute_pct": round(100 * haut, 1),
    }

    recent = d[d.annee > d.annee.max() - FENETRE_TENDANCE]
    par_dep = recent.groupby(["code_departement", "departement", "zone_agroecologique"]).agg(
        pluie=("pluie_saison_mm", "mean"), normale=("pluie_normale_saison_mm", "last"),
        comptes=("classe", lambda c: np.bincount(c, minlength=3)),
    ).reset_index()
    p = np.vstack([(c + 2 * climato) / (c.sum() + 2) for c in par_dep.comptes])
    lignes = []
    for annee in annees:
        lignes.append(pd.DataFrame({
            "code_departement": par_dep.code_departement,
            "departement": par_dep.departement,
            "zone_agroecologique": par_dep.zone_agroecologique,
            "annee": annee,
            "type_prevision": "PREVISION_TENDANCE",
            "proba_seche_pct": (100 * p[:, 0]).round(1),
            "proba_normale_pct": (100 * p[:, 1]).round(1),
            "proba_humide_pct": (100 * p[:, 2]).round(1),
            "classe_prevue": np.array(CLASSES_3)[p.argmax(1)],
            "pluie_prevue_mm": par_dep.pluie.round(0),
            "pluie_basse_mm": np.maximum(par_dep.pluie * (1 + bas), 0).round(0),
            "pluie_haute_mm": (par_dep.pluie * (1 + haut)).round(0),
            "pluie_normale_mm": par_dep.normale.round(0),
            "pluie_observee_mm": np.nan,
            "classe_observee": None,
            "version_modele": VERSION,
            "date_calcul": date.today().isoformat(),
        }))
    return pd.concat(lignes, ignore_index=True), fiabilite


def main():
    d = preparer()
    passe = d[d.annee <= DERNIERE_ANNEE_ENTRAINEMENT]
    test = d[d.annee > DERNIERE_ANNEE_ENTRAINEMENT]

    # 1. Années 1981-2015 : chaque année est prévue par un modèle qui ne l'a pas vue.
    #    La climatologie de référence est calculée de la même façon (comparaison équitable).
    probas, anomalies, reference = (np.zeros((len(passe), 3)), np.zeros(len(passe)), np.zeros((len(passe), 3)))
    for annee in passe.annee.unique():
        garde = (passe.annee != annee).to_numpy()
        clf, reg = entrainer(passe[garde])
        probas[~garde] = clf.predict_proba(passe.loc[~garde, VARIABLES])
        anomalies[~garde] = reg.predict(passe.loc[~garde, VARIABLES])
        reference[~garde] = frequences(passe.classe[garde])

    # Fourchette de pluie : 10e et 90e centiles des erreurs de cette validation.
    bas, haut = np.quantile(passe.anomalie - anomalies, [0.10, 0.90])

    # 2. Années 2016-2025 : modèle entraîné sur 1981-2015 seulement.
    clf, reg = entrainer(passe)
    probas_test = clf.predict_proba(test[VARIABLES])
    anomalies_test = reg.predict(test[VARIABLES])
    reference_test = np.tile(frequences(passe.classe), (len(test), 1))

    # 3. Fiabilité.
    pluie_test = test.pluie_normale_saison_mm * (1 + anomalies_test)
    evaluation = pd.DataFrame([
        {
            "version_modele": VERSION,
            "periode": "validation 1981-2015 (une année de côté)",
            "nb_lignes": len(passe),
            "rpss_vs_climatologie": round(rpss(probas, passe.classe.to_numpy(), reference), 3),
            "classe_juste_pct": round(100 * np.mean(probas.argmax(1) == passe.classe), 1),
            "classe_juste_climatologie_pct": round(100 * np.mean(reference.argmax(1) == passe.classe), 1),
        },
        {
            "version_modele": VERSION,
            "periode": "test 2016-2025",
            "nb_lignes": len(test),
            "rpss_vs_climatologie": round(rpss(probas_test, test.classe.to_numpy(), reference_test), 3),
            "classe_juste_pct": round(100 * np.mean(probas_test.argmax(1) == test.classe), 1),
            "classe_juste_climatologie_pct": round(100 * np.mean(reference_test.argmax(1) == test.classe), 1),
            "rmse_modele_mm": round(rmse(pluie_test, test.pluie_saison_mm), 1),
            "rmse_normale_mm": round(rmse(test.pluie_normale_saison_mm, test.pluie_saison_mm), 1),
            "fourchette_contient_observe_pct": round(100 * np.mean(
                (test.anomalie >= anomalies_test + bas) & (test.anomalie <= anomalies_test + haut)), 1),
        },
    ])

    # 4. Table de sortie : une ligne par département × année.
    toutes = pd.concat([
        passe.assign(type_prevision="RETROSPECTIVE_VALIDATION"),
        test.assign(type_prevision="RETROSPECTIVE_TEST"),
    ])
    p = np.vstack([probas, probas_test])
    a = np.concatenate([anomalies, anomalies_test])
    n = toutes.pluie_normale_saison_mm.to_numpy()
    sortie = pd.DataFrame({
        "code_departement": toutes.code_departement.to_numpy(),
        "departement": toutes.departement.to_numpy(),
        "zone_agroecologique": toutes.zone_agroecologique.to_numpy(),
        "annee": toutes.annee.to_numpy(),
        "type_prevision": toutes.type_prevision.to_numpy(),
        "proba_seche_pct": (100 * p[:, 0]).round(1),
        "proba_normale_pct": (100 * p[:, 1]).round(1),
        "proba_humide_pct": (100 * p[:, 2]).round(1),
        "classe_prevue": np.array(CLASSES_3)[p.argmax(1)],
        "pluie_prevue_mm": (n * (1 + a)).round(0),
        "pluie_basse_mm": np.maximum(n * (1 + a + bas), 0).round(0),
        "pluie_haute_mm": (n * (1 + a + haut)).round(0),
        "pluie_normale_mm": n.round(0),
        "pluie_observee_mm": toutes.pluie_saison_mm.round(0).to_numpy(),
        "classe_observee": toutes.classe.map(dict(enumerate(CLASSES_3))).to_numpy(),
        "version_modele": VERSION,
        "date_calcul": date.today().isoformat(),
    }).sort_values(["annee", "code_departement"])

    # 5. Années à venir (ml/entrees/indices_ocean.csv) : modèle réentraîné sur toutes les années connues.
    futur = prevision_operationnelle(d, bas, haut)
    # 6. Années saisissables sans océan connu (2027-2035) : prévision de tendance.
    deja = set(d.annee) | (set(futur.annee) if not futur.empty else set())
    annees_tendance = [a for a in range(int(d.annee.max()) + 1, DERNIERE_ANNEE_SAISISSABLE + 1) if a not in deja]
    tendance, fiab_tendance = prevision_tendance(d, annees_tendance)
    sortie = pd.concat([sortie, futur, tendance], ignore_index=True).sort_values(["annee", "code_departement"])
    evaluation = pd.concat([evaluation, pd.DataFrame([{
        "version_modele": VERSION, "periode": "tendance 15 ans, test 2016-2025 (sans océan, années à venir)",
        "nb_lignes": 450, "rpss_vs_climatologie": fiab_tendance["rpss_vs_climatologie"],
        "rmse_modele_mm": fiab_tendance["rmse_tendance_mm"], "rmse_normale_mm": fiab_tendance["rmse_normale_mm"],
    }])], ignore_index=True)
    print("Prévision de tendance :", fiab_tendance)

    poids = pd.DataFrame(clf[-1].coef_, index=CLASSES_3, columns=VARIABLES).T.round(3)

    SORTIES.mkdir(exist_ok=True)
    sortie.to_csv(SORTIES / "prevision_saison.csv", index=False)
    evaluation.to_csv(SORTIES / "evaluation_m1.csv", index=False)

    pd.set_option("display.width", 200)
    print(evaluation.T.to_string(header=False))
    print("\nPoids des variables (positif = rend la classe plus probable) :")
    print(poids.to_string())
    print(f"\nFourchette de pluie : prévision {bas:+.1%} / {haut:+.1%}")
    print(f"{len(sortie)} lignes → {SORTIES / 'prevision_saison.csv'}")


if __name__ == "__main__":
    main()
