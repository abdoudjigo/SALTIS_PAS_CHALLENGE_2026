from .cadre_prix import cadre_harmonise, prix
from .opportunites import opportunites
from .donnees import ROUTEURS as _ROUTEURS_DONNEES
from .previsions import previsions
from .systeme import systeme
from .voix import voix

ROUTEURS = [*_ROUTEURS_DONNEES, prix, opportunites, cadre_harmonise, previsions, voix]

__all__ = ["ROUTEURS", "systeme"]
