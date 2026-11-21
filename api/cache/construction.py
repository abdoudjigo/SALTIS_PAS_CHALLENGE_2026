"""Validation des marts et construction de toutes les réponses de l'API, prêtes à servir.

Chaque réponse possible est sérialisée une seule fois ici (JSON final, compressé en gzip au-delà de 1 Ko).
Une requête HTTP ne fait ensuite qu'un GET dans le cache : ni SQL, ni sérialisation.
"""

import gzip
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from functools import lru_cache
from typing import Any, Callable, Iterable, Sequence

from pydantic import BaseModel, TypeAdapter, ValidationError

from ..marts import MARTS
from ..schemas import (
    Agregat,
    Besoin,
    CadreHarmonise,
    CarteAgroclimat,
    CarteOpportunite,
    ChoixCulture,
    CultureRef,
    DepartementRef,
    EvaluationModele,
    IntrantRef,
    Meta,
    Periodes,
    PhaseCadreHarmonise,
    PrevisionRendement,
    PrevisionSaison,
    PrixIntrant,
    RegionRef,
    RisqueSemis,
    SuiviDecadaire,
    TerritoireAgrodistrib,
    Vulnerabilite,
    ZoneRef,
)
from ..schemas.cadre_harmonise import LIBELLES_PHASES
from . import cles
from .cles import SUFFIXE_GZIP, normaliser

SEUIL_GZIP_OCTETS = 1024

# --- Limites d'usage renvoyées dans meta.avertissements (reprises de docs/contrat-donnees.md) ---
AV_CARTE = [
    "classe_saison est relative à chaque département.",
    "NDVI disponible à partir de 2000 seulement.",
    "Vulnérabilité relative et indicative ; NULL pour Dakar, Guédiawaye et Pikine.",
]
AV_SUIVI = [
    "Ne pas sommer les décades pour obtenir le total de saison : utiliser /agroclimat.",
    "Quantiles et probabilités ne s'additionnent pas.",
]
AV_EAU_CALCULEE = (
    "Cycles court et long : probabilité eau = cycle moyen de la source + écart décadaire FAO (voir methode_niveau) ; "
    "valeurs de la source dans les colonnes _source."
)
AV_EAU_SOURCE = "Le score des cycles court et long utilise la part eau du cycle moyen (marts antérieurs au calcul décadaire)."
AV_CULTURES = [
    "Comparer les options sur proba_cycle_couvert_pct, pas sur le score.",
    "Mil « déconseillé » dans le nord alors qu'il y est cultivé : calibration en cours avec les techniciens.",
]
AV_BESOINS = [
    "Besoins de référence historiques, pas prévisionnels.",
    "NULL = dose à saisir ou non applicable, jamais 0.",
    "Ne pas additionner produits et éléments fertilisants : ils décrivent la même fertilisation.",
    "Totaliser les semences sur besoin_semences_retenu_t.",
    "Fumier non chiffré (besoin_fumier_t NULL) : hors totaux, budget et répartition.",
    "Dose retenue : recherche propre à la zone, puis catalogue PIA national (voir source_reference_*).",
    "Aucune dose n'est encore validée par un spécialiste.",
]
AV_AGREGATS = [
    "Somme des seules colonnes additives ; total partiel quand valeurs_manquantes > 0.",
    "Ne pas additionner produits et éléments fertilisants : ils décrivent la même fertilisation.",
    "Besoins de référence historiques, pas prévisionnels.",
    "Fumier non chiffré : hors totaux.",
]
AV_AGRODISTRIB = [
    "Seuls superficie et besoins s'additionnent.",
    "Potentiel de gain : valeur de zone, non additive, identique pour les départements d'une même zone.",
    "Gain de rendement indicatif : aucune donnée de réponse aux engrais par territoire.",
]
AV_OPPORTUNITES = [
    "Indicateur de repérage, pas une étude de faisabilité : foncier, salinité, qualité de l'eau et accès à vérifier sur place.",
    "Saison courte / longue : même calcul que /choix-cultures (cycle qui passe au moins 4 années sur 5).",
    "Irrigation équipée : FAO GMIA, vers 2005. Nappes : BGS, échelle continentale (grille 5 km).",
]
AV_OPPORTUNITES_SANS_EAU = "Couche bleue non évaluée : les sources eau ne sont pas encore chargées (categorie_eau = « non évaluée »)."
COULEURS = ("bleu", "jaune", "vert")

