"""Répondre à une intention avec les chiffres réels du cache de l'API, en français et en wolof.

Phrases types : courtes, une idée, les chiffres. Les phrases wolof sont À FAIRE RELIRE par un locuteur de l'équipe.
Une donnée absente est dite absente (« non disponible »), jamais inventée ni remplacée par 0.
"""

import gzip
import json
from dataclasses import asdict, dataclass, field
from typing import Any

from ..cache import cles
from ..cache.construction import Index
from .comprendre import Intention
from .nombres import en_lettres

SEUIL_ALERTE_PCT = 40  # même seuil que l'écran « Alerte récolte »
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
# Culture → (français, wolof). Wolof À FAIRE RELIRE.
LIBELLES = {
    "ARACHIDE": ("l'arachide", "gerte"), "MIL (SOUNA)": ("le mil", "dugub"), "SORGHO": ("le sorgho", "basi"),
    "MAÏS": ("le maïs", "mboq"), "NIÉBÉ": ("le niébé", "ñebbe"), "RIZ (IRRIGUÉ)": ("le riz", "malo"),
    "SÉSAME": ("le sésame", "beref"), "PASTÈQUE": ("la pastèque", "xaal"), "COTON": ("le coton", "koton"),
    "MANIOC": ("le manioc", "ñambi"), "OIGNON": ("l'oignon", "soble"), "TOMATE": ("la tomate", "tamaate"),
}
CLASSES = {"sèche": ("sèche", "taw bu néew"), "normale": ("normale", "taw bu yem"), "humide": ("humide", "taw bu bare")}
# Fonctionnalité de la voix → bouton du front
MODES = {"saison": "saison", "semis": "semis", "culture": "semer", "besoins": "surface", "alerte": "alerte"}


@dataclass
class Reponse:
    fonctionnalite: str
    texte_fr: str
    texte_wo: str
    code_departement: str | None = None
    departement: str | None = None
    culture: str | None = None
    annee: int | None = None
    nature: str | None = None  # prévision océan, de tendance, année passée
    vue: dict[str, Any] = field(default_factory=dict)

    def en_dict(self) -> dict[str, Any]:
        return asdict(self)


class Lecteur:
    """Lit une réponse précalculée du cache (même contenu que la route HTTP correspondante)."""

    def __init__(self, cache, version: str):
        self.cache, self.version = cache, version

    async def donnees(self, cle: str) -> list[dict[str, Any]]:
        trouve = await self.cache.lire(self.version, cle)
        if trouve is None:
            return []
        contenu, compresse, _ = trouve
        corps = json.loads(gzip.decompress(contenu) if compresse else contenu)
        d = corps["donnees"]
        return d if isinstance(d, list) else [d]


def annee_a_venir(index: Index) -> int:
    futures = [a for a in index.annees_prev_saison if a > max(index.campagnes)]
    return futures[0] if futures else max(index.annees_prev_saison or index.campagnes)


def _nature(type_prevision: str | None) -> str:
    return {"PREVISION_OCEAN": "prévision océan", "PREVISION_TENDANCE": "prévision de tendance"}.get(type_prevision or "", "année passée")


def _pct(x: float | None) -> str:
    return "non disponible" if x is None else f"{round(x)} %"


def _jours(decade: int) -> tuple[int, int, str]:
    mois, rang = (decade - 1) // 3, (decade - 1) % 3
    fin = {0: 10, 1: 20}.get(rang, 31 if mois in (0, 2, 4, 6, 7, 9, 11) else 30)
    return 1 + 10 * rang, fin, MOIS[mois]


def _sans_donnees(i: Intention, quoi: str, quoi_wo: str) -> Reponse:
    return Reponse(i.fonctionnalite, f"{quoi} : non disponible pour cette demande.", f"{quoi_wo} : amul ci li nga laaj.", annee=i.annee)


def _demander_departement(i: Intention) -> Reponse:
    return Reponse(i.fonctionnalite, "Pour quel département ? Dites par exemple « Kaolack ».",
                   "Ban departemaa ? Waxal ma ko, ni « Kaolack ».", annee=i.annee)


async def repondre(i: Intention, index: Index, lecteur: Lecteur) -> Reponse:
    annee = i.annee or annee_a_venir(index)
    i.annee = annee
    nom = index.departements.get(i.code_departement or "")
    r: Reponse
    if i.fonctionnalite == "alerte":
        r = await _alerte(i, lecteur)
    elif i.fonctionnalite == "semis":
        r = await _semis(i, nom, lecteur) if nom else _demander_departement(i)
    elif i.fonctionnalite == "culture":
        r = await _recolte(i, nom, lecteur) if nom else _demander_departement(i)
    elif i.fonctionnalite == "besoins":
        r = await _besoins(i, nom, lecteur) if nom else _demander_departement(i)
    else:
        r = await _saison(i, nom, lecteur)
    r.vue = {"mode": MODES[r.fonctionnalite], "code_departement": r.code_departement, "culture": r.culture, "annee": r.annee}
    return r


