"""Modèle 3 — Rendement prévu et alerte récolte.

Lancer depuis la racine du dépôt :
    venv/bin/python -m ml.m3_rendement.entrainer

Pour chaque département × culture × campagne, à quatre moments (fin mai, fin juin,
fin juillet, fin août), le modèle prévoit la distribution du rendement par rapport
à la tendance du département. On en tire, avec la même mécanique :
    - la fourchette de rendement (année difficile / médiane / bonne année) ;
    - la probabilité que la récolte chute (rendement < 80 % de la tendance).

Écrit dans ml/sorties/ :
    prevision_rendement.csv   une ligne par département × culture × campagne × moment
    evaluation_m3.csv         fiabilité par période, moment et culture, comparée à la référence
Rien n'est écrit dans Snowflake.
"""

from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from ml.commun.donnees import lire
from ml.commun.evaluation import rmse
from ml.m1_prevision_saison import entrainer as m1

VERSION = "m3-v1"
SORTIES = Path(__file__).resolve().parents[1] / "sorties"

# Cultures pluviales assez observées (voir ml/README.md, section 4).
CULTURES = ["ARACHIDE", "MIL (SOUNA)", "SORGHO", "NIÉBÉ", "MAÏS"]

# Périodes. La cible s'arrête en 2015 : à partir de 2016 les superficies sont semées
# et non plus récoltées, les rendements ne sont plus comparables.
PREMIERE_ANNEE = 1991            # première année d'apprentissage
VALIDATION = range(2001, 2009)   # sert à choisir les réglages
TEST = range(2009, 2016)         # jamais regardé pour choisir
DERNIERE_ANNEE_CIBLE = 2015
PROJECTION = range(2022, 2026)   # campagnes passées sans rendement observé (non évaluables)
# Campagnes à venir (2026 à 2035) : ce sont les années `PREVISION_*` de prevision_saison.csv
# (modèle 1). Prévues fin mai seulement : aucune pluie observée.
PREVISION_SAISON = SORTIES / "prevision_saison.csv"
SOURCES_SAISON = {"PREVISION_OCEAN": "océan", "PREVISION_TENDANCE": "tendance"}

# Tendance « normale » : moyenne des rendements observés des 10 campagnes précédentes.
FENETRE_TENDANCE = 10
MIN_OBS_TENDANCE = 5
SEUIL_CHUTE = 0.8                # chute = rendement < 80 % de la tendance

# Moment → (dernière décade de pluie connue, dernier jour de l'année connu, libellé).
MOMENTS = {
    "FIN_MAI": (None, 151, "fin mai"),
    "FIN_JUIN": (18, 181, "fin juin"),
    "FIN_JUILLET": (21, 212, "fin juillet"),
    "FIN_AOUT": (24, 243, "fin août"),
}

# La distribution du rapport rendement / tendance est prévue seuil par seuil :
# pour chaque seuil, une régression logistique donne P(rapport < seuil).
SEUILS = np.array([0.25, 0.4, 0.55, 0.7, 0.8, 0.9, 1.0, 1.15, 1.3, 1.6, 2.0, 2.6])
REGULARISATION = 0.01            # forte (C de la régression logistique), choisie en validation
GAIN_MINIMAL = 0.02              # gain minimal sur la référence pour dire « fiable »
AUC_MINIMALE = 0.55              # l'alerte doit aussi savoir classer (0,5 = hasard)
POUSSEE_MINIMALE = 0.05          # en dessous, une variable n'est pas citée dans l'explication

FIXES = ["latitude", "pluie_normale_saison_mm", "log_tendance", "variabilite_passee"]
MODELE_1 = ["m1_proba_seche", "m1_proba_humide"]
PLUIE = ["cumul_vs_normale", "nb_decades_seches", "jour_demarrage_connu"]
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre"]


def variables(moment: str) -> list[str]:
    """Variables autorisées à ce moment. Fin mai : rien de la saison en cours."""
    v = [f"culture_{c}" for c in CULTURES] + FIXES + MODELE_1
    if MOMENTS[moment][0] is not None:
        v += [f"{p}_{moment}" for p in PLUIE]
    return v


