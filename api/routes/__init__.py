from .avis import avis
from .cadre_prix import cadre_harmonise, prix
from .donnees import ROUTEURS as _ROUTEURS_DONNEES
from .opportunites import opportunites
from .previsions import previsions
from .systeme import systeme
from .voix import voix

ROUTEURS = [*_ROUTEURS_DONNEES, prix, opportunites, cadre_harmonise, previsions, voix, avis]

__all__ = ["ROUTEURS", "systeme"]
