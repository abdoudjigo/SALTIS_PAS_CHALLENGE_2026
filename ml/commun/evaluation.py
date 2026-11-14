"""Mesures de fiabilité communes aux modèles."""

import numpy as np

CLASSES_3 = ["sèche", "normale", "humide"]  # ordre croissant de pluie


def rps(probas: np.ndarray, observe: np.ndarray) -> float:
    """Ranked Probability Score moyen (0 = parfait), classes ordonnées.

    `probas` : tableau n × K ; `observe` : indices de classe (0..K-1).
    Une erreur d'une classe coûte moins qu'une erreur de deux classes.
    """
    k = probas.shape[1]
    vraies = np.eye(k)[observe]
    ecarts = np.cumsum(probas, axis=1) - np.cumsum(vraies, axis=1)
    return float(np.mean(np.sum(ecarts**2, axis=1) / (k - 1)))


def rpss(probas: np.ndarray, observe: np.ndarray, reference: np.ndarray) -> float:
    """Gain par rapport à une prévision de référence (0 = pas mieux, 1 = parfait, < 0 = moins bien)."""
    return 1 - rps(probas, observe) / rps(reference, observe)


def rmse(prevu, observe) -> float:
    prevu, observe = np.asarray(prevu, float), np.asarray(observe, float)
    return float(np.sqrt(np.mean((prevu - observe) ** 2)))
