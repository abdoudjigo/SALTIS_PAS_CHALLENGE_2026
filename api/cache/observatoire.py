"""Construction des réponses précalculées de l'Observatoire Sénégal 2050 (routes /observatoire).

Tout est calculé ici, au préchargement : une requête HTTP ne fait qu'un GET dans le cache.
Règles : mesure absente = None (jamais 0), aucune interpolation, aucune prévision ; le rendement national FAOSTAT
est une série distincte, jamais additionnée ni mélangée aux sommes des départements (DAPSA).
"""

from collections import defaultdict
from statistics import fmean
from typing import Any

from ..marts import MARTS
from ..schemas.observatoire import (
    DERNIERE_ANNEE_DEPARTEMENTS,
    LIBELLES_INDICATEURS,
    MESSAGE_OBJECTIF_NATIONAL,
    MESSAGE_SANS_OBJECTIF,
    PREMIERE_ANNEE,
    UNITES,
    CarteDepartement,
    ClassementDepartement,
    CultureObservatoire,
    FaostatPoint,
    FiltresObservatoire,
    IndicateursObservatoire,
    IndicateurZone,
    ObjectifLigne,
    ObjectifsObservatoire,
    PointOfficiel,
    PointSerie,
    ReferenceRendement,
    SerieObservatoireReponse,
    ZoneObservatoire,
)
from . import cles

DERNIERE_ANNEE_PROPOSEE = 2024  # dernière année du rendement national FAOSTAT
INDICATEURS = ("production", "surface", "rendement")
COLONNE = {"production": "production_t", "surface": "superficie_ha", "rendement": "rendement_kg_ha"}
SANS_DONNEES = ["OIGNON", "FONIO"]
MENTION_SANS_DONNEES = "Oignon, fonio : pas de données disponibles"
MENTION_ARRET = "Nos données par département s'arrêtent en 2021"
NOTE_FAOSTAT = "FAOSTAT : rendement national seul (pas de production ni de superficie), série distincte des sommes de départements."
SOURCES = [
    "DAPSA (HarvestStat 1981-2015, FEWS NET 2016-2021) : production et superficie par département ; régions et pays = somme des départements attendus.",
    "FAOSTAT : rendement national seul, série distincte, jamais additionnée aux sommes.",
    "SSA 2025-2034 et LPSAE 2025-2029 : objectifs et chiffres officiels (document et page indiqués).",
]
AV_SERIES = [
    "Région et pays = somme des départements attendus (Guédiawaye et Pikine exclus) ; total partiel quand est_complet est faux.",
    "Rendement = production x 1000 / superficie des départements ayant les deux, jamais une moyenne de rendements.",
    "Superficie récoltée jusqu'en 2015, semée ensuite : rendements 2016+ non comparables à ceux d'avant.",
    "Valeur null = non disponible, jamais 0. Aucune interpolation, aucune prévision.",
    "Nos données par département s'arrêtent en 2021 ; après, seul le rendement national FAOSTAT existe, présenté à part.",
]
AV_RIZ = "Riz : total région et pays arrêtés en 2020 (2021 incomplet : saison irriguée probablement manquante) ; départements 2021 visibles, marqués incomplets."
AV_OBJECTIFS = [
    "Seuls les objectifs et chiffres relevés dans la SSA 2025-2034 et la LPSAE 2025-2029 sont servis, avec leur page.",
    "Une contradiction entre documents reste visible (deux lignes) ; une erreur probable est gardée avec sa note.",
]
LIBELLES_OBJECTIFS = {
    "couverture_besoins_cereales": "Taux de couverture des besoins en céréales",
    "couverture_besoins_riz": "Taux de couverture des besoins en riz",
    "semences_certifiees": "Semences certifiées",
    "superficie_irriguee": "Superficie irriguée",
    "pertes_post_production": "Pertes post-production",
    "producteurs_climato_intelligents": "Producteurs climato-intelligents",
    "part_femmes_producteurs_climato_intelligents": "Part de femmes parmi les producteurs climato-intelligents",
    "georeferencement_parcelles": "Géoréférencement des parcelles",
    "evaluation_mi_parcours": "Évaluation à mi-parcours",
    "evaluation_finale": "Évaluation finale",
}
HORS_OBJECTIFS = ("production_officielle", "rendement_reference", "rendement_reference_comparaison")