# ---------------------------------------------------------------------------
# Préparation des données
# ---------------------------------------------------------------------------

def tendances(rendements: pd.DataFrame, derniere_annee: int = PROJECTION[-1]) -> pd.DataFrame:
    """Tendance de chaque département × culture × campagne, calculée avec le passé seulement.

    Moyenne des rendements observés des 10 campagnes précédentes (au moins 5),
    mesurés avec le même type de superficie que la dernière campagne connue.
    Rend aussi la variabilité passée (écart-type / moyenne de ces mêmes rendements).
    """
    lignes = []
    for (code, culture), g in rendements.groupby(["code_departement", "culture"]):
        annees, valeurs, types = g.annee.to_numpy(), g.rendement_kg_ha.to_numpy(), g.type_superficie.to_numpy()
        for annee in range(PREMIERE_ANNEE, derniere_annee + 1):
            passe = (annees < annee) & (annees >= annee - FENETRE_TENDANCE)
            if passe.any():
                passe &= types == types[passe][-1]
            if passe.sum() >= MIN_OBS_TENDANCE:
                y = valeurs[passe]
                lignes.append((code, culture, annee, y.mean(), y.std() / y.mean()))
    return pd.DataFrame(lignes, columns=["code_departement", "culture", "annee", "tendance_kg_ha", "variabilite_passee"])


def saisons_a_venir() -> pd.DataFrame:
    """Prévisions de saison des campagnes à venir, telles que l'application les affiche.

    Lignes `PREVISION_OCEAN` (2026) et `PREVISION_TENDANCE` (2027-2035) de prevision_saison.csv,
    par département. Lancer le modèle 1 avant le modèle 3.
    """
    assert PREVISION_SAISON.exists(), f"{PREVISION_SAISON} absent : lancer d'abord ml.m1_prevision_saison.entrainer"
    s = pd.read_csv(PREVISION_SAISON)
    s = s[s.type_prevision.str.startswith("PREVISION")]
    assert s.annee.min() > PROJECTION[-1], "une année déjà observée est marquée comme prévision"
    assert set(s.type_prevision) <= set(SOURCES_SAISON), "type de prévision de saison non prévu"
    return pd.DataFrame({
        "code_departement": s.code_departement.to_numpy(), "annee": s.annee.to_numpy(),
        "m1_proba_seche": s.proba_seche_pct.to_numpy() / 100, "m1_proba_humide": s.proba_humide_pct.to_numpy() / 100,
        # Sert à l'explication : « prévision de saison 2027 (tendance) ».
        "m1_source": s.annee.astype(str) + " (" + s.type_prevision.map(SOURCES_SAISON) + ")",
    })


def previsions_modele_1(a_venir: pd.DataFrame) -> pd.DataFrame:
    """Probabilités du modèle 1 telles qu'on les aurait eues fin mai.

    Jusqu'en 2015, le modèle 1 est réentraîné pour chaque année sur les seules années
    antérieures ; de 2016 à 2025, il est entraîné sur 1981-2015 (comme dans le modèle 1).
    Campagnes à venir : probabilités de prevision_saison.csv, reprises telles quelles
    (`a_venir`), pour que l'alerte récolte soit cohérente avec « La saison qui vient ».
    """
    d = m1.preparer()
    lignes = []
    for annee in range(PREMIERE_ANNEE, PROJECTION[-1] + 1):
        clf, _ = m1.entrainer(d[d.annee < min(annee, m1.DERNIERE_ANNEE_ENTRAINEMENT + 1)])
        cible = d[d.annee == annee]
        p = clf.predict_proba(cible[m1.VARIABLES])
        lignes.append(pd.DataFrame({
            "code_departement": cible.code_departement.to_numpy(), "annee": annee,
            "pluie_normale_saison_mm": cible.pluie_normale_saison_mm.to_numpy(),
            "m1_proba_seche": p[:, 0], "m1_proba_humide": p[:, 2],
        }))
    # Mêmes normales que la dernière année du mart.
    normales = d[d.annee == d.annee.max()][["code_departement", "pluie_normale_saison_mm"]]
    lignes.append(a_venir.merge(normales, on="code_departement"))
    return pd.concat(lignes)