AV_VULNERABILITE = [
    "Score relatif et indicatif (méthode v1), à valider avec les techniciens.",
    "NULL pour Dakar (confiance faible), Guédiawaye et Pikine (aucun rendement).",
]

COLONNES_ADDITIVES = [
    "superficie_reference_ha",
    "besoin_azote_n_t",
    "besoin_phosphate_p2o5_t",
    "besoin_potasse_k2o_t",
    "besoin_npk_15_15_15_t",
    "besoin_npk_15_10_10_t",
    "besoin_npk_6_20_10_t",
    "besoin_uree_t",
    "besoin_dap_t",
    "besoin_semences_retenu_t",
]  # fumier : non chiffré (besoin_fumier_t toujours NULL), hors totaux, budget et répartition
NIVEAUX = ("NATIONAL", "REGION", "ZONE")


class ErreurContrat(Exception):
    """Un mart ne respecte plus le contrat : le préchargement est annulé, la version en place reste servie."""


class Index(BaseModel):
    """Valeurs valides d'une version : sert à répondre 404 avec un message précis."""

    departements: dict[str, str]
    departements_suivi: list[str]
    regions: dict[str, str]
    zones: list[str]
    cultures: list[str]
    campagnes: list[int]
    annees_suivi: list[int]
    # Modèles d'IA (vides tant que SALTIS.ML n'est pas chargé ; valeurs par défaut pour relire un ancien index)
    annees_prev_saison: list[int] = []
    annees_prev_rendement: list[int] = []
    cultures_prev_rendement: list[str] = []
    annees_semis: list[int] = []
    cultures_semis: list[str] = []
    a_evaluation: bool = False
    a_opportunites: bool = False
    campagnes_prix: list[int] = []
    a_cadre_harmonise: bool = False

    def resoudre_culture(self, texte: str) -> str | None:
        cible = normaliser(texte)
        return next((c for c in self.cultures if normaliser(c) == cible), None)


@dataclass
class Construction:
    reponses: dict[str, bytes] = field(default_factory=dict)
    nb_cles: int = 0
    taille_octets: int = 0
    taille_stockee_octets: int = 0
    index: Index | None = None


@lru_cache(maxsize=None)
def _adaptateur_liste(modele: type[BaseModel]) -> TypeAdapter:
    return TypeAdapter(list[modele])


# ---------------------------------------------------------------- validation


def valider(bruts: dict[str, list[dict[str, Any]]]) -> tuple[dict[str, list[Any]], dict[str, list[str]]]:
    """Valide chaque mart avec son schéma. Rend les lignes typées et les colonnes hors contrat."""
    valides: dict[str, list[Any]] = {}
    ignorees: dict[str, list[str]] = {}
    for cle, definition in MARTS.items():
        if not definition.obligatoire and not bruts.get(cle):
            continue  # résultat de modèle pas encore chargé : ses routes répondent 404 prevision_indisponible
        if cle not in bruts:
            raise ErreurContrat(f"{definition.table} : mart absent de la lecture")
        lignes = bruts[cle]
        if not lignes:
            raise ErreurContrat(f"{definition.table} : aucune ligne")
        en_trop = sorted(set(lignes[0]) - set(definition.modele.model_fields))
        if en_trop:
            ignorees[cle] = en_trop
        try:
            valides[cle] = _adaptateur_liste(definition.modele).validate_python(lignes)
        except ValidationError as exc:
            erreurs = exc.errors()
            apercu = "; ".join(f"{'.'.join(map(str, e['loc']))} : {e['msg']}" for e in erreurs[:5])
            raise ErreurContrat(f"{definition.table} : {len(erreurs)} erreur(s) de contrat — {apercu}") from None
    return valides, ignorees


# ---------------------------------------------------------------- agrégats additifs


