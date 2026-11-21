"""Comparaison de 6 méthodes de répartition — partie 3 : AgroDistrib.

Lancer depuis la racine du dépôt :
    venv/bin/python -m ml.comparaison.agrodistrib

AgroDistrib n'est pas un modèle de prévision : aucune répartition « vraie » n'est observée, et
aucune donnée de réponse aux engrais n'existe par territoire (ml/README.md, section 5). On ne peut
donc pas mesurer une erreur. Les 6 méthodes sont comparées à la référence « prorata du besoin »
sur des critères vérifiables : contraintes respectées, équité, ciblage des départements
vulnérables, valeur indicative, stabilité quand les scores bougent.

Cas de démonstration du README : 20 000 t de NPK 15-15-15 pour le mil (besoin ≈ 120 000 t,
41 départements). Lit MARTS.MART_TERRITOIRES_AGRODISTRIB (copie locale), écrit
ml/sorties/comparaison_agrodistrib.csv et comparaison_agrodistrib_departements.csv.
"""

from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import brentq, linprog

from ml.commun.donnees import lire

SORTIES = Path(__file__).resolve().parents[1] / "sorties"
CULTURE, BESOIN, STOCK_T = "MIL (SOUNA)", "besoin_npk_15_15_15_t", 20_000.0
POIDS_RENDEMENT = 0.5      # arbitrage rendement / équité du décideur (0 = équité seule, 1 = rendement seul)
PLANCHER, PLAFOND = 0.5, 3.0   # optimisation : taux de couverture entre 0,5 et 3 fois le taux moyen
BRUIT, TIRAGES = 0.10, 300     # stabilité : scores perturbés de ± 10 %
REFERENCE = "Prorata du besoin"


def preparer() -> pd.DataFrame:
    t = lire("MART_TERRITOIRES_AGRODISTRIB")
    t = t[(t.culture == CULTURE) & t[BESOIN].notna() & (t[BESOIN] > 0)].copy()
    assert t.potentiel_evalue.all(), "potentiel non évalué (rendement national) : ne pas classer dessus"
    t["besoin_t"] = t[BESOIN]
    t["vulnerabilite"] = t.score_vulnerabilite / 100            # relatif, 1 = le plus vulnérable
    # Valeur indicative d'une tonne : potentiel de gain de la ZONE (non additif, sert à classer)
    # × chance que la saison permette de le valoriser. Ce n'est pas une réponse mesurée à l'engrais.
    capacite = t.proba_cycle_couvert_moyen_pct / 100 * (1 - t.proba_saison_seche_pct / 100)
    t["valeur"] = t.potentiel_gain_kg_ha / t.potentiel_gain_kg_ha.max() * capacite
    return t.sort_values("code_departement").reset_index(drop=True)


def au_prorata(besoin: np.ndarray, poids: np.ndarray, stock: float) -> np.ndarray:
    """Répartit le stock en proportion de `poids`, sans jamais dépasser le besoin : ce qu'un
    département plafonné ne peut pas recevoir est redistribué aux autres."""
    if stock >= besoin.sum():
        return besoin.copy()
    servi = lambda k: np.minimum(besoin, k * poids).sum() - stock
    haut = 1.0
    while servi(haut) < 0:
        haut *= 2
    return np.minimum(besoin, brentq(servi, 0, haut) * poids)


def glouton(besoin: np.ndarray, score: np.ndarray, stock: float) -> np.ndarray:
    """Sert le besoin entier des départements dans l'ordre du score, jusqu'à épuisement."""
    x, reste = np.zeros_like(besoin), stock
    for i in np.argsort(-score):
        x[i] = min(besoin[i], reste)
        reste -= x[i]
    return x


def optimiser(besoin: np.ndarray, score: np.ndarray, stock: float) -> np.ndarray:
    """Programme linéaire : maximise Σ score × quantité, avec un plancher et un plafond de couverture."""
    taux = stock / besoin.sum()
    bornes = [(PLANCHER * taux * b, min(1.0, PLAFOND * taux) * b) for b in besoin]
    r = linprog(-score, A_eq=[np.ones_like(besoin)], b_eq=[stock], bounds=bornes, method="highs")
    assert r.success, r.message
    return r.x