def pluie_aux_moments(geo: pd.DataFrame) -> pd.DataFrame:
    """Pluie connue à chaque moment : cumul depuis juin comparé à la normale, nombre de
    décades sèches depuis juin, et jour de démarrage de la saison s'il est déjà passé."""
    pluie = lire("FACT_PLUVIOMETRIE_DECADAIRE").merge(geo, on="id_departement")
    saison = lire("FACT_SAISON_DEPARTEMENT").merge(geo, on="id_departement").rename(columns={"campagne_agricole": "annee"})
    base = saison[["code_departement", "annee", "debut_saison_jour"]]
    for moment, (decade, jour, _) in MOMENTS.items():
        if decade is None:
            continue
        # Uniquement les décades 16 (début juin) à la décade du moment : rien de postérieur.
        p = pluie[pluie.numero_decade_annee.between(16, decade)].sort_values("numero_decade_annee")
        g = p.groupby(["code_departement", "annee"])
        f = pd.DataFrame({
            f"cumul_vs_normale_{moment}": g.cumul_depuis_juin_mm.last() / g.cumul_normale_depuis_juin_mm.last() - 1,
            f"nb_decades_seches_{moment}": g.decade_seche.sum().astype(float),
        }).reset_index()
        base = base.merge(f, on=["code_departement", "annee"], how="left")
        # Le démarrage n'est connu que s'il a déjà eu lieu ; sinon on sait seulement
        # « pas avant aujourd'hui » : on met le jour du moment.
        demarree = base.debut_saison_jour <= jour
        base[f"saison_demarree_{moment}"] = demarree
        base[f"jour_demarrage_connu_{moment}"] = np.where(demarree, base.debut_saison_jour, jour)
        base.loc[base[f"cumul_vs_normale_{moment}"].isna(), f"jour_demarrage_connu_{moment}"] = np.nan
    return base.drop(columns="debut_saison_jour")


def lire_rendements(geo: pd.DataFrame) -> pd.DataFrame:
    """Rendements observés des 5 cultures (`rendement_kg_ha` renseigné, pas `est_observe`)."""
    r = (lire("FACT_RENDEMENT_DEPARTEMENT")
         .merge(lire("DIM_CULTURE")[["id_culture", "culture"]], on="id_culture")
         .merge(geo[["id_departement", "code_departement"]], on="id_departement")
         .rename(columns={"campagne_agricole": "annee"}))
    r = r[r.rendement_kg_ha.notna() & r.culture.isin(CULTURES)]
    return r[["code_departement", "culture", "annee", "rendement_kg_ha", "type_superficie"]].sort_values("annee")


def preparer() -> pd.DataFrame:
    """Une ligne par département × culture × campagne où la tendance est calculable."""
    geo = lire("DIM_GEOGRAPHIE")
    r = lire_rendements(geo)

    a_venir = saisons_a_venir()
    annees_a_venir = sorted(a_venir.annee.unique())
    # Campagnes à venir : même règle que pour 2022-2025, la tendance des dernières campagnes
    # observées. Elle est calculée pour la première année à venir, puis reprise pour les suivantes
    # (aucun rendement nouveau ne sera observé entre-temps).
    d = tendances(r, annees_a_venir[0])
    premiere = d[d.annee == annees_a_venir[0]]
    d = pd.concat([d, *(premiere.assign(annee=a) for a in annees_a_venir[1:])], ignore_index=True)
    # Rendement observé : gardé seulement jusqu'en 2015 (cible comparable à la tendance).
    d = d.merge(r[r.annee <= DERNIERE_ANNEE_CIBLE].drop(columns="type_superficie"),
                on=["code_departement", "culture", "annee"], how="left")
    d = d[d.rendement_kg_ha.notna() | d.annee.isin([*PROJECTION, *annees_a_venir])]
    d["rapport"] = d.rendement_kg_ha / d.tendance_kg_ha
    d["log_tendance"] = np.log(d.tendance_kg_ha)
    for c in CULTURES:
        d[f"culture_{c}"] = (d.culture == c).astype(float)

    d = d.merge(geo[["code_departement", "departement", "zone_agroecologique", "latitude"]], on="code_departement")
    d = d.merge(previsions_modele_1(a_venir), on=["code_departement", "annee"], how="left")
    d = d.merge(pluie_aux_moments(geo[["id_departement", "code_departement"]]), on=["code_departement", "annee"], how="left")
    return d.sort_values(["annee", "code_departement", "culture"]).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Modèle et référence