def _arrondi(x: float | None, n: int = 2) -> float | None:
    return None if x is None else round(x, n)


def _variation(courant: float | None, precedent: float | None) -> float | None:
    if courant is None or precedent is None or precedent == 0:
        return None
    return round((courant - precedent) / precedent * 100, 2)


def _ecart_moyenne(valeurs: dict[int, float | None], annee: int) -> tuple[float | None, int | None]:
    """Écart (%) à la moyenne des 10 années précédentes disponibles (au moins 5)."""
    courant = valeurs.get(annee)
    passees = [v for a in range(annee - 10, annee) if (v := valeurs.get(a)) is not None]
    if courant is None or len(passees) < 5:
        return None, len(passees) or None
    return _variation(courant, fmean(passees)), len(passees)


def _derniere(valeurs: dict[int, float | None], annee: int) -> int | None:
    return max((a for a, v in valeurs.items() if v is not None and a <= annee), default=None)


def _classer(valeurs: dict[str, float]) -> dict[str, int]:
    ordre = sorted(valeurs, key=lambda k: (-valeurs[k], k))
    return {k: i + 1 for i, k in enumerate(ordre)}


def construire_observatoire(b: Any, series: list, objectifs: list, index: Any) -> None:
    table_series, table_objectifs = MARTS["observatoire_series"].table, MARTS["observatoire_objectifs"].table
    dapsa = [r for r in series if r.serie == "DAPSA"]
    faostat = [r for r in series if r.serie == "FAOSTAT"]

    # {(culture, code_zone): {annee: ligne}}
    par_zone: dict[tuple[str, str], dict[int, Any]] = defaultdict(dict)
    nom_zone: dict[str, tuple[str, str]] = {}
    region_dep: dict[str, tuple[str | None, str | None]] = {}
    niveau_zone: dict[str, str] = {}
    for r in dapsa:
        par_zone[(r.culture, r.code_zone)][r.campagne_agricole] = r
        nom_zone[r.code_zone] = (r.zone, r.niveau)
        niveau_zone[r.code_zone] = r.niveau
        if r.niveau == "DEPARTEMENT":
            region_dep[r.code_zone] = (r.code_region, r.region)
    fao: dict[str, dict[int, float | None]] = defaultdict(dict)
    for r in faostat:
        fao[r.culture][r.campagne_agricole] = r.rendement_kg_ha

    cultures = sorted({r.culture for r in dapsa})
    annees = list(range(PREMIERE_ANNEE, DERNIERE_ANNEE_PROPOSEE + 1))
    zones_culture: dict[str, list[str]] = {
        c: sorted(z for (cc, z) in par_zone if cc == c) for c in cultures
    }

    def valeurs(culture: str, zone: str, indicateur: str) -> dict[int, float | None]:
        return {a: getattr(r, COLONNE[indicateur]) for a, r in par_zone[(culture, zone)].items()}

    # ---- index
    index.a_observatoire = True
    index.cultures_observatoire = cultures
    index.annees_observatoire = annees
    index.zones_observatoire = dict(zones_culture)

    # ---- filtres
    fiches = []
    for c in cultures:
        couvertes = sorted({a for (cc, _), ls in par_zone.items() if cc == c for a, r in ls.items()
                            if r.niveau == "DEPARTEMENT" and (r.production_t is not None or r.superficie_ha is not None
                                                              or r.rendement_kg_ha is not None)})
        fiches.append(CultureObservatoire(
            culture=c, annees_couvertes=couvertes, premiere_annee=couvertes[0], derniere_annee=couvertes[-1],
            mention=f"données jusqu'en {couvertes[-1]}" if couvertes[-1] < DERNIERE_ANNEE_DEPARTEMENTS else None,
            a_totaux=("SEN" in zones_culture[c]),
            faostat_annees=sorted(a for a, v in fao.get(c, {}).items() if v is not None),
        ))
    zones = [ZoneObservatoire(code="SEN", nom="Sénégal", niveau="PAYS")]
    zones += [ZoneObservatoire(code=k, nom=v, niveau="REGION") for k, v in index.regions.items()]
    zones += [ZoneObservatoire(code=k, nom=v, niveau="DEPARTEMENT", code_region=region_dep.get(k, (None, None))[0])
              for k, v in index.departements.items()]
    annees_fao = sorted({a for d in fao.values() for a, v in d.items() if v is not None})
    apres = [a for a in annees_fao if a > DERNIERE_ANNEE_DEPARTEMENTS]
    manioc = next((f.premiere_annee for f in fiches if f.culture == "MANIOC"), None)
    couverture = [
        f"{sum(1 for f in fiches if f.a_totaux)} cultures par département de {PREMIERE_ANNEE} à {DERNIERE_ANNEE_DEPARTEMENTS}"
        + (f" (manioc depuis {manioc})" if manioc and manioc > PREMIERE_ANNEE else "")
        + " ; sésame par département seulement, données jusqu'en 2016.",
        (f"Rendement national FAOSTAT (rendement seul, série distincte) de {apres[0]} à {apres[-1]}." if apres
         else "Pas de rendement national FAOSTAT après 2021."),
        MENTION_SANS_DONNEES + ".",
    ]
    b.ajouter(
        cles.obs_filtres(),
        FiltresObservatoire(
            cultures=fiches, sans_donnees=SANS_DONNEES, mention_sans_donnees=MENTION_SANS_DONNEES, annees=annees,
            derniere_annee_departements=DERNIERE_ANNEE_DEPARTEMENTS, derniere_annee_faostat=annees_fao[-1] if annees_fao else None,
            zones=zones, couverture=couverture, sources=SOURCES,
        ),
        FiltresObservatoire, table_series, None, AV_SERIES,
    )

    # ---- rang et part nationale : par (culture, niveau, indicateur, année)
    rangs: dict[tuple[str, str, str, int], dict[str, int]] = {}
    for c in cultures:
        for ind in INDICATEURS:
            groupes: dict[tuple[str, int], dict[str, float]] = defaultdict(dict)
            for z in zones_culture[c]:
                if niveau_zone[z] == "PAYS":
                    continue
                for a, v in valeurs(c, z, ind).items():
                    if v is not None:
                        groupes[(niveau_zone[z], a)][z] = v
            for (niv, a), vals in groupes.items():
                rangs[(c, niv, ind, a)] = _classer(vals)

    # ---- indicateurs : (année, culture, zone)
    for c in cultures:
        avert = AV_SERIES + ([AV_RIZ] if c.startswith("RIZ") else [])
        for z in zones_culture[c]:
            nom, niv = nom_zone[z]
            vals = {ind: valeurs(c, z, ind) for ind in INDICATEURS}
            nationales = {ind: valeurs(c, "SEN", ind) for ind in ("production", "surface")} if "SEN" in zones_culture[c] else {}
            for a in annees:
                lignes = []
                for ind in INDICATEURS:
                    r = par_zone[(c, z)].get(a)
                    v = vals[ind].get(a)
                    ecart, nb = _ecart_moyenne(vals[ind], a)
                    prec = par_zone[(c, z)].get(a - 1)
                    comparable = None
                    if v is not None and prec is not None and vals[ind].get(a - 1) is not None and r is not None:
                        comparable = (r.nb_departements_observes == prec.nb_departements_observes
                                      and r.type_superficie == prec.type_superficie)
                    part = None
                    total = nationales.get(ind, {}).get(a) if ind in nationales else None
                    if (v is not None and total and niv != "PAYS" and r is not None and r.nb_departements_observes
                            and (niv == "REGION" or r.nb_departements_observes == 1)):
                        part = round(v / total * 100, 2)
                    rang = rangs.get((c, niv, ind, a), {}).get(z) if niv != "PAYS" else None
                    lignes.append(IndicateurZone(
                        indicateur=ind, libelle=LIBELLES_INDICATEURS[ind], unite=UNITES[ind], valeur=_arrondi(v, 3),
                        derniere_annee_disponible=None if v is not None else _derniere(vals[ind], a),
                        variation_n1_pct=_variation(v, vals[ind].get(a - 1)), comparable_n1=comparable,
                        ecart_moyenne_10_ans_pct=ecart, nb_annees_moyenne=nb if ecart is not None else None,
                        rang=rang, nb_classes=len(rangs[(c, niv, ind, a)]) if rang else None, part_nationale_pct=part,
                        est_complet=r.est_complet if r else None,
                        nb_departements_observes=r.nb_departements_observes if r else None,
                        nb_departements_attendus=r.nb_departements_attendus if r else None,
                        type_superficie=r.type_superficie if r else None,
                        serie="DAPSA" if v is not None else None,
                        source=r.source if (r and v is not None) else None,
                        note=r.note if r else None,
                    ))
                point_fao = None
                if niv == "PAYS" and c in fao:
                    vf = fao[c].get(a)
                    ecart_f, _ = _ecart_moyenne(fao[c], a)
                    point_fao = FaostatPoint(annee=a, rendement_kg_ha=_arrondi(vf, 3), variation_n1_pct=_variation(vf, fao[c].get(a - 1)),
                                             ecart_moyenne_10_ans_pct=ecart_f)
                b.ajouter(
                    cles.obs_indicateurs(a, c, z),
                    IndicateursObservatoire(annee=a, culture=c, niveau=niv, code_zone=z, zone=nom, indicateurs=lignes, rendement_faostat=point_fao),
                    IndicateursObservatoire, table_series, {"annee": a, "culture": c, "zone": z}, avert,
                )

    # ---- objectifs (utiles aux points officiels des séries)
    officiels: dict[tuple[str, str], list[Any]] = defaultdict(list)  # (culture, indicateur) -> lignes
    for o in objectifs:
        if o.indicateur in HORS_OBJECTIFS and o.culture:
            officiels[(o.culture, o.indicateur)].append(o)

    # ---- séries : (culture, zone, indicateur)
    for c in cultures:
        avert = AV_SERIES + ([AV_RIZ] if c.startswith("RIZ") else [])
        for z in zones_culture[c]:
            nom, niv = nom_zone[z]
            for ind in INDICATEURS:
                points = []
                for a in range(PREMIERE_ANNEE, DERNIERE_ANNEE_DEPARTEMENTS + 1):
                    r = par_zone[(c, z)].get(a)
                    v = getattr(r, COLONNE[ind]) if r else None
                    points.append(PointSerie(
                        annee=a, valeur=_arrondi(v, 3), est_complet=r.est_complet if r else None,
                        nb_departements_observes=r.nb_departements_observes if r else None,
                        nb_departements_attendus=r.nb_departements_attendus if r else None,
                        type_superficie=r.type_superficie if r else None,
                        source=r.source if (r and v is not None) else None, note=r.note if r else None,
                    ))
                serie_fao: list[FaostatPoint] = []
                if niv == "PAYS" and ind == "rendement":
                    serie_fao = [FaostatPoint(annee=a, rendement_kg_ha=_arrondi(v, 3), variation_n1_pct=_variation(v, fao[c].get(a - 1)))
                                 for a, v in sorted(fao.get(c, {}).items()) if v is not None]
                officiels_pts: list[PointOfficiel] = []
                if niv == "PAYS" and ind in ("production", "rendement"):
                    nom_ind = "production_officielle" if ind == "production" else "rendement_reference"
                    for o in officiels.get((c, nom_ind), []):
                        officiels_pts.append(PointOfficiel(
                            indicateur=nom_ind, annee=o.annee_reference, valeur=o.valeur_reference, unite=o.unite,
                            document=o.document, page=o.page, url=o.url, note=o.note))
                    officiels_pts.sort(key=lambda p: (p.annee or 0, p.document))
                reference = None
                if niv == "PAYS" and ind == "rendement":
                    ref = next(iter(officiels.get((c, "rendement_reference_comparaison"), [])), None)
                    if ref:
                        reference = ReferenceRendement(valeur=ref.valeur_reference, unite=ref.unite, note=ref.note,
                                                       document=ref.document, page=ref.page)
                b.ajouter(
                    cles.obs_serie(c, z, ind),
                    SerieObservatoireReponse(
                        culture=c, indicateur=ind, unite=UNITES[ind], niveau=niv, code_zone=z, zone=nom,
                        mention_arret=MENTION_ARRET, points=points, serie_faostat=serie_fao,
                        note_faostat=NOTE_FAOSTAT if niv == "PAYS" else None, points_officiels=officiels_pts, reference_rendement=reference,
                    ),
                    SerieObservatoireReponse, table_series, {"culture": c, "zone": z, "indicateur": ind}, avert,
                )

    # ---- carte et classement des départements : (année, culture, indicateur)
    departements = sorted(index.departements.items())
    for c in cultures:
        avert = AV_SERIES + ([AV_RIZ] if c.startswith("RIZ") else [])
        for ind in INDICATEURS:
            for a in annees:
                lignes, classes = [], []
                rg = rangs.get((c, "DEPARTEMENT", ind, a), {})
                for code, nom in departements:
                    r = par_zone.get((c, code), {}).get(a)
                    v = getattr(r, COLONNE[ind]) if r else None
                    cr, rn = region_dep.get(code, (None, None))
                    lignes.append(CarteDepartement(
                        code_departement=code, departement=nom, code_region=cr, region=rn, valeur=_arrondi(v, 3),
                        a_donnee=v is not None, rang=rg.get(code), est_complet=r.est_complet if r else None,
                        type_superficie=r.type_superficie if r else None, source=r.source if (r and v is not None) else None,
                        note=r.note if r else None,
                    ))
                    if v is not None:
                        ancien = par_zone.get((c, code), {}).get(a - 10)
                        va = getattr(ancien, COLONNE[ind]) if ancien else None
                        classes.append(ClassementDepartement(
                            rang=rg[code], code_departement=code, departement=nom, region=rn, valeur=_arrondi(v, 3),
                            est_complet=r.est_complet, annee_comparaison=a - 10, valeur_comparaison=_arrondi(va, 3),
                            progression_10_ans_pct=_variation(v, va),
                            rupture_type_superficie=ind != "production" and a - 10 <= 2015 < a,
                            source=r.source,
                        ))
                classes.sort(key=lambda x: x.rang)
                filtres = {"annee": a, "culture": c, "indicateur": ind}
                b.ajouter(cles.obs_carte(a, c, ind), lignes, CarteDepartement, table_series, filtres, avert)
                b.ajouter(cles.obs_classement(a, c, ind), classes, ClassementDepartement, table_series, filtres,
                          avert + ["Progression sur 10 ans : null si l'une des deux années manque ; elle traverse la rupture 2016 quand rupture_type_superficie est vrai."])

    # ---- objectifs
    _objectifs(b, objectifs, cultures, table_objectifs)


