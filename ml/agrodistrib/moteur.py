"""Moteur AgroDistrib : proposition de répartition du stock d'intrants d'une organisation.

Méthode validée le 18/11/2026 (docs/rapport-comparaison-modeles.md, section 5) : **prorata
multicritère**. Chaque couple département × culture reçoit une part du stock proportionnelle à

    besoin × (0,5 + α × valeur indicative + (1 − α) × vulnérabilité)

sans jamais dépasser son besoin (ce qu'un couple plafonné ne peut pas recevoir est redistribué
aux autres). α est l'arbitrage rendement / équité du décideur : 0 = équité seule, 1 = rendement seul.

- Vulnérabilité = `score_vulnerabilite` / 100 (relatif, 1 = le plus vulnérable).
- Valeur indicative d'une tonne = potentiel de gain de la zone (ramené entre 0 et 1, par culture)
  × probabilité que le cycle soit couvert × (1 − probabilité climatologique de saison sèche).
  C'est un indicateur de priorité, pas un gain de rendement mesuré.
- Critère vide (vulnérabilité de Dakar, valeur du manioc…) : remplacé par la médiane des autres
  lignes de la répartition, et signalé (`critere_impute`). Jamais par 0.
- La répartition est calculée par département ; zones et régions sont des sommes de départements.

Ce module ne lit ni n'écrit rien : il reçoit `MART_TERRITOIRES_AGRODISTRIB` et rend des tables.
"""

from dataclasses import dataclass, field
from datetime import date

import numpy as np
import pandas as pd
from scipy.optimize import brentq

VERSION = "agrodistrib-v1"
METHODE = "Prorata multicritère"
ALPHA_DEFAUT = 0.5
PLANCHER_POIDS = 0.5   # part du poids indépendante des critères : tout couple avec un besoin est servi

# Intrants que l'on peut répartir (produits). Éléments (N, P2O5, K2O) et eau : exclus.
INTRANTS = {
    #  code           colonne de besoin du mart        statut de la dose            unité de dose  t par unité × ha
    "NPK_15_15_15": ("besoin_npk_15_15_15_t",      "statut_validation_engrais", "kg/ha", 0.001),
    "UREE":         ("besoin_uree_t",              "statut_validation_engrais", "kg/ha", 0.001),
    "DAP_18_46_0":  ("besoin_dap_t",               "statut_validation_engrais", "kg/ha", 0.001),
    "FUMIER":       ("besoin_fumier_t",            "statut_validation_engrais", "t/ha",  1.0),
    "SEMENCES":     ("besoin_semences_retenu_t",   "statut_validation_semis",   "kg/ha", 0.001),
}
NIVEAUX = {
    "DEPARTEMENT": ("code_departement", "departement"),
    "ZONE": ("zone_agroecologique", "zone_agroecologique"),
    "REGION": ("code_region", "region"),
}
STATUT_SAISIE = "SAISIE_DECIDEUR"
SCENARIOS_ALPHA = {"Équité": 0.0, "Équilibré": 0.5, "Rendement": 1.0}


@dataclass
class Propositions:
    """Résultat d'une demande de répartition : plusieurs scénarios à comparer."""
    parametres: dict
    scenarios: pd.DataFrame      # une ligne par scénario : indicateurs, comparés au prorata du besoin
    territoires: pd.DataFrame    # scénario × territoire du niveau choisi
    departements: pd.DataFrame   # scénario × département × culture : le détail pour l'explication
    doses_a_saisir: pd.DataFrame = field(default_factory=pd.DataFrame)  # couples sans dose, non servis


# --- 1. Préparer les lignes ---------------------------------------------------------------------

