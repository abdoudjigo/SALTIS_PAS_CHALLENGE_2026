from .avis import avis
from .cadre_prix import cadre_harmonise, prix
from .donnees import ROUTEURS as _ROUTEURS_DONNEES
from .explications import explications
from .observatoire import observatoire
from .opportunites import opportunites
from .previsions import previsions
from .systeme import systeme
from .voix import voix

ROUTEURS = [*_ROUTEURS_DONNEES, prix, opportunites, cadre_harmonise, previsions, observatoire, voix, avis, explications]

__all__ = ["ROUTEURS", "systeme"]