# ---------------------------------------------------------------------------

def quantile(repartition: np.ndarray, niveau: float) -> np.ndarray:
    """Rapport rendement / tendance au niveau demandé, lu sur la distribution prévue."""
    return np.array([np.interp(niveau, f, SEUILS) for f in repartition])


def prevoir(passe: pd.DataFrame, cible: pd.DataFrame, moment: str) -> pd.DataFrame:
    """Entraîne sur `passe` et prévoit `cible` : fourchette, probabilité de chute, explication."""
    v = variables(moment)
    repartition = np.zeros((len(cible), len(SEUILS)))
    for k, seuil in enumerate(SEUILS):
        modele = make_pipeline(StandardScaler(), LogisticRegression(C=REGULARISATION, max_iter=2000))
        modele.fit(passe[v], passe.rapport < seuil)
        repartition[:, k] = modele.predict_proba(cible[v])[:, 1]
        if seuil == SEUIL_CHUTE:
            # Ce qui pousse la probabilité de chute : poids × écart à la moyenne (en log-cote).
            pousse = modele[0].transform(cible[v]) * modele[1].coef_[0]
    repartition = np.maximum.accumulate(repartition, axis=1)  # une distribution ne décroît jamais

    pousse = pd.DataFrame(pousse, columns=v, index=cible.index)
    return pd.DataFrame({
        "rapport_bas": quantile(repartition, 0.10),
        "rapport_median": quantile(repartition, 0.50),
        "rapport_haut": quantile(repartition, 0.90),
        "proba_chute": repartition[:, list(SEUILS).index(SEUIL_CHUTE)],
        "explication": [expliquer(cible.loc[i], pousse.loc[i], moment) for i in cible.index],
    }, index=cible.index)


def reference(passe: pd.DataFrame, cible: pd.DataFrame) -> pd.DataFrame:
    """Prévision naïve : ce qui s'est passé jusque-là pour la culture, sans rien savoir de l'année.

    Fréquence passée des chutes et quantiles passés du rapport rendement / tendance.
    """
    par_culture = passe.groupby("culture").rapport
    return pd.DataFrame({
        "ref_rapport_bas": cible.culture.map(par_culture.quantile(0.10)),
        "ref_rapport_median": cible.culture.map(par_culture.quantile(0.50)),
        "ref_rapport_haut": cible.culture.map(par_culture.quantile(0.90)),
        "ref_proba_chute": cible.culture.map(par_culture.apply(lambda x: (x < SEUIL_CHUTE).mean())),
    }, index=cible.index)