def agreger(
    lignes: Sequence[Any],
    niveau: str,
    culture: str | None,
    avec_irrigation: bool,
    semences_non_applicables: set[tuple[str, str]],
) -> list[Agregat]:
    def cle_groupe(ligne) -> tuple[str, str]:
        if niveau == "NATIONAL":
            return ("SEN", "Sénégal")
        if niveau == "REGION":
            return (ligne.code_region, ligne.region)
        return (ligne.zone_agroecologique, ligne.zone_agroecologique)

    def applicable(ligne, colonne: str) -> bool:
        if colonne == "besoin_semences_retenu_t":
            return (ligne.code_departement, ligne.culture) not in semences_non_applicables
        if colonne == "irrigation_totale_m3":
            return bool(ligne.irrigation_requise)
        return True

    groupes: dict[tuple[str, str], list[Any]] = defaultdict(list)
    for ligne in lignes:
        groupes[cle_groupe(ligne)].append(ligne)

    colonnes = COLONNES_ADDITIVES + (["irrigation_totale_m3"] if avec_irrigation else [])
    resultat = []
    for (code, libelle), membres in sorted(groupes.items(), key=lambda kv: kv[0][1]):
        valeurs: dict[str, float | None] = {}
        manquantes: dict[str, int] = {}
        for colonne in colonnes:
            concernees = [getattr(m, colonne) for m in membres if applicable(m, colonne)]
            connues = [v for v in concernees if v is not None]
            valeurs[colonne] = round(sum(connues), 2) if connues else None
            if len(concernees) > len(connues):
                manquantes[colonne] = len(concernees) - len(connues)
        resultat.append(
            Agregat(
                niveau=niveau,
                code=code,
                libelle=libelle,
                culture=culture,
                nb_departements=len({m.code_departement for m in membres}),
                nb_lignes=len(membres),
                valeurs_manquantes=manquantes,
                **valeurs,
            )
        )
    return resultat


# ---------------------------------------------------------------- construction


class _Constructeur:
    def __init__(self, version: str, genere_le: datetime, prefixe_source: str):
        self.version = version
        self.genere_le = genere_le
        self.prefixe_source = prefixe_source
        self.c = Construction()

    def ajouter(
        self,
        cle: str,
        donnees: BaseModel | Sequence[BaseModel],
        modele: type[BaseModel],
        source: str,
        filtres: dict[str, Any] | None = None,
        avertissements: Iterable[str] = (),
    ) -> None:
        unique = isinstance(donnees, BaseModel)
        meta = Meta(
            version=self.version,
            genere_le=self.genere_le,
            source=f"{self.prefixe_source}.{source}" if source.startswith("MART_") else source,
            nb_elements=1 if unique else len(donnees),
            filtres=filtres or {},
            avertissements=list(avertissements),
        )
        corps = donnees.model_dump_json().encode() if unique else _adaptateur_liste(modele).dump_json(list(donnees))
        contenu = b'{"meta":' + meta.model_dump_json().encode() + b',"donnees":' + corps + b"}"
        self.c.nb_cles += 1
        self.c.taille_octets += len(contenu)
        # Au-delà du seuil, seule la variante gzip est stockée (6 fois plus petite) ;
        # elle est servie telle quelle aux clients qui acceptent gzip, décompressée pour les autres.
        if len(contenu) > SEUIL_GZIP_OCTETS:
            contenu_stocke = gzip.compress(contenu, compresslevel=6, mtime=0)
            self.c.reponses[cle + SUFFIXE_GZIP] = contenu_stocke
        else:
            contenu_stocke = contenu
            self.c.reponses[cle] = contenu
        self.c.taille_stockee_octets += len(contenu_stocke)


def _grouper(lignes: Iterable[Any], cle: Callable[[Any], Any]) -> dict[Any, list[Any]]:
    groupes: dict[Any, list[Any]] = defaultdict(list)
    for ligne in lignes:
        groupes[cle(ligne)].append(ligne)
    return groupes