def _ligne_objectif(o: Any, culture: str | None) -> ObjectifLigne:
    concernees = [x.strip() for x in (o.cultures_concernees or "").split(";") if x.strip()]
    if culture is None:
        portee = "culture" if o.culture and not concernees else ("groupe" if concernees else "national")
    else:
        portee = "culture" if o.culture == culture else "groupe"
    return ObjectifLigne(
        indicateur=o.indicateur, libelle=LIBELLES_OBJECTIFS.get(o.indicateur, o.indicateur), portee=portee, culture=o.culture,
        cultures_concernees=concernees, unite=o.unite, valeur_reference=o.valeur_reference, annee_reference=o.annee_reference,
        cible=o.cible, annee_cible=o.annee_cible, document=o.document, page=o.page, url=o.url, note=o.note,
    )


def _objectifs(b: Any, objectifs: list, cultures: list[str], table: str) -> None:
    retenus = [o for o in objectifs if o.indicateur not in HORS_OBJECTIFS]
    for culture in [None, *cultures]:
        if culture is None:
            lignes = [_ligne_objectif(o, None) for o in retenus]
        else:
            lignes = [_ligne_objectif(o, culture) for o in retenus
                      if o.culture == culture or culture in (o.cultures_concernees or "").split(";")]
        for national in (True, False):
            if national:
                contenu = ObjectifsObservatoire(culture=culture, zone="SEN", objectifs=lignes,
                                                message=None if lignes else MESSAGE_SANS_OBJECTIF)
            else:
                contenu = ObjectifsObservatoire(culture=culture, zone="infra-national", objectifs=[],
                                                message=MESSAGE_OBJECTIF_NATIONAL)
            if not objectifs and national:
                contenu = ObjectifsObservatoire(culture=culture, zone="SEN", objectifs=[], message=MESSAGE_SANS_OBJECTIF)
            b.ajouter(cles.obs_objectifs(culture, national), contenu, ObjectifsObservatoire, table,
                      {"culture": culture, "zone": "SEN" if national else "infra-national"}, AV_OBJECTIFS)
