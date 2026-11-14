"""Modèle 2 — Années semblables : « cette année ressemble à… ».

Lancer depuis la racine du dépôt :
    venv/bin/python -m ml.m2_annees_semblables.entrainer

Pour chaque département, chaque année et chaque moment de la saison, on cherche
les années passées les plus proches, puis on regarde comment leur saison a fini.

Écrit dans ml/sorties/ :
    annees_semblables.csv   les 3 années les plus proches et ce qui s'y est passé
    evaluation_m2.csv       fiabilité, moment par moment, comparée à la climatologie
Rien n'est écrit dans Snowflake.
"""

from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

from ml.commun.donnees import lire
from ml.commun.evaluation import CLASSES_3, rpss

VERSION = "m2-v1"
SORTIES = Path(__file__).resolve().parents[1] / "sorties"
REGROUPEMENT = {"très sèche": 0, "sèche": 0, "normale": 1, "humide": 2, "très humide": 2}

NB_SEMBLABLES = 8       # années utilisées pour les probabilités
POIDS_OCEAN = 0.5       # en saison : poids total de l'océan, la pluie tombée pèse 1
NB_AFFICHEES = 3        # années montrées dans l'application
PREMIERE_ANNEE = 1991   # il faut au moins 10 années passées pour chercher des semblables

# Moment de la prévision → dernière décade de pluie connue (None = avant la saison).
MOMENTS = {"FIN_MAI": None, "FIN_JUIN": 18, "FIN_JUILLET": 21, "FIN_AOUT": 24}
OCEAN = ["indice_oni_mars_mai", "indice_tsa_mars_mai"]  # mêmes indices que le modèle 1


def preparer() -> pd.DataFrame:
    """Une ligne par département × année : océan, pluie cumulée à chaque moment, fin de la saison."""
    base = lire("MART_ML_PREVISION_PLUIE")[
        ["code_departement", "departement", "annee", *OCEAN, "classe_saison"]
    ].copy()
    # Années à venir (ml/entrees/indices_ocean.csv) : océan connu, saison pas encore observée.
    entrees = Path(__file__).resolve().parents[1] / "entrees" / "indices_ocean.csv"
    if entrees.exists():
        futur = pd.read_csv(entrees)
        futur = futur[~futur.annee.isin(base.annee)][["annee", *OCEAN]]
        deps = base[["code_departement", "departement"]].drop_duplicates()
        base = pd.concat([base, deps.merge(futur, how="cross")], ignore_index=True)
    base["classe"] = base.classe_saison.map(REGROUPEMENT)

    geo = lire("DIM_GEOGRAPHIE")[["id_departement", "code_departement"]]

    # Pluie cumulée depuis juin, comparée à la normale, à la fin de chaque moment.
    pluie = lire("FACT_PLUVIOMETRIE_DECADAIRE").merge(geo, on="id_departement")
    for moment, decade in MOMENTS.items():
        if decade is None:
            continue
        p = pluie[pluie.numero_decade_annee == decade]
        p = p.assign(**{f"cumul_{moment}": p.cumul_depuis_juin_mm / p.cumul_normale_depuis_juin_mm - 1})
        base = base.merge(p[["code_departement", "annee", f"cumul_{moment}"]], on=["code_departement", "annee"], how="left")

    # Ce qui s'est passé à la fin de chaque saison (affiché pour les années semblables).
    saison = lire("FACT_SAISON_DEPARTEMENT").merge(geo, on="id_departement").rename(columns={"campagne_agricole": "annee"})
    base = base.merge(
        saison[["code_departement", "annee", "pluie_saison_mm", "anomalie_pluie_saison_pct", "debut_saison_jour",
                "plus_longue_sequence_seche_j", "alerte_secheresse", "alerte_exces_pluie"]],
        on=["code_departement", "annee"], how="left",
    )
    return base


def variables_du_moment(moment: str, avec_ocean: bool = True) -> list[str]:
    v = list(OCEAN) if avec_ocean else []
    if MOMENTS[moment] is not None:
        v.append(f"cumul_{moment}")
    return v


def chercher(d: pd.DataFrame, moment: str, avec_ocean: bool = True):
    """Pour chaque ligne (département × année), les années passées du même département les plus proches.

    Rend un dict {(code, annee): [(annee_semblable, distance), ...]} trié par distance.
    Seules les années strictement antérieures sont candidates : c'est ce qu'on saurait en conditions réelles.
    """
    variables = variables_du_moment(moment, avec_ocean)
    # Mise à l'échelle sur 1981-2015, puis poids : en saison, l'océan (2 indices)
    # pèse au total moitié moins que la pluie tombée.
    ref = d[d.annee <= 2015]
    z = (d[variables] - ref[variables].mean()) / ref[variables].std()
    en_saison = MOMENTS[moment] is not None
    poids_tous = np.array([POIDS_OCEAN / len(OCEAN) if (v in OCEAN and en_saison) else 1.0 for v in variables])

    resultat = {}
    for code, groupe in d.groupby("code_departement"):
        zg = z.loc[groupe.index]
        # Département sans pluie décadaire (Guédiawaye) : on garde seulement l'océan.
        utiles = [k for k, v in enumerate(variables) if zg[v].notna().any()]
        if not utiles:
            continue
        valeurs, poids = zg.to_numpy()[:, utiles], poids_tous[utiles]
        annees = groupe.annee.to_numpy()
        for i, annee in enumerate(annees):
            if annee < PREMIERE_ANNEE or np.isnan(valeurs[i]).any():
                continue
            candidats = np.where((annees < annee) & ~np.isnan(valeurs).any(axis=1))[0]
            dist = np.sqrt(((valeurs[candidats] - valeurs[i]) ** 2 * poids).sum(axis=1) / poids.sum())
            ordre = np.argsort(dist)[:NB_SEMBLABLES]
            resultat[(code, int(annee))] = [(int(annees[candidats[j]]), float(dist[j])) for j in ordre]
    return resultat