def construire(
    marts: dict[str, list[Any]], version: str, genere_le: datetime, prefixe_source: str, prefixe_ml: str | None = None
) -> Construction:
    carte: list[CarteAgroclimat] = marts["carte"]
    suivi: list[SuiviDecadaire] = marts["suivi"]
    choix: list[ChoixCulture] = marts["cultures"]
    besoins: list[Besoin] = marts["besoins"]
    agro: list[TerritoireAgrodistrib] = marts["agrodistrib"]
    vuln: list[Vulnerabilite] = marts["vulnerabilite"]
    opportunites: list[CarteOpportunite] = marts.get("opportunites", [])
    prix: list[PrixIntrant] = marts.get("prix", [])
    cadre: list[CadreHarmonise] = marts.get("cadre_harmonise", [])
    prev_saison: list[PrevisionSaison] = marts.get("prev_saison", [])
    prev_rendement: list[PrevisionRendement] = marts.get("prev_rendement", [])
    semis: list[RisqueSemis] = marts.get("semis", [])
    evaluation: list[EvaluationModele] = marts.get("evaluation", [])

    b = _Constructeur(version, genere_le, prefixe_source)
    t_carte, t_suivi, t_choix = MARTS["carte"].table, MARTS["suivi"].table, MARTS["cultures"].table
    t_besoins, t_agro, t_vuln = MARTS["besoins"].table, MARTS["agrodistrib"].table, MARTS["vulnerabilite"].table

    # ---- index et référentiels (le mart vulnérabilité porte les 45 départements)
    departements_suivi = sorted({s.code_departement for s in suivi})
    cultures_besoins = sorted({x.culture for x in besoins if x.culture})
    cultures_choix = sorted({x.culture for x in choix})
    toutes_cultures = sorted(set(cultures_besoins) | set(cultures_choix))
    index = Index(
        departements={v.code_departement: v.departement for v in sorted(vuln, key=lambda v: v.code_departement)},
        departements_suivi=departements_suivi,
        regions=dict(sorted({v.code_region: v.region for v in vuln}.items())),
        zones=sorted({v.zone_agroecologique for v in vuln}),
        cultures=toutes_cultures,
        campagnes=sorted({x.campagne_agricole for x in carte}),
        annees_suivi=sorted({x.annee for x in suivi}),
        annees_prev_saison=sorted({x.annee for x in prev_saison}),
        annees_prev_rendement=sorted({x.annee for x in prev_rendement}),
        cultures_prev_rendement=sorted({x.culture for x in prev_rendement}),
        annees_semis=sorted({x.annee for x in semis if x.annee is not None}),
        cultures_semis=sorted({x.culture for x in semis}),
        a_evaluation=bool(evaluation),
        a_opportunites=bool(opportunites),
        campagnes_prix=sorted({x.campagne for x in prix}),
        a_cadre_harmonise=bool(cadre),
    )
    b.c.index = index

    ensemble_suivi = set(departements_suivi)
    lieux = {x.code_departement: x for x in carte}  # coordonnées identiques pour toutes les campagnes
    refs_dep = [
        DepartementRef(
            code_departement=v.code_departement,
            departement=v.departement,
            code_region=v.code_region,
            region=v.region,
            zone_agroecologique=v.zone_agroecologique,
            zone_secondaire=getattr(lieux.get(v.code_departement), "zone_secondaire", None),
            latitude=getattr(lieux.get(v.code_departement), "latitude", None),
            longitude=getattr(lieux.get(v.code_departement), "longitude", None),
            a_suivi_decadaire=v.code_departement in ensemble_suivi,
            a_score_vulnerabilite=v.score_vulnerabilite is not None,
        )
        for v in sorted(vuln, key=lambda v: v.code_departement)
    ]
    b.ajouter(cles.ref("departements"), refs_dep, DepartementRef, t_vuln)
    b.ajouter(
        cles.ref("regions"),
        [
            RegionRef(
                code_region=code,
                region=membres[0].region,
                nb_departements=len(membres),
                zones_agroecologiques=sorted({m.zone_agroecologique for m in membres}),
                departements=[m.code_departement for m in membres],
            )
            for code, membres in sorted(_grouper(refs_dep, lambda d: d.code_region).items())
        ],
        RegionRef,
        t_vuln,
    )
    b.ajouter(
        cles.ref("zones"),
        [
            ZoneRef(
                zone_agroecologique=zone,
                nb_departements=len(membres),
                regions=sorted({m.code_region for m in membres}),
                departements=[m.code_departement for m in membres],
            )
            for zone, membres in sorted(_grouper(refs_dep, lambda d: d.zone_agroecologique).items())
        ],
        ZoneRef,
        t_vuln,
    )
    cultivees = _grouper((a for a in agro if (a.superficie_reference_ha or 0) > 0), lambda a: a.culture)
    b.ajouter(
        cles.ref("cultures"),
        [
            CultureRef(
                culture=c,
                nb_departements_cultivee=len({a.code_departement for a in cultivees.get(c, [])}),
                dans_choix_cultures=c in cultures_choix,
                dans_besoins=c in cultures_besoins,
            )
            for c in toutes_cultures
        ],
        CultureRef,
        f"{t_choix}, {t_besoins}, {t_agro}",
    )
    b.ajouter(
        cles.ref("periodes"),
        Periodes(
            campagnes_agroclimat=index.campagnes,
            annees_suivi_decadaire=index.annees_suivi,
            derniere_campagne=max(index.campagnes),
        ),
        Periodes,
        f"{t_carte}, {t_suivi}",
    )

    # ---- module A : carte
    for campagne, lignes in _grouper(carte, lambda x: x.campagne_agricole).items():
        b.ajouter(cles.carte_campagne(campagne), lignes, CarteAgroclimat, t_carte, {"campagne": campagne}, AV_CARTE)
    for code, lignes in _grouper(carte, lambda x: x.code_departement).items():
        b.ajouter(cles.carte_departement(code), lignes, CarteAgroclimat, t_carte, {"code_departement": code}, AV_CARTE)

    # ---- module A : suivi décadaire
    for (code, annee), lignes in _grouper(suivi, lambda x: (x.code_departement, x.annee)).items():
        lignes.sort(key=lambda x: x.numero_decade_annee)
        filtres = {"code_departement": code, "annee": annee}
        b.ajouter(cles.suivi(code, annee, False), lignes, SuiviDecadaire, t_suivi, {**filtres, "saison_seulement": False}, AV_SUIVI)
        saison = [x for x in lignes if x.est_decade_saison]
        b.ajouter(cles.suivi(code, annee, True), saison, SuiviDecadaire, t_suivi, {**filtres, "saison_seulement": True}, AV_SUIVI)

    # ---- module B : choix des cultures (avertissement selon que les marts portent ou non le calcul décadaire)
    eau_calculee = any(x.methode_niveau for x in choix)
    av_cultures = [AV_CULTURES[0], AV_EAU_CALCULEE if eau_calculee else AV_EAU_SOURCE, *AV_CULTURES[1:]]
    for code, lignes in _grouper(choix, lambda x: x.code_departement).items():
        b.ajouter(cles.cultures(code, None), lignes, ChoixCulture, t_choix, {"code_departement": code}, av_cultures)
    for (code, culture), lignes in _grouper(choix, lambda x: (x.code_departement, x.culture)).items():
        b.ajouter(
            cles.cultures(code, culture), lignes, ChoixCulture, t_choix, {"code_departement": code, "culture": culture}, av_cultures
        )

    # ---- module C : besoins
    for code, lignes in _grouper(besoins, lambda x: x.code_departement).items():
        b.ajouter(cles.besoins(code, None), lignes, Besoin, t_besoins, {"code_departement": code}, AV_BESOINS)
    for (code, culture), lignes in _grouper((x for x in besoins if x.culture), lambda x: (x.code_departement, x.culture)).items():
        b.ajouter(cles.besoins(code, culture), lignes, Besoin, t_besoins, {"code_departement": code, "culture": culture}, AV_BESOINS)

    non_applicables = {(x.code_departement, x.culture) for x in besoins if x.culture and x.besoin_semences_applicable is False}
    lignes_besoins = [x for x in besoins if x.culture]
    for niveau in NIVEAUX:
        for culture in [None, *cultures_besoins]:
            membres = [x for x in lignes_besoins if culture is None or x.culture == culture]
            b.ajouter(
                cles.besoins_totaux(niveau, culture),
                agreger(membres, niveau, culture, True, non_applicables),
                Agregat,
                t_besoins,
                {"niveau": niveau, "culture": culture},
                AV_AGREGATS,
            )

    # ---- module D : AgroDistrib
    cultures_agro = sorted({x.culture for x in agro})
    for culture in [None, *cultures_agro]:
        membres = [x for x in agro if culture is None or x.culture == culture]
        b.ajouter(cles.agrodistrib_territoires(culture), membres, TerritoireAgrodistrib, t_agro, {"culture": culture}, AV_AGRODISTRIB)
        for niveau in NIVEAUX:
            b.ajouter(
                cles.agrodistrib_agregats(niveau, culture),
                agreger(membres, niveau, culture, False, non_applicables),
                Agregat,
                t_agro,
                {"niveau": niveau, "culture": culture},
                AV_AGREGATS,
            )

    # ---- vulnérabilité
    b.ajouter(cles.vulnerabilite_classement(), vuln, Vulnerabilite, t_vuln, None, AV_VULNERABILITE)
    for v in vuln:
        b.ajouter(
            cles.vulnerabilite_departement(v.code_departement), v, Vulnerabilite, t_vuln, {"code_departement": v.code_departement},
            AV_VULNERABILITE,
        )

    b.ajouter(cles.ref("intrants"), INTRANTS, IntrantRef, SOURCE_INTRANTS)
    b.ajouter(cles.ref("phases-cadre-harmonise"), PHASES_CH, PhaseCadreHarmonise, SOURCE_PHASES_CH)
    _construire_opportunites(b, opportunites)
    _construire_prix(b, prix)
    _construire_cadre_harmonise(b, cadre)
    _construire_previsions(b, prefixe_ml or f"{prefixe_source.split('.')[0]}.ML", prev_saison, prev_rendement, semis,
                           evaluation)
    return b.c