def expliquer(ligne: pd.Series, pousse: pd.Series, moment: str) -> str:
    """Les variables (3 au plus) qui poussent le plus la probabilité de chute, en phrase.

    La latitude, la pluie normale et la culture ne sont pas citées : elles situent le
    département, elles n'expliquent pas la campagne.
    """
    decade, _, libelle = MOMENTS[moment]
    # Campagne à venir : on dit de quelle prévision de saison viennent les probabilités.
    saison = f"prévision de saison {ligne.m1_source}" if pd.notna(ligne.m1_source) else "prévision de saison"
    phrases = {
        "log_tendance": f"rendement habituel récent de {ligne.tendance_kg_ha:.0f} kg/ha",
        "variabilite_passee": f"rendements passés irréguliers à {100 * ligne.variabilite_passee:.0f} %",
        "m1_proba_seche": f"{saison} : {100 * ligne.m1_proba_seche:.0f} % de chances d'une saison sèche",
        "m1_proba_humide": f"{saison} : {100 * ligne.m1_proba_humide:.0f} % de chances d'une saison humide",
    }
    if decade is not None:
        jour = ligne[f"jour_demarrage_connu_{moment}"]
        if ligne[f"saison_demarree_{moment}"]:
            quand = pd.Timestamp(2001, 1, 1) + pd.Timedelta(days=int(jour) - 1)
            demarrage = f"saison démarrée vers le {quand.day} {MOIS[quand.month - 1]}"
        else:
            demarrage = f"saison pas encore démarrée {libelle}"
        phrases |= {
            f"cumul_vs_normale_{moment}": f"pluie depuis juin {100 * ligne[f'cumul_vs_normale_{moment}']:+.0f} % par rapport à la normale",
            f"nb_decades_seches_{moment}": f"{ligne[f'nb_decades_seches_{moment}']:.0f} décade(s) sèche(s) depuis juin",
            f"jour_demarrage_connu_{moment}": demarrage,
        }
    plus_fortes = pousse[list(phrases)].abs().sort_values(ascending=False)
    plus_fortes = plus_fortes[plus_fortes >= POUSSEE_MINIMALE].index[:3]
    if plus_fortes.empty:
        return "aucun signal marqué pour cette campagne"
    return " ; ".join(f"{phrases[n]} ({'risque en hausse' if pousse[n] > 0 else 'risque en baisse'})" for n in plus_fortes)


# ---------------------------------------------------------------------------
# Fiabilité
# ---------------------------------------------------------------------------

def mesurer(s: pd.DataFrame) -> dict:
    """Fiabilité du modèle et de la référence sur un ensemble de prévisions observées."""
    obs, tendance = s.rendement_kg_ha, s.tendance_kg_ha
    chute = (s.rapport < SEUIL_CHUTE).astype(float)
    brier = float(np.mean((s.proba_chute - chute) ** 2))
    brier_ref = float(np.mean((s.ref_proba_chute - chute) ** 2))
    mae = float(np.mean(np.abs(tendance * s.rapport_median - obs)))
    mae_tendance = float(np.mean(np.abs(tendance - obs)))
    return {
        "nb_lignes": len(s),
        "chutes_observees_pct": round(100 * chute.mean(), 1),
        "mae_modele_kg_ha": round(mae, 1),
        "mae_tendance_kg_ha": round(mae_tendance, 1),
        "mae_reference_kg_ha": round(float(np.mean(np.abs(tendance * s.ref_rapport_median - obs))), 1),
        "gain_mae_vs_tendance_pct": round(100 * (1 - mae / mae_tendance), 1),
        "rmse_modele_kg_ha": round(rmse(tendance * s.rapport_median, obs), 1),
        "rmse_tendance_kg_ha": round(rmse(tendance, obs), 1),
        "fourchette_contient_observe_pct": round(100 * np.mean(s.rapport.between(s.rapport_bas, s.rapport_haut)), 1),
        "fourchette_reference_contient_observe_pct": round(100 * np.mean(s.rapport.between(s.ref_rapport_bas, s.ref_rapport_haut)), 1),
        "largeur_fourchette_vs_reference_pct": round(100 * np.mean((s.rapport_haut - s.rapport_bas) / (s.ref_rapport_haut - s.ref_rapport_bas)), 1),
        "brier_modele": round(brier, 4),
        "brier_reference": round(brier_ref, 4),
        "brier_skill_score": round(1 - brier / brier_ref, 3),
        "auc_modele": round(roc_auc_score(chute, s.proba_chute), 3),
        # Classement à l'intérieur d'une même année (où le risque est-il le plus fort ?).
        "auc_intra_annee": round(float(np.mean([
            roc_auc_score(chute[g.index], g.proba_chute) for _, g in s.groupby("annee") if chute[g.index].nunique() == 2
        ])), 3),
    }


