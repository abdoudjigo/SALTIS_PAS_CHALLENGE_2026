"""Les 6 familles de modèles comparées, avec leur petite grille de réglages.

Chaque famille sait fabriquer un modèle de régression (`reg`) et un modèle de
classification (`clf`) à partir d'un réglage de sa grille. Les grilles sont
volontairement courtes : peu d'années, donc peu de réglages à départager.
"""

from collections.abc import Callable
from dataclasses import dataclass

from sklearn.ensemble import (
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier, XGBRegressor

GRAINE = 0


@dataclass(frozen=True)
class Famille:
    nom: str
    principe: str
    grille: tuple[dict, ...]
    reg: Callable[[dict], object]
    clf: Callable[[dict], object]


def _xgb(r: dict) -> dict:
    return {"max_depth": r["profondeur"], "learning_rate": r["pas"], "n_estimators": r["arbres"], "subsample": 0.8,
                "colsample_bytree": 0.8, "min_child_weight": 10, "reg_lambda": 5.0, "random_state": GRAINE, "n_jobs": 1, "verbosity": 0}


def _hgb(r: dict) -> dict:
    return {"max_depth": r["profondeur"], "learning_rate": r["pas"], "max_iter": r["arbres"], "min_samples_leaf": 20,
                "l2_regularization": 5.0, "early_stopping": False, "random_state": GRAINE}


def _foret(r: dict) -> dict:
    return {"n_estimators": 200, "max_depth": r["profondeur"], "min_samples_leaf": r["feuille"], "max_features": 0.5,
                "random_state": GRAINE, "n_jobs": 1}


def _mlp(r: dict) -> dict:
    return {"hidden_layer_sizes": r["couches"], "alpha": r["penalite"], "max_iter": 400, "random_state": GRAINE}


_ARBRES = ({"profondeur": 2, "pas": 0.03, "arbres": 100}, {"profondeur": 2, "pas": 0.1, "arbres": 100},
           {"profondeur": 3, "pas": 0.03, "arbres": 300}, {"profondeur": 3, "pas": 0.1, "arbres": 300})

FAMILLES = (
    Famille(
        "Linéaire régularisé", "Régression ridge (pluie, rendement) et régression logistique (classes, chute)",
        ({"penalite": 1}, {"penalite": 10}, {"penalite": 100}, {"penalite": 1000}),
        lambda r: make_pipeline(StandardScaler(), Ridge(alpha=r["penalite"])),
        lambda r: make_pipeline(StandardScaler(), LogisticRegression(C=1 / r["penalite"], max_iter=2000)),
    ),
    Famille(
        "k plus proches voisins", "Moyenne des k situations passées les plus proches",
        ({"k": 10}, {"k": 25}, {"k": 50}, {"k": 100}),
        lambda r: make_pipeline(StandardScaler(), KNeighborsRegressor(n_neighbors=r["k"])),
        lambda r: make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=r["k"])),
    ),
    Famille(
        "Forêt aléatoire", "Moyenne de 200 arbres de décision construits sur des tirages différents",
        ({"profondeur": 3, "feuille": 20}, {"profondeur": 5, "feuille": 20}, {"profondeur": None, "feuille": 50}),
        lambda r: RandomForestRegressor(**_foret(r)),
        lambda r: RandomForestClassifier(**_foret(r)),
    ),
    Famille(
        "Gradient boosting (scikit-learn)", "Arbres ajoutés un à un, chacun corrigeant les erreurs des précédents (HistGradientBoosting)",
        _ARBRES,
        lambda r: HistGradientBoostingRegressor(**_hgb(r)),
        lambda r: HistGradientBoostingClassifier(**_hgb(r)),
    ),
    Famille(
        "XGBoost", "Gradient boosting régularisé, avec tirage des lignes et des colonnes",
        _ARBRES,
        lambda r: XGBRegressor(**_xgb(r)),
        lambda r: XGBClassifier(**_xgb(r)),
    ),
    Famille(
        "Réseau de neurones", "Perceptron à 1 ou 2 couches cachées, fortement pénalisé",
        ({"couches": (8,), "penalite": 1.0}, {"couches": (8,), "penalite": 0.1},
         {"couches": (16, 8), "penalite": 1.0}, {"couches": (16, 8), "penalite": 0.1}),
        lambda r: make_pipeline(StandardScaler(), MLPRegressor(**_mlp(r))),
        lambda r: make_pipeline(StandardScaler(), MLPClassifier(**_mlp(r))),
    ),
)


def libelle(reglage: dict) -> str:
    return ", ".join(f"{k}={v}" for k, v in reglage.items())