# ---------------------------------------------------------------- carte des opportunités


def _construire_opportunites(b: _Constructeur, lignes: list[CarteOpportunite]) -> None:
    """La carte entière, une couleur à la fois (bleu = classement des opportunités), et le détail d'un département."""
    if not lignes:
        return
    table = MARTS["opportunites"].table
    avertissements = list(AV_OPPORTUNITES)
    if all(x.categorie_eau == "non évaluée" for x in lignes):
        avertissements.insert(0, AV_OPPORTUNITES_SANS_EAU)
    lignes = sorted(lignes, key=lambda x: x.code_departement)
    b.ajouter(cles.opportunites(None), lignes, CarteOpportunite, table, None, avertissements)
    for couleur in COULEURS:
        membres = [x for x in lignes if x.couleur_carte == couleur]
        if couleur == "bleu":
            membres.sort(key=lambda x: (x.rang_opportunite_eau is None, x.rang_opportunite_eau or 0, x.code_departement))
        b.ajouter(cles.opportunites(couleur), membres, CarteOpportunite, table, {"couleur": couleur}, avertissements)
    for x in lignes:
        b.ajouter(cles.opportunites_departement(x.code_departement), x, CarteOpportunite, table,
                  {"code_departement": x.code_departement}, avertissements)


# ---------------------------------------------------------------- modèles d'IA (SALTIS.ML)