def evaluer(previsions: pd.DataFrame) -> pd.DataFrame:
    """Une ligne par période × moment × culture (et « TOUTES »)."""
    lignes = []
    periodes = {"validation 2001-2008": VALIDATION, "test 2009-2015": TEST}
    for periode, annees in periodes.items():
        for moment in MOMENTS:
            s = previsions[previsions.annee.isin(annees) & (previsions.moment_prevision == moment)]
            for culture in ["TOUTES", *CULTURES]:
                sc = s if culture == "TOUTES" else s[s.culture == culture]
                lignes.append({"version_modele": VERSION, "periode": periode, "moment": moment,
                               "culture": culture, **mesurer(sc)})
    e = pd.DataFrame(lignes)
    # « Fiable » = le gain sur la référence est présent en validation ET confirmé en test,
    # par moment × culture. Les réglages, eux, ne sont choisis que sur la validation.
    e["alerte_ok"] = (e.brier_skill_score > GAIN_MINIMAL) & (e.auc_modele >= AUC_MINIMALE)
    e["rendement_ok"] = e.gain_mae_vs_tendance_pct > 100 * GAIN_MINIMAL
    confirme = e.groupby(["moment", "culture"])[["alerte_ok", "rendement_ok"]].all()
    cles = pd.MultiIndex.from_frame(e[["moment", "culture"]])
    e["alerte_fiable"] = confirme.alerte_ok.reindex(cles).to_numpy()
    e["rendement_fiable"] = confirme.rendement_ok.reindex(cles).to_numpy()
    return e.drop(columns=["alerte_ok", "rendement_ok"])


# ---------------------------------------------------------------------------

def verifier_absence_de_fuite(d: pd.DataFrame):
    """Garde-fous : aucune variable d'un moment ne contient d'information postérieure."""
    interdites = ("pluie_saison", "fin_saison", "duree_saison", "anomalie_pluie_saison", "spi", "ndvi",
                  "satisfaction", "deficit", "classe_saison", "alerte", "rendement_kg_ha", "rapport")
    for moment, (decade, jour, _) in MOMENTS.items():
        v = variables(moment)
        assert not [x for x in v if any(mot in x for mot in interdites)], f"variable de fin de saison à {moment}"
        # Les variables de pluie d'un moment portent le nom de ce moment, et d'aucun autre.
        assert all(x.endswith(moment) for x in v if any(x.startswith(p) for p in PLUIE)), moment
        if decade is None:
            assert not [x for x in v if any(x.startswith(p) for p in PLUIE)], "pluie de la saison utilisée fin mai"
            continue
        # Un démarrage postérieur au moment n'est jamais visible : la variable est plafonnée au jour du moment.
        assert d[f"jour_demarrage_connu_{moment}"].max() <= jour, f"démarrage futur visible à {moment}"
    # La tendance d'une campagne ne dépend que du passé : si on change tous les rendements
    # à partir de 2005, les tendances jusqu'à 2005 comprise ne doivent pas bouger.
    r = lire_rendements(lire("DIM_GEOGRAPHIE"))
    modifie = r.assign(rendement_kg_ha=r.rendement_kg_ha * np.where(r.annee >= 2005, 10, 1))
    cles = ["code_departement", "culture", "annee"]
    avant, apres = (tendances(x).query("annee <= 2005").set_index(cles).tendance_kg_ha for x in (r, modifie))
    assert np.allclose(avant, apres), "la tendance utilise des rendements futurs"