async def _saison(i: Intention, nom: str | None, lecteur: Lecteur) -> Reponse:
    lignes = await lecteur.donnees(cles.prev_saison_annee(i.annee))
    if not lignes:
        return _sans_donnees(i, f"Prévision de la saison {i.annee}", f"Nawet {i.annee}")
    ligne = next((x for x in lignes if x["code_departement"] == i.code_departement), None)
    probas = {"sèche": lignes[0]["proba_seche_pct"], "normale": lignes[0]["proba_normale_pct"], "humide": lignes[0]["proba_humide_pct"]}
    classe = max(probas, key=lambda k: probas[k] or 0)
    fr_classe, wo_classe = CLASSES[classe]
    nature = _nature(lignes[0]["type_prevision"])
    if ligne:
        pluie, bas, haut = ligne["pluie_prevue_mm"], ligne["pluie_basse_mm"], ligne["pluie_haute_mm"]
        lieu_fr, lieu_wo = f"à {nom}", f"ci {nom}"
    else:
        valeurs = [x["pluie_prevue_mm"] for x in lignes if x["pluie_prevue_mm"] is not None]
        pluie, bas, haut = (sum(valeurs) / len(valeurs) if valeurs else None), None, None
        lieu_fr, lieu_wo = "au Sénégal", "ci Senegaal"
    fr = f"En {i.annee}, {lieu_fr}, la saison s'annonce plutôt {fr_classe} : {_pct(probas[classe])} de chances."
    if pluie is not None:
        fr += f" Pluie attendue : {round(pluie)} mm" + (f", entre {round(bas)} et {round(haut)} mm." if bas is not None else " en moyenne.")
    wo = f"Atum {en_lettres(i.annee)}, {lieu_wo}, nawet bi dina am {wo_classe}."
    if pluie is not None:
        wo += f" Taw bi ñu xaar mooy {en_lettres(pluie)} milimetar."
    return Reponse("saison", fr, wo, i.code_departement if ligne else None, nom if ligne else None, None, i.annee, nature)


async def _semis(i: Intention, nom: str, lecteur: Lecteur) -> Reponse:
    culture = i.culture or "ARACHIDE"
    lignes = await lecteur.donnees(cles.semis(i.code_departement, i.annee, culture))
    conseil = next((x for x in lignes if x["decade_conseillee"]), None)
    if not conseil:
        return _sans_donnees(i, f"Période de semis de {LIBELLES.get(culture, (culture,))[0]} à {nom}", "Jamono ji")
    j1, j2, mois = _jours(conseil["decade_semis"])
    fr_c, wo_c = LIBELLES.get(culture, (culture.lower(), culture.lower()))
    fr = (f"À {nom}, en {i.annee}, le meilleur moment pour semer {fr_c} est du {j1} au {j2} {mois} : "
          f"{_pct(conseil['risque_total_pct'])} de risque, le plus bas de la saison.")
    wo = f"Ci {nom}, {wo_c} gi, ngay ji ko diggante {en_lettres(j1)} ak {en_lettres(j2)} {mois}. Fa la loraange gi gën a néew."
    return Reponse("semis", fr, wo, i.code_departement, nom, culture, i.annee, _nature(conseil.get("type_prevision")))


async def _recolte(i: Intention, nom: str, lecteur: Lecteur) -> Reponse:
    lignes = [x for x in await lecteur.donnees(cles.rendement(i.code_departement, i.annee, i.culture)) if x["moment_prevision"] == "FIN_MAI"]
    lignes = [x for x in lignes if x["rendement_median_kg_ha"] is not None]
    if not lignes:
        return _sans_donnees(i, f"Récolte attendue à {nom} en {i.annee}", "Ngóob mi")
    lignes.sort(key=lambda x: -x["rendement_median_kg_ha"])
    choix = lignes[:1] if i.culture else lignes[:3]
    morceaux_fr = [f"{LIBELLES.get(x['culture'], (x['culture'],))[0]} entre {round(x['rendement_bas_kg_ha'])} et {round(x['rendement_haut_kg_ha'])} kg par hectare" for x in choix]
    morceaux_wo = [f"{LIBELLES.get(x['culture'], ('', x['culture']))[1]} diggante {en_lettres(x['rendement_bas_kg_ha'])} ak {en_lettres(x['rendement_haut_kg_ha'])} kilo" for x in choix]
    fr = f"Récolte attendue à {nom} en {i.annee} : " + " ; ".join(morceaux_fr) + "."
    wo = f"Ci {nom}, ngóob mi ñu xaar ci benn ektaar: " + ", ".join(morceaux_wo) + "."
    return Reponse("culture", fr, wo, i.code_departement, nom, i.culture, i.annee, "projection (récolte habituelle et saison prévue)")