AV_PREV_SAISON = [
    "Prévision faite fin mai, avec deux indices océaniques (El Niño, Atlantique sud) : mêmes probabilités pour tout le pays une année donnée.",
    "Gain modeste par rapport à la climatologie (RPSS +0,06 en validation, +0,17 sur 2016-2025) : toujours afficher les 3 probabilités et la fourchette.",
]
AV_PREV_TENDANCE = [
    "Prévision de tendance : océan de mars-mai pas encore connu pour cette année ; pluie attendue = moyenne des 15 dernières saisons.",
    "Erreur mesurée sur 2016-2025 : 115 mm (normale seule : 122 mm). Remplacée par la prévision océan dès fin mai de l'année.",
]
AV_RENDEMENT = [
    "Gain faible : la prévision ne bat la référence que là où alerte_fiable ou rendement_fiable est vrai.",
    "Ailleurs, présenter la fourchette comme la récolte habituelle du département, pas comme une prévision de l'année.",
    "PROJECTION_NON_EVALUEE (2022-2026) : invérifiable, modèle appris sur des superficies récoltées (≤ 2015).",
]
AV_ALERTE = [
    "Classement relatif des départements à surveiller ; prévision de l'année seulement là où alerte_fiable est vrai.",
    "Chute = rendement sous 80 % de la tendance (moyenne des 10 campagnes précédentes).",
    "PROJECTION_NON_EVALUEE (2022-2026) : invérifiable.",
]
AV_SEMIS = [
    "Seuils à valider avec les agronomes : pluie de semis ≥ 20 mm, décade sèche < 10 mm, fin de cycle − 20 jours.",
    "Données décadaires : une période sèche à cheval sur deux décades est mal vue.",
    "Guédiawaye absent (pas de pluie décadaire).",
]
AV_EVALUATION = ["Chaque modèle est comparé à une prévision simple (climatologie, fréquence passée ou tendance) ; détail dans ml/MODELES.md."]