def main():
    d = preparer()
    verifier_absence_de_fuite(d)
    observe = d[d.rendement_kg_ha.notna()]
    a_venir = sorted(d.annee[d.m1_source.notna()].unique())
    assert a_venir and min(a_venir) > PROJECTION[-1], "campagnes à venir absentes ou mal bornées"

    morceaux = []
    for moment in MOMENTS:
        v = variables(moment)
        complet = d[v].notna().all(axis=1)
        # 1. Années 2001-2015 : chaque année est prévue par un modèle entraîné sur les années d'avant.
        # 2. Années 2022-2025 : modèle entraîné sur 1991-2015, pas de rendement observé pour vérifier.
        # 3. Campagnes à venir (2026-2035) : idem, fin mai seulement, avec les probabilités de
        #    saison de prevision_saison.csv (modèle 1).
        for annee in [*VALIDATION, *TEST, *PROJECTION, *a_venir]:
            passe = observe[(observe.annee < annee) & complet[observe.index]]
            cible = d[(d.annee == annee) & complet]
            if cible.empty:
                continue
            # Une campagne à venir n'a aucune pluie observée : elle n'existe qu'à fin mai.
            assert annee not in a_venir or moment == "FIN_MAI", f"{annee} prévue à {moment} sans pluie observée"
            morceaux.append(pd.concat([
                cible.assign(moment_prevision=moment), prevoir(passe, cible, moment), reference(passe, cible),
            ], axis=1))
    p = pd.concat(morceaux)

    evaluation = evaluer(p[p.rendement_kg_ha.notna()])
    fiable = evaluation[evaluation.periode.str.startswith("validation")].set_index(["moment", "culture"])
    cles = pd.MultiIndex.from_frame(p[["moment_prevision", "culture"]])

    sortie = pd.DataFrame({
        "code_departement": p.code_departement,
        "departement": p.departement,
        "zone_agroecologique": p.zone_agroecologique,
        "culture": p.culture,
        "annee": p.annee,
        "moment_prevision": p.moment_prevision,
        "type_prevision": np.select(
            [p.annee.isin(VALIDATION), p.annee.isin(TEST)],
            ["RETROSPECTIVE_VALIDATION", "RETROSPECTIVE_TEST"], "PROJECTION_NON_EVALUEE"),
        "tendance_kg_ha": p.tendance_kg_ha.round(0),
        "rendement_bas_kg_ha": (p.tendance_kg_ha * p.rapport_bas).round(0),
        "rendement_median_kg_ha": (p.tendance_kg_ha * p.rapport_median).round(0),
        "rendement_haut_kg_ha": (p.tendance_kg_ha * p.rapport_haut).round(0),
        "proba_chute_pct": (100 * p.proba_chute).round(1),
        "proba_chute_reference_pct": (100 * p.ref_proba_chute).round(1),
        "explication": p.explication,
        "rendement_fiable": fiable.rendement_fiable.reindex(cles).to_numpy(),
        "alerte_fiable": fiable.alerte_fiable.reindex(cles).to_numpy(),
        "rendement_observe_kg_ha": p.rendement_kg_ha.round(0),
        # Vide (et non « faux ») quand le rendement n'est pas observé.
        "chute_observee": (p.rapport < SEUIL_CHUTE).where(p.rapport.notna()),
        "version_modele": VERSION,
        "date_calcul": date.today().isoformat(),
    })
    ordre = {m: k for k, m in enumerate(MOMENTS)}
    sortie = sortie.sort_values(["annee", "code_departement", "culture", "moment_prevision"],
                                key=lambda c: c.map(ordre) if c.name == "moment_prevision" else c)

    SORTIES.mkdir(exist_ok=True)
    sortie.to_csv(SORTIES / "prevision_rendement.csv", index=False)
    evaluation.to_csv(SORTIES / "evaluation_m3.csv", index=False)

    pd.set_option("display.width", 250)
    resume = ["periode", "moment", "culture", "nb_lignes", "mae_modele_kg_ha", "mae_tendance_kg_ha",
              "fourchette_contient_observe_pct", "brier_skill_score", "auc_modele", "auc_intra_annee",
              "alerte_fiable", "rendement_fiable"]
    print(evaluation[resume].to_string(index=False))
    print(f"\n{len(sortie)} lignes → {SORTIES / 'prevision_rendement.csv'}")
    print(sortie.type_prevision.value_counts().to_string())


if __name__ == "__main__":
    main()