INTRANTS = [("besoin_semences_retenu_t", "semences", "jiwu"), ("besoin_npk_15_15_15_t", "NPK 15-15-15", "NPK"),
            ("besoin_uree_t", "urée", "ure"), ("besoin_dap_t", "DAP", "DAP"), ("besoin_fumier_t", "fumier", "fumie")]


async def _besoins(i: Intention, nom: str, lecteur: Lecteur) -> Reponse:
    culture = i.culture or "MIL (SOUNA)"
    surface = i.surface_ha or 1.0
    lignes = await lecteur.donnees(cles.besoins(i.code_departement, culture))
    ligne = lignes[0] if lignes else None
    if not ligne or not ligne.get("superficie_reference_ha"):
        return _sans_donnees(i, f"Besoins pour {LIBELLES.get(culture, (culture,))[0]} à {nom}", "Soxla yi")
    fr_c, wo_c = LIBELLES.get(culture, (culture.lower(), culture.lower()))
    connus_fr, connus_wo, manquants = [], [], []
    for colonne, libelle_fr, libelle_wo in INTRANTS:
        t = ligne.get(colonne)
        if t is None:
            manquants.append(libelle_fr)
            continue
        kg = t * 1000 / ligne["superficie_reference_ha"] * surface
        if round(kg) == 0:  # produit absent de la formule de la zone
            connus_fr.append(f"pas de {libelle_fr}")
            connus_wo.append(f"{libelle_wo} amul")
        elif kg >= 1000:
            connus_fr.append(f"{libelle_fr} {kg / 1000:.1f} t".replace(".0 t", " t").replace(".", ","))
            connus_wo.append(f"{libelle_wo} {en_lettres(kg / 1000)} tonn")
        else:
            connus_fr.append(f"{libelle_fr} {round(kg)} kg")
            connus_wo.append(f"{libelle_wo} {en_lettres(kg)} kilo")
    ha_fr = f"{surface:g} ha" if surface != 1 else "1 ha"
    fr = f"Pour {ha_fr} de {fr_c.removeprefix('le ')} à {nom} : " + (", ".join(connus_fr) or "aucune dose connue") + "."
    if manquants:
        fr += f" Dose à saisir : {', '.join(manquants)}."
    wo = f"Ngir {en_lettres(surface)} ektaar {wo_c} ci {nom}: " + (", ".join(connus_wo) or "amul dose bu ñu xam") + "."
    return Reponse("besoins", fr, wo, i.code_departement, nom, culture, i.annee, "doses de référence de la zone")


async def _alerte(i: Intention, lecteur: Lecteur) -> Reponse:
    lignes = await lecteur.donnees(cles.alerte_recolte(i.annee, "FIN_MAI", i.culture))
    if not lignes:
        return _sans_donnees(i, f"Alerte récolte {i.annee}", "Ngóob mi")
    alertes, vus = [], set()
    for x in lignes:
        if (x["proba_chute_pct"] or 0) >= SEUIL_ALERTE_PCT and x["departement"] not in vus:
            vus.add(x["departement"])
            alertes.append(x)
    if not alertes:
        fr = f"En {i.annee}, aucun département ne dépasse {SEUIL_ALERTE_PCT} % de risque de chute de récolte."
        wo = f"Atum {en_lettres(i.annee)}, amul departemaa bu ngóob mi mën a wàññiku lool."
    else:
        noms = [x["departement"] for x in alertes]
        fr = f"En {i.annee}, {len(noms)} département{'s' if len(noms) > 1 else ''} en alerte : " + ", ".join(
            f"{x['departement']} ({LIBELLES.get(x['culture'], (x['culture'],))[0]}, {_pct(x['proba_chute_pct'])})" for x in alertes) + "."
        wo = f"Atum {en_lettres(i.annee)}, {en_lettres(len(noms))} departemaa la ngóob mi mën a wàññiku: {', '.join(noms)}."
    return Reponse("alerte", fr, wo, None, None, i.culture, i.annee, "projection : risque habituel, pas encore une prévision de l'année")