def _construire_previsions(
    b: _Constructeur,
    prefixe_ml: str,
    prev_saison: list[PrevisionSaison],
    prev_rendement: list[PrevisionRendement],
    semis: list[RisqueSemis],
    evaluation: list[EvaluationModele],
) -> None:
    source = {d.cle: f"{prefixe_ml}.{d.table}" for d in MARTS.values() if d.schema == "ml"}

    # Modèle 1 : par année (carte) et par département (historique)
    for annee, lignes in _grouper(prev_saison, lambda x: x.annee).items():
        tendance = all(x.type_prevision == "PREVISION_TENDANCE" for x in lignes)
        b.ajouter(cles.prev_saison_annee(annee), lignes, PrevisionSaison, source["prev_saison"], {"annee": annee},
                  AV_PREV_TENDANCE if tendance else AV_PREV_SAISON)
    for code, lignes in _grouper(prev_saison, lambda x: x.code_departement).items():
        b.ajouter(cles.prev_saison_departement(code), lignes, PrevisionSaison, source["prev_saison"], {"code_departement": code},
                  AV_PREV_SAISON)

    # Modèle 3 : un département (toutes cultures ou une), et la carte d'alerte (tous départements)
    for (code, annee), lignes in _grouper(prev_rendement, lambda x: (x.code_departement, x.annee)).items():
        filtres = {"code_departement": code, "annee": annee}
        b.ajouter(cles.rendement(code, annee, None), lignes, PrevisionRendement, source["prev_rendement"], filtres, AV_RENDEMENT)
        for culture, de_culture in _grouper(lignes, lambda x: x.culture).items():
            b.ajouter(cles.rendement(code, annee, culture), de_culture, PrevisionRendement, source["prev_rendement"],
                      {**filtres, "culture": culture}, AV_RENDEMENT)
    for (annee, moment), lignes in _grouper(prev_rendement, lambda x: (x.annee, x.moment_prevision)).items():
        filtres = {"annee": annee, "moment": moment}
        lignes.sort(key=lambda x: (-(x.proba_chute_pct or -1), x.code_departement, x.culture))
        b.ajouter(cles.alerte_recolte(annee, moment, None), lignes, PrevisionRendement, source["prev_rendement"], filtres, AV_ALERTE)
        for culture, de_culture in _grouper(lignes, lambda x: x.culture).items():
            b.ajouter(cles.alerte_recolte(annee, moment, culture), de_culture, PrevisionRendement, source["prev_rendement"],
                      {**filtres, "culture": culture}, AV_ALERTE)

    # Modèle 4 : un département (frise des décades), et la carte des décades conseillées
    for (code, annee), lignes in _grouper(semis, lambda x: (x.code_departement, x.annee)).items():
        filtres = {"code_departement": code, "annee": annee}
        b.ajouter(cles.semis(code, annee, None), lignes, RisqueSemis, source["semis"], filtres, AV_SEMIS)
        for culture, de_culture in _grouper(lignes, lambda x: x.culture).items():
            b.ajouter(cles.semis(code, annee, culture), de_culture, RisqueSemis, source["semis"], {**filtres, "culture": culture},
                      AV_SEMIS)
    conseillees = [x for x in semis if x.decade_conseillee]
    for (annee, culture), lignes in _grouper(conseillees, lambda x: (x.annee, x.culture)).items():
        b.ajouter(cles.semis_carte(annee, culture), lignes, RisqueSemis, source["semis"], {"annee": annee, "culture": culture},
                  AV_SEMIS)

    # Fiabilité
    if evaluation:
        b.ajouter(cles.evaluation(None), evaluation, EvaluationModele, source["evaluation"], None, AV_EVALUATION)
        for modele, lignes in _grouper(evaluation, lambda x: x.modele).items():
            b.ajouter(cles.evaluation(modele), lignes, EvaluationModele, source["evaluation"], {"modele": modele}, AV_EVALUATION)


# ---------------------------------------------------------------- référentiel des intrants, prix, Cadre harmonisé