def methodes(alpha: float = POIDS_RENDEMENT) -> dict:
    """Nom → fonction (besoin, vulnérabilité, valeur, stock) → quantités par département."""
    mixte = lambda v, e: alpha * e + (1 - alpha) * v
    return {
        REFERENCE: lambda b, v, e, s: au_prorata(b, b, s),
        "Parts égales plafonnées": lambda b, v, e, s: au_prorata(b, np.ones_like(b), s),
        "Prorata pondéré par la vulnérabilité": lambda b, v, e, s: au_prorata(b, b * (0.5 + v), s),
        "Prorata pondéré par la valeur indicative": lambda b, v, e, s: au_prorata(b, b * (0.5 + e), s),
        "Prorata multicritère (valeur et vulnérabilité)": lambda b, v, e, s: au_prorata(b, b * (0.5 + mixte(v, e)), s),
        "Priorité stricte (glouton)": lambda b, v, e, s: glouton(b, mixte(v, e), s),
        "Optimisation linéaire bornée": lambda b, v, e, s: optimiser(b, mixte(v, e), s),
    }


def gini(x: np.ndarray) -> float:
    x = np.sort(x)
    n = len(x)
    return float((2 * np.arange(1, n + 1) - n - 1) @ x / (n * x.sum())) if x.sum() > 0 else 0.0


def stabilite(f, b, v, e, x) -> float:
    """Part du stock qui change de département quand les scores sont perturbés de ± 10 %."""
    rng = np.random.default_rng(0)
    deplace = [np.abs(f(b, v * rng.uniform(1 - BRUIT, 1 + BRUIT, len(b)), e * rng.uniform(1 - BRUIT, 1 + BRUIT, len(b)), STOCK_T) - x).sum() / 2
               for _ in range(TIRAGES)]
    return float(np.mean(deplace) / STOCK_T)


def main():
    t = preparer()
    b, v, e = t.besoin_t.to_numpy(), t.vulnerabilite.to_numpy(), t.valeur.to_numpy()
    plus_vulnerables = v >= np.quantile(v, 0.8)
    lignes, detail = [], t[["code_departement", "departement", "region", "zone_agroecologique", "besoin_t",
                             "score_vulnerabilite", "valeur"]].rename(columns={"valeur": "valeur_indicative"}).copy()
    for nom, f in methodes().items():
        x = f(b, v, e, STOCK_T)
        couverture = x / b
        detail[nom] = x.round(1)
        lignes.append({
            "methode": nom, "type": "REFERENCE" if nom == REFERENCE else "METHODE",
            "stock_reparti_t": round(x.sum(), 1),
            "depasse_le_besoin": bool((x > b + 1e-6).any()),
            "nb_departements_servis": int((x > 1e-6).sum()),
            "couverture_min_pct": round(100 * couverture.min(), 1),
            "couverture_max_pct": round(100 * couverture.max(), 1),
            "gini_couverture": round(gini(couverture), 3),
            "part_du_stock_aux_plus_vulnerables_pct": round(100 * x[plus_vulnerables].sum() / x.sum(), 1),
            "vulnerabilite_moyenne_d_une_tonne": round(float(x @ v / x.sum()), 3),
            "valeur_indicative_d_une_tonne": round(float(x @ e / x.sum()), 3),
            "stock_deplace_si_scores_perturbes_pct": round(100 * stabilite(f, b, v, e, x), 1),
        })
    c = pd.DataFrame(lignes)
    ref = c[c.type == "REFERENCE"].iloc[0]
    c["gain_ciblage_vulnerabilite_pct"] = (100 * (c.vulnerabilite_moyenne_d_une_tonne / ref.vulnerabilite_moyenne_d_une_tonne - 1)).round(1)
    c["gain_valeur_indicative_pct"] = (100 * (c.valeur_indicative_d_une_tonne / ref.valeur_indicative_d_une_tonne - 1)).round(1)

    # Règle de choix, sans vérité observée : (1) contraintes respectées et aucun département à zéro ;
    # (2) ne fait pas moins bien que le prorata sur le ciblage ET sur la valeur indicative ;
    # (3) parmi celles-là, la plus forte somme des deux gains.
    admissible = (c.type == "METHODE") & ~c.depasse_le_besoin & (c.nb_departements_servis == len(t)) \
        & (c.gain_ciblage_vulnerabilite_pct >= 0) & (c.gain_valeur_indicative_pct >= 0)
    c["admissible"] = admissible
    total = (c.gain_ciblage_vulnerabilite_pct + c.gain_valeur_indicative_pct).where(admissible)
    c["retenu"] = (total == total.max()) & admissible
    c.insert(0, "partie", "3 - AgroDistrib")
    c.insert(1, "cas", f"{STOCK_T:.0f} t de NPK 15-15-15, {CULTURE}, {len(t)} départements, besoin {b.sum():.0f} t")

    SORTIES.mkdir(exist_ok=True)
    c.to_csv(SORTIES / "comparaison_agrodistrib.csv", index=False)
    detail.to_csv(SORTIES / "comparaison_agrodistrib_departements.csv", index=False)
    pd.set_option("display.width", 250, "display.max_columns", 40)
    print(c.drop(columns=["partie", "cas"]).T.to_string(header=False))


if __name__ == "__main__":
    main()