def preparer(territoires: pd.DataFrame, code_intrant: str, cultures: list[str],
             doses_saisies: dict[str, float] | None = None) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Rend (lignes à servir, couples sans dose).

    `doses_saisies` : culture → dose saisie par le décideur (unité de l'intrant). Elle ne s'applique
    qu'aux couples sans besoin calculé : elle ne remplace jamais une dose existante.
    """
    if code_intrant not in INTRANTS:
        raise ValueError(f"intrant non réparti : {code_intrant!r} (possibles : {', '.join(INTRANTS)})")
    colonne, colonne_statut, _, facteur = INTRANTS[code_intrant]
    cultures = [c.upper().strip() for c in cultures]
    if not cultures:
        raise ValueError("au moins une culture est nécessaire")
    inconnues = sorted(set(cultures) - set(territoires.culture.str.upper()))
    if inconnues:
        raise ValueError(f"culture(s) absente(s) de MART_TERRITOIRES_AGRODISTRIB : {', '.join(inconnues)}")
    doses = {c.upper().strip(): float(d) for c, d in (doses_saisies or {}).items()}
    for c, d in doses.items():
        if c not in cultures:
            raise ValueError(f"dose saisie pour une culture non demandée : {c!r}")
        if not np.isfinite(d) or d < 0:
            raise ValueError(f"dose saisie invalide pour {c!r} : {d}")

    t = territoires[territoires.culture.str.upper().isin(cultures)].copy()
    t["besoin_t"] = t[colonne].astype(float)
    t["source_besoin"] = np.where(t.besoin_t.notna(), "MART", None)
    t["statut_dose"] = t[colonne_statut]
    t["dose_saisie"] = np.nan
    for c, d in doses.items():
        a_completer = (t.culture.str.upper() == c) & t.besoin_t.isna()
        t.loc[a_completer, "besoin_t"] = t.loc[a_completer, "superficie_reference_ha"] * d * facteur
        t.loc[a_completer, "source_besoin"] = STATUT_SAISIE
        t.loc[a_completer, "statut_dose"] = STATUT_SAISIE
        t.loc[a_completer, "dose_saisie"] = d

    a_saisir = (t[t.besoin_t.isna()][["code_departement", "departement", "zone_agroecologique", "culture",
                                       "superficie_reference_ha", "statut_dose"]]
                .sort_values(["culture", "code_departement"]).reset_index(drop=True))
    t = t[t.besoin_t.notna() & (t.besoin_t > 0)].copy()
    if t.empty:
        raise ValueError("aucun besoin à servir : saisir une dose pour ces cultures")

    # Critères (vides laissés vides à ce stade).
    t["vulnerabilite"] = t.score_vulnerabilite / 100
    potentiel = t.potentiel_gain_kg_ha.where(t.potentiel_evalue.astype(bool)).clip(lower=0)
    maximum = potentiel.groupby(t.culture).transform("max")   # kg/ha : comparables dans une même culture
    potentiel_norm = (potentiel / maximum).where(maximum > 0, 0.0).where(potentiel.notna())
    capacite = t.proba_cycle_couvert_moyen_pct / 100 * (1 - t.proba_saison_seche_pct / 100)
    t["valeur_indicative"] = potentiel_norm * capacite

    # Règle (a) : critère vide → médiane des autres lignes, signalée.
    imputes = []
    for critere, libelle in (("vulnerabilite", "vulnérabilité"), ("valeur_indicative", "valeur indicative")):
        vide = t[critere].isna()
        if vide.all():
            raise ValueError(f"{libelle} vide sur toutes les lignes : répartition impossible sur ce critère")
        t[critere] = t[critere].fillna(t[critere].median())
        imputes.append(np.where(vide, libelle, ""))
    t["critere_impute"] = [" et ".join(x for x in paire if x) or None for paire in zip(*imputes)]
    return t.sort_values(["code_departement", "culture"]).reset_index(drop=True), a_saisir


# --- 2. Répartir --------------------------------------------------------------------------------

def au_prorata(besoin: np.ndarray, poids: np.ndarray, stock: float) -> np.ndarray:
    """Répartit `stock` en proportion de `poids`, sans jamais dépasser le besoin."""
    if stock >= besoin.sum():
        return besoin.copy()
    servi = lambda k: np.minimum(besoin, k * poids).sum() - stock
    haut = 1.0
    while servi(haut) < 0:
        haut *= 2
    return np.minimum(besoin, brentq(servi, 0, haut, xtol=1e-12) * poids)


def poids(lignes: pd.DataFrame, alpha: float) -> np.ndarray:
    critere = alpha * lignes.valeur_indicative + (1 - alpha) * lignes.vulnerabilite
    return (lignes.besoin_t * (PLANCHER_POIDS + critere)).to_numpy()


def repartir(lignes: pd.DataFrame, stock_t: float, alpha: float) -> np.ndarray:
    return au_prorata(lignes.besoin_t.to_numpy(), poids(lignes, alpha), stock_t)


# --- 3. Indicateurs et agrégation ---------------------------------------------------------------

def gini(x: np.ndarray) -> float:
    x = np.sort(x)
    n = len(x)
    return float((2 * np.arange(1, n + 1) - n - 1) @ x / (n * x.sum())) if x.sum() > 0 else 0.0


def indicateurs(lignes: pd.DataFrame, x: np.ndarray, x_prorata: np.ndarray, stock_t: float) -> dict:
    b, v, e = lignes.besoin_t.to_numpy(), lignes.vulnerabilite.to_numpy(), lignes.valeur_indicative.to_numpy()
    couverture = x / b
    moyenne = lambda q, c: float(q @ c / q.sum())
    v_ref, e_ref = moyenne(x_prorata, v), moyenne(x_prorata, e)
    return {
        "stock_t": stock_t,
        "stock_reparti_t": round(float(x.sum()), 3),
        "stock_non_reparti_t": round(float(stock_t - x.sum()), 3) + 0.0,   # + 0.0 : pas de « -0.0 »
        "besoin_total_t": round(float(b.sum()), 3),
        "couverture_globale_pct": round(100 * float(x.sum() / b.sum()), 1),
        "nb_departements_servis": int(lignes.code_departement[x > 1e-9].nunique()),
        "couverture_min_pct": round(100 * float(couverture.min()), 1),
        "couverture_max_pct": round(100 * float(couverture.max()), 1),
        "gini_couverture": round(gini(couverture), 3),
        "vulnerabilite_moyenne_d_une_tonne": round(moyenne(x, v), 3),
        "valeur_indicative_d_une_tonne": round(moyenne(x, e), 3),
        "gain_ciblage_vulnerabilite_pct": round(100 * (moyenne(x, v) / v_ref - 1), 1) if v_ref > 0 else None,
        "gain_valeur_indicative_pct": round(100 * (moyenne(x, e) / e_ref - 1), 1) if e_ref > 0 else None,
    }


def agreger(detail: pd.DataFrame, niveau: str) -> pd.DataFrame:
    """Somme par territoire du niveau choisi (besoins et quantités sont additifs)."""
    code, nom = NIVEAUX[niveau]
    g = detail.groupby(["scenario", code], sort=True)
    a = g.agg(territoire=(nom, "first"), besoin_t=("besoin_t", "sum"),
              quantite_proposee_t=("quantite_proposee_t", "sum"),
              nb_departements=("code_departement", "nunique"),
              statuts_dose=("statut_dose", lambda s: ", ".join(sorted(set(s.dropna())))),
              nb_lignes_dose_saisie=("source_besoin", lambda s: int((s == STATUT_SAISIE).sum())),
              nb_lignes_critere_impute=("critere_impute", lambda s: int(s.notna().sum()))).reset_index()
    a = a.rename(columns={code: "code_territoire"})
    a.insert(1, "niveau_destination", niveau)
    a["couverture_pct"] = (100 * a.quantite_proposee_t / a.besoin_t).round(1)
    return a


# --- 4. Point d'entrée --------------------------------------------------------------------------

def proposer_scenarios(territoires: pd.DataFrame, code_intrant: str, cultures: list[str], stock_t: float,
                       niveau: str = "DEPARTEMENT", alpha: float = ALPHA_DEFAUT,
                       doses_saisies: dict[str, float] | None = None, campagne: int | None = None) -> Propositions:
    """Propose les scénarios Équité (α = 0), Équilibré (0,5) et Rendement (1), plus α du décideur
    s'il diffère. Le décideur compare, ajuste et valide dans l'application : la quantité validée
    n'est pas produite ici."""
    if niveau not in NIVEAUX:
        raise ValueError(f"niveau inconnu : {niveau!r} (possibles : {', '.join(NIVEAUX)})")
    if not np.isfinite(stock_t) or stock_t <= 0:
        raise ValueError(f"stock invalide : {stock_t}")
    if not 0 <= alpha <= 1:
        raise ValueError(f"α doit être entre 0 et 1 : {alpha}")

    lignes, a_saisir = preparer(territoires, code_intrant, cultures, doses_saisies)
    alphas = dict(SCENARIOS_ALPHA)
    if alpha not in alphas.values():
        alphas["Personnalisé"] = alpha
    x_prorata = au_prorata(lignes.besoin_t.to_numpy(), lignes.besoin_t.to_numpy(), stock_t)

    resumes, details = [], []
    for nom, a in alphas.items():
        x = repartir(lignes, stock_t, a)
        resumes.append({"scenario": nom, "alpha": a, "choisi_par_le_decideur": a == alpha,
                        **indicateurs(lignes, x, x_prorata, stock_t)})
        d = lignes.assign(scenario=nom, alpha=a, quantite_proposee_t=x, couverture_pct=(100 * x / lignes.besoin_t).round(1))
        details.append(d)

    colonnes = ["scenario", "alpha", "code_departement", "departement", "code_region", "region",
                "zone_agroecologique", "culture", "superficie_reference_ha", "besoin_t", "source_besoin",
                "dose_saisie", "statut_dose", "score_vulnerabilite", "vulnerabilite", "potentiel_gain_kg_ha",
                "niveau_source_potentiel", "proba_cycle_couvert_moyen_pct", "proba_saison_seche_pct",
                "valeur_indicative", "critere_impute", "quantite_proposee_t", "couverture_pct"]
    detail = pd.concat(details, ignore_index=True)[colonnes]
    parametres = {
        "methode": METHODE, "version_algorithme": VERSION, "code_intrant": code_intrant,
        "unite_dose": INTRANTS[code_intrant][2], "cultures": [c.upper().strip() for c in cultures],
        "stock_t": stock_t, "niveau_destination": niveau, "alpha_decideur": alpha, "campagne": campagne,
        "doses_saisies": {c.upper().strip(): d for c, d in (doses_saisies or {}).items()},
        "probabilite_saison_seche": "climatologie (MART_TERRITOIRES_AGRODISTRIB.proba_saison_seche_pct)",
        "critere_vide": "médiane des autres lignes, signalée dans critere_impute",
        "date_calcul": date.today().isoformat(),
    }
    return Propositions(parametres=parametres, scenarios=pd.DataFrame(resumes),
                        territoires=agreger(detail, niveau), departements=detail, doses_a_saisir=a_saisir)