# Produits du seed dbt ref_intrants (noms et teneurs repris tels quels) qui ont une colonne de besoin.
SOURCE_INTRANTS = "dbt/seeds/ref_intrants.csv"
INTRANTS = [
    IntrantRef(code_intrant="NPK_15_15_15", nom_intrant="NPK 15-15-15", colonne_besoin="besoin_npk_15_15_15_t",
               colonne_libelle="libelle_npk_15_15_15", dans_totaux=True, teneur_n_pct=15, teneur_p2o5_pct=15, teneur_k2o_pct=15),
    IntrantRef(code_intrant="NPK_15_10_10", nom_intrant="NPK 15-10-10", colonne_besoin="besoin_npk_15_10_10_t",
               colonne_libelle="libelle_npk_15_10_10", dans_totaux=True, teneur_n_pct=15, teneur_p2o5_pct=10, teneur_k2o_pct=10),
    IntrantRef(code_intrant="NPK_6_20_10", nom_intrant="NPK 6-20-10", colonne_besoin="besoin_npk_6_20_10_t",
               colonne_libelle="libelle_npk_6_20_10", dans_totaux=True, teneur_n_pct=6, teneur_p2o5_pct=20, teneur_k2o_pct=10),
    IntrantRef(code_intrant="UREE", nom_intrant="Urée 46-0-0", colonne_besoin="besoin_uree_t", colonne_libelle="libelle_uree",
               dans_totaux=True, teneur_n_pct=46, teneur_p2o5_pct=0, teneur_k2o_pct=0),
    IntrantRef(code_intrant="DAP_18_46_0", nom_intrant="DAP 18-46-0", colonne_besoin="besoin_dap_t", colonne_libelle="libelle_dap",
               dans_totaux=True, teneur_n_pct=18, teneur_p2o5_pct=46, teneur_k2o_pct=0),
    IntrantRef(code_intrant="FUMIER", nom_intrant="Fumier", colonne_besoin="besoin_fumier_t", colonne_libelle="libelle_fumier",
               dans_totaux=False),
    IntrantRef(code_intrant="SEMENCES", nom_intrant="Semences", colonne_besoin="besoin_semences_retenu_t",
               colonne_libelle="libelle_semences", dans_totaux=True),
]
NOMS_INTRANTS = {x.code_intrant: x.nom_intrant for x in INTRANTS}

SOURCE_PHASES_CH = "Cadre harmonisé (CILSS), palette officielle des phases"
COULEURS_PHASES_CH = {1: "#CDFACD", 2: "#FAE61E", 3: "#E67800", 4: "#C80000", 5: "#640000"}
PHASES_CH = [PhaseCadreHarmonise(phase=p, libelle=libelle, couleur=COULEURS_PHASES_CH[p]) for p, libelle in LIBELLES_PHASES.items()]

AV_PRIX = [
    "Prix NULL = à saisir (statut A_SAISIR), jamais 0.",
    "Coût réel = prix de cession + subvention de l'État / 20 sacs par tonne.",
    "Prix A_CONFIRMER : sources publiques citées dans `source`, à vérifier.",
]
AV_CADRE = [
    "Dernier cycle du Cadre harmonisé ; hors score de vulnérabilité.",
    "Période retenue : celle marquée à utiliser par le Cadre harmonisé, sinon la projection ; periode_terminee recalculée à la requête.",
    "Pikine inclut Keur Massar (fusion_keur_massar).",
    "Populations additives entre départements ; phases jamais.",
    "Licence CC BY : citer la source.",
]


def _construire_prix(b: _Constructeur, lignes: list[PrixIntrant]) -> None:
    if not lignes:
        return
    table = MARTS["prix"].table
    lignes = sorted((x.model_copy(update={"nom_intrant": x.nom_intrant or NOMS_INTRANTS.get(x.code_intrant)}) for x in lignes),
                    key=lambda x: (x.campagne, x.code_intrant))
    table = f"{b.prefixe_source}.{table}"
    b.ajouter(cles.prix_intrants(None), lignes, PrixIntrant, table, None, AV_PRIX)
    for campagne, membres in _grouper(lignes, lambda x: x.campagne).items():
        b.ajouter(cles.prix_intrants(campagne), membres, PrixIntrant, table, {"campagne": campagne}, AV_PRIX)


def _construire_cadre_harmonise(b: _Constructeur, lignes: list[CadreHarmonise]) -> None:
    if not lignes:
        return
    table = MARTS["cadre_harmonise"].table
    lignes = sorted(lignes, key=lambda x: x.code_departement)
    b.ajouter(cles.cadre_harmonise(None), lignes, CadreHarmonise, table, None, AV_CADRE)
    for x in lignes:
        b.ajouter(cles.cadre_harmonise(x.code_departement), x, CadreHarmonise, table, {"code_departement": x.code_departement}, AV_CADRE)