def probabilites(d: pd.DataFrame, semblables: dict) -> pd.DataFrame:
    """Probabilités des 3 classes = part des années semblables dans chaque classe,
    lissée vers la climatologie des années passées (évite les 0 % et 100 %)."""
    classe = d.set_index(["code_departement", "annee"]).classe
    lignes = []
    for (code, annee), voisins in semblables.items():
        passe = d[d.annee < annee].classe
        passe = passe.dropna().astype(int)
        climato = np.bincount(passe, minlength=3) / len(passe)
        compte = np.bincount([int(classe[(code, a)]) for a, _ in voisins], minlength=3)
        p = (compte + 2 * climato) / (len(voisins) + 2)
        lignes.append({"code_departement": code, "annee": annee, "observe": classe[(code, annee)],
                       "p": p, "climato": climato})
    return pd.DataFrame(lignes)


def evaluer(d: pd.DataFrame) -> pd.DataFrame:
    lignes = []
    for moment, decade in MOMENTS.items():
        for avec_ocean in (True, False):
            if not avec_ocean and decade is None:
                continue
            pr = probabilites(d, chercher(d, moment, avec_ocean))
            for nom, lo, hi in [("2001-2015", 2001, 2015), ("test 2016-2025", 2016, 2025)]:
                s = pr[pr.annee.between(lo, hi)]
                lignes.append({
                    "version_modele": VERSION, "moment": moment,
                    "variables": "océan + pluie tombée" if avec_ocean and decade else
                                 ("océan" if avec_ocean else "pluie tombée seule"),
                    "periode": nom, "nb_lignes": len(s),
                    "rpss_vs_climatologie": round(rpss(np.vstack(s.p), s.observe.astype(int).to_numpy(), np.vstack(s.climato)), 3),
                    "classe_juste_pct": round(100 * np.mean(np.vstack(s.p).argmax(1) == s.observe), 1),
                })
    return pd.DataFrame(lignes)


def main():
    d = preparer()
    info = d.set_index(["code_departement", "annee"])

    lignes = []
    for moment, decade in MOMENTS.items():
        semblables = chercher(d, moment)
        probas = probabilites(d, semblables).set_index(["code_departement", "annee"])
        for (code, annee), voisins in semblables.items():
            # Fin mai, les années semblables prévoient moins bien que la climatologie :
            # pas de probabilités, l'application affiche celles du modèle 1.
            p = probas.loc[(code, annee), "p"] if decade is not None else np.full(3, np.nan)
            sans_pluie = decade is None or pd.isna(info.loc[(code, annee), f"cumul_{moment}"])
            for rang, (a, dist) in enumerate(voisins[:NB_AFFICHEES], start=1):
                s = info.loc[(code, a)]
                lignes.append({
                    "code_departement": code,
                    "departement": info.loc[(code, annee), "departement"],
                    "annee": annee,
                    "moment_prevision": moment,
                    "variables_utilisees": "océan" if sans_pluie else "océan + pluie tombée",
                    "rang": rang,
                    "annee_semblable": a,
                    # 100 = identique ; 61 = un écart-type d'écart en moyenne ; 14 = deux écarts-types.
                    "ressemblance_pct": round(100 * np.exp(-(dist**2) / 2), 0),
                    "pluie_saison_semblable_mm": round(s.pluie_saison_mm, 0),
                    "anomalie_saison_semblable_pct": round(s.anomalie_pluie_saison_pct, 1),
                    "classe_saison_semblable": s.classe_saison,
                    "debut_saison_jour_semblable": s.debut_saison_jour,
                    "plus_longue_sequence_seche_semblable_j": s.plus_longue_sequence_seche_j,
                    "alerte_secheresse_semblable": s.alerte_secheresse,
                    "alerte_exces_pluie_semblable": s.alerte_exces_pluie,
                    "proba_seche_pct": round(100 * p[0], 1),
                    "proba_normale_pct": round(100 * p[1], 1),
                    "proba_humide_pct": round(100 * p[2], 1),
                    "classe_prevue": None if decade is None else CLASSES_3[int(np.argmax(p))],
                    "version_modele": VERSION,
                    "date_calcul": date.today().isoformat(),
                })
    sortie = pd.DataFrame(lignes).sort_values(["annee", "code_departement", "moment_prevision", "rang"])
    # Année pas encore observée (ex. 2026) : seule la comparaison de fin mai a un sens (pas de pluie tombée).
    derniere_observee = int(d[d.classe.notna()].annee.max())
    sortie = sortie[(sortie.annee <= derniere_observee) | (sortie.moment_prevision == "FIN_MAI")]
    evaluation = evaluer(d)

    SORTIES.mkdir(exist_ok=True)
    sortie.to_csv(SORTIES / "annees_semblables.csv", index=False)
    evaluation.to_csv(SORTIES / "evaluation_m2.csv", index=False)

    pd.set_option("display.width", 200)
    print(evaluation.to_string(index=False))
    print(f"\n{len(sortie)} lignes → {SORTIES / 'annees_semblables.csv'}")


if __name__ == "__main__":
    main()
