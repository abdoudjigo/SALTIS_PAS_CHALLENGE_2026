"""Règle de choix du modèle, commune aux parties, fixée avant de regarder le test.

1. Chaque famille est jugée sur la validation seulement (années prévues avec le seul passé).
2. On repère la famille à l'erreur de validation la plus basse.
3. Toute famille dont l'écart avec elle n'est pas distinguable du hasard (intervalle à 90 %
   de la différence, en retirant des années entières, qui contient 0) est dite « équivalente ».
4. Parmi les équivalentes, on retient la plus simple (ordre de `ml.comparaison.modeles.FAMILLES`).
Le test ne sert qu'à confirmer, et à dire si le modèle retenu bat la référence.
"""

import numpy as np
import pandas as pd

TIRAGES = 2000


def _tirages_annees(annees: np.ndarray, *erreurs: np.ndarray) -> list[np.ndarray]:
    """Somme des erreurs sur des rééchantillons d'années entières : les départements d'une
    même année se ressemblent, seule l'année est une vraie répétition."""
    par_annee = pd.DataFrame({k: e for k, e in enumerate(erreurs)}).groupby(np.asarray(annees)).sum()
    tires = np.random.default_rng(0).integers(0, len(par_annee), (TIRAGES, len(par_annee)))
    return [par_annee[k].to_numpy()[tires].sum(1) for k in range(len(erreurs))]


def gain(erreur_modele, erreur_reference, annees) -> tuple[float, float, float]:
    """Gain 1 − erreur modèle / erreur référence (0 = pas mieux, > 0 = mieux), avec son intervalle à 90 %."""
    em, er = np.asarray(erreur_modele, float), np.asarray(erreur_reference, float)
    m, r = _tirages_annees(annees, em, er)
    bas, haut = np.quantile(1 - m / r, [0.05, 0.95])
    return round(1 - em.sum() / er.sum(), 3), round(float(bas), 3), round(float(haut), 3)


def choisir(erreurs: dict[str, np.ndarray], annees, ordre_simplicite: list[str]) -> pd.DataFrame:
    """Applique la règle. `erreurs` : erreur de validation ligne à ligne, par famille."""
    moyennes = {nom: float(np.mean(e)) for nom, e in erreurs.items()}
    meilleur = min(moyennes, key=moyennes.get)
    lignes = []
    for nom in ordre_simplicite:
        if nom == meilleur:
            equivalent, bas, haut = True, 0.0, 0.0
        else:
            m, b = _tirages_annees(annees, np.asarray(erreurs[nom], float), np.asarray(erreurs[meilleur], float))
            bas, haut = np.quantile(m / b - 1, [0.05, 0.95])
            equivalent = bool(bas <= 0)
        lignes.append({"modele": nom, "meilleur_en_validation": nom == meilleur, "equivalent_au_meilleur": equivalent,
                       "surcout_vs_meilleur_bas": round(float(bas), 3), "surcout_vs_meilleur_haut": round(float(haut), 3)})
    t = pd.DataFrame(lignes)
    t["retenu"] = t.modele == t.modele[t.equivalent_au_meilleur].iloc[0]
    return t
