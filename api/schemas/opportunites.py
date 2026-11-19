"""Module E : carte des opportunités (pluie et eau)."""

from typing import Literal

from pydantic import Field

from .commun import Territoire

# Valeurs contrôlées : une valeur inattendue fait échouer le préchargement (l'ancienne version reste servie).
Couleur = Literal["bleu", "jaune", "vert"]
ClasseSaisonPluie = Literal["courte", "longue", "non évaluée"]
CategorieEau = Literal[
    "eau de surface peu exploitée", "nappe accessible", "eau de surface déjà exploitée", "pas d'eau mobilisable identifiée",
    "non évaluée",
]


class CarteOpportunite(Territoire):
    """MART_CARTE_OPPORTUNITES : un département. Une carte, trois couleurs, deux publics (agriculteur, investisseur)."""

    zone_secondaire: str | None = Field(None, description="Département de transition entre deux zones ; information seulement")
    latitude: float | None = Field(None, description="Point représentatif du département (degrés décimaux, WGS 84)", examples=[12.89])
    longitude: float | None = Field(None, description="Point représentatif du département (degrés décimaux, WGS 84)", examples=[-14.94])

    # Couleurs
    couleur_carte: Couleur | None = Field(
        description="Couleur à afficher : `bleu` (eau mobilisable, prioritaire), sinon `couleur_fond`. NULL si la saison n'est pas évaluée"
    )
    couleur_fond: Literal["jaune", "vert"] | None = Field(description="`jaune` saison courte, `vert` saison longue")
    couche_eau: bool = Field(description="Vrai : afficher la couche bleue (contre-saison possible) par-dessus le fond")

    # Pluie : quel cycle semer
    classe_saison_pluie: ClasseSaisonPluie = Field(description="Durée de la saison des pluies, vue par les cycles qui passent")
    cycle_max_conseille_j: float | None = Field(
        description="Plus long cycle (culture ou variété) qui passe au moins 4 années sur 5 (jours) ; NULL si aucun", examples=[120]
    )
    cultures_cycle_long: str | None = Field(description="Cultures dont le cycle long passe 4 années sur 5", examples=["ARACHIDE, MAÏS"])
    varietes_conseillees: str | None = Field(description="Variétés documentées qui passent 4 années sur 5, avec leur cycle")
    nb_varietes_conseillees: int = Field(description="Nombre de variétés conseillées")
    pluie_saison_normale_mm: float | None = Field(description="Normale 1991-2020 (mm)")
    duree_saison_moyenne_j: float | None = Field(description="Durée moyenne de la saison (jours)")
    duree_saison_courte_j: float | None = Field(description="Durée atteinte 4 années sur 5 (jours)")

    # Eau : contre-saison et investissement
    categorie_eau: CategorieEau = Field(description="`non évaluée` tant que les sources eau ne sont pas chargées")
    potentiel_contre_saison_ha: float | None = Field(
        description="Terres cultivables à moins de 2 km d'une eau permanente, nues en saison sèche (ha). "
        "Rempli seulement pour `eau de surface peu exploitée`. Surface brute : foncier, sel et accès non vérifiés"
    )
    rang_opportunite_eau: int | None = Field(description="1 = plus grande opportunité, couche bleue seulement")
    surface_eau_permanente_ha: float | None = Field(description="Eau présente au moins 10 mois sur 12 (ha)")
    surface_proche_eau_cultivable_ha: float | None = Field(description="Terres cultivables à moins de 2 km de cette eau (ha)")
    surface_proche_eau_inexploitee_ha: float | None = Field(description="Dont nues en saison sèche (ha)")
    part_proche_eau_exploitee_pct: float | None = Field(description="Part des terres proches déjà vertes en saison sèche (%)")
    profondeur_classe_dominante: str | None = Field(description="Profondeur de la nappe la plus étendue (BGS)", examples=["7-25 m"])
    productivite_classe_dominante: str | None = Field(description="Débit attendu d'un forage (BGS)", examples=["1-5 L/s"])
    part_nappe_accessible_pct: float | None = Field(description="Part du territoire avec nappe à 25 m au plus et au moins 1 L/s (%)")
    surface_equipee_irrigation_ha: float | None = Field(description="Surface équipée pour l'irrigation vers 2005 (FAO, ha)")

    # Messages
    conseil_agriculteur: str = Field(description="Conseil prêt à afficher ou à lire (assistant vocal)")
    conseil_investisseur: str | None = Field(description="Opportunité d'aménagement ou de forage ; NULL sans eau mobilisable")
