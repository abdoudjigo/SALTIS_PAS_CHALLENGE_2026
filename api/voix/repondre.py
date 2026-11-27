"""Répondre à une intention avec les chiffres réels du cache de l'API, en français et en wolof.

Phrases types : courtes, une idée, les chiffres. Les phrases wolof sont À FAIRE RELIRE par un locuteur de l'équipe.
Une donnée absente est dite absente (« non disponible »), jamais inventée ni remplacée par 0.
"""

import gzip
import json
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass, field
from typing import Any

from ..cache import cles
from ..cache.construction import Index
from . import bulletins as bt
from .comprendre import Intention, normaliser
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
    sources: list[dict[str, str]] = field(default_factory=list)
    redige_par_ia: bool = False

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


# Rédaction d'une question libre par le modèle de langue (fournie par la route : clé et débit vérifiés), ou None
Rediger = Callable[[str, list[dict[str, str]]], Awaitable[str | None]]


async def repondre(i: Intention, index: Index, lecteur: Lecteur, rediger: Rediger | None = None) -> Reponse:
    nom = index.departements.get(i.code_departement or "")
    if i.fonctionnalite in ("aide", "hors_champ", "bulletin", "libre"):
        if i.fonctionnalite == "aide":
            r = _aide(i)
        elif i.fonctionnalite == "hors_champ":
            r = _hors_champ()
        elif i.fonctionnalite == "bulletin":
            r = _bulletin(i, nom)
        else:
            r = await _libre(i, rediger)
        r.vue = {"mode": None, "code_departement": r.code_departement, "culture": r.culture, "annee": r.annee}
        return _saluer(r, i)
    annee = i.annee or annee_a_venir(index)
    i.annee = annee
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
    return _saluer(r, i)


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


# (colonne de besoin, nom français, nom court lu en wolof : nom du produit, aucune traduction inventée).
# Fumier absent : non chiffré (besoin_fumier_t toujours NULL), hors totaux.
INTRANTS = [("besoin_semences_retenu_t", "semences", "jiwu"), ("besoin_npk_15_15_15_t", "NPK 15-15-15", "NPK 15-15-15"),
            ("besoin_npk_15_10_10_t", "NPK 15-10-10", "NPK 15-10-10"), ("besoin_npk_6_20_10_t", "NPK 6-20-10", "NPK 6-20-10"),
            ("besoin_uree_t", "urée", "ure"), ("besoin_dap_t", "DAP", "DAP")]


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
        if ligne.get(colonne.replace("besoin_", "libelle_").removesuffix("_t")) == "pas dans la formule":
            continue  # produit absent de la formule retenue : on ne le cite pas
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
    # Même règle que l'écran « Alerte récolte » (app/src/scene/regles/alertes.ts, audit IA-01) : une alerte exige
    # un risque au-dessus du seuil ET une prévision fiable (alerte_fiable). Sinon, ce n'est que le risque habituel.
    eleves, vus = [], set()
    for x in lignes:
        if (x["proba_chute_pct"] or 0) >= SEUIL_ALERTE_PCT and x["departement"] not in vus:
            vus.add(x["departement"])
            eleves.append(x)
    alertes = [x for x in eleves if x.get("alerte_fiable") is True]

    def liste(xs):
        return ", ".join(f"{x['departement']} ({LIBELLES.get(x['culture'], (x['culture'],))[0]}, {_pct(x['proba_chute_pct'])})" for x in xs)

    if alertes:
        noms = [x["departement"] for x in alertes]
        fr = f"En {i.annee}, {len(noms)} département{'s' if len(noms) > 1 else ''} en alerte : " + liste(alertes) + "."
        wo = f"Atum {en_lettres(i.annee)}, {en_lettres(len(noms))} departemaa la ngóob mi mën a wàññiku: {', '.join(noms)}."
        nature = "prévision de l'année (alerte fiable)"
    elif eleves:
        fr = (f"En {i.annee}, aucune alerte fiable : le modèle ne prévoit pas encore cette récolte. "
              f"Risque habituel le plus élevé : " + liste(eleves[:3]) + ".")
        # Wolof À FAIRE RELIRE : « on ne sait pas encore si la récolte va baisser »
        wo = f"Atum {en_lettres(i.annee)}, xamuñu ba leegi ndax ngóob mi dina wàññiku."
        nature = "projection : risque habituel, pas encore une prévision de l'année"
    else:
        fr = f"En {i.annee}, aucun département ne dépasse {SEUIL_ALERTE_PCT} % de risque de chute de récolte."
        wo = f"Atum {en_lettres(i.annee)}, amul departemaa bu ngóob mi mën a wàññiku lool."
        nature = "projection : risque habituel, pas encore une prévision de l'année"
    return Reponse("alerte", fr, wo, None, None, i.culture, i.annee, nature)


# ---- Conversation, bulletins de l'ANACIM, question libre ----
# Phrases wolof À FAIRE RELIRE par un locuteur de l'équipe.

# Exemples proposés : uniquement des écrans de la plateforme (saison, semis, besoins)
EXEMPLES_FR = "« Quand semer l'arachide à Kaolack ? », « Comment sera la saison ? », « Combien d'engrais pour 1 hectare de mil à Kaolack ? »"
EXEMPLES_WO = "« Kañ laa wara ji gerte ci Kaolack ? », « Nawet bi, naka lay mel ? », « Ñaata ndawal laa soxla ngir benn ektaar dugub ci Kaolack ? »"


SUJETS_FR = "la saison, les semis, les cultures, les engrais ou les derniers bulletins de l'ANACIM"
SUJETS_WO = "nawet bi, ji gi, tool yi, ndawal yi walla bulletin yu mujj yi ANACIM génne"
AIDER_FR = f"Comment puis-je vous aider sur {SUJETS_FR} ?"
AIDER_WO = f"Lan laa la mana dimbali ci {SUJETS_WO} ?"


def _salut_wo(salut: str | None) -> str:
    return "Maalekum salaam" if salut == "Maalekum salaam" else "Salaam aleekum"


def _aide(i: Intention) -> Reponse:
    """Bonnes manières : on rend le salut, on répond à « ça va ? », on remercie, puis on propose son aide en une phrase."""
    salut = i.salut or "Bonjour"
    rendu_fr = f"{i.salut} ! " if i.salut else ""  # « Bonjour, ça va ? » : on rend d'abord le bonjour
    rendu_wo = f"{_salut_wo(i.salut)} ! " if i.salut else ""
    if i.politesse == "ca_va":
        return Reponse("aide", f"{rendu_fr}Je vais bien, merci ! Et vous ? {AIDER_FR}",
                       f"{rendu_wo}Maa ngi fi rekk, alxamdulilaa ! Yow nag ? {AIDER_WO}")
    if i.politesse == "merci":
        return Reponse("aide", "Avec plaisir ! N'hésitez pas si vous avez une autre question.",
                       "Ñoo ko bokk ! Su am nga beneen laaj, laajal ma.")
    if i.politesse == "au_revoir":
        return Reponse("aide", "Au revoir, et bonne saison ! Je reste là si vous avez une question.",
                       "Ba beneen yoon ! Nawet bu baax. Maa ngi fi su am nga laaj.")
    if i.politesse == "accord":
        return Reponse("aide", "Très bien ! Avez-vous une autre question ?", "Baax na ! Am nga beneen laaj ?")
    if i.politesse == "qui":
        return Reponse("aide",
                       f"{rendu_fr}Je suis l'assistant d'Assaman & Suuf. Je réponds à partir des données de la plateforme et des "
                       "bulletins de l'ANACIM : la saison, la date de semis, la culture à choisir, les besoins en semences et en "
                       f"engrais, les alertes récolte. Demandez par exemple : {EXEMPLES_FR}.",
                       f"{rendu_wo}Maa ngi di ndimbalkat bu Assaman & Suuf. Maa ngi tontu ak xibaar yi ci platefoorm bi ak bulletin "
                       f"yu ANACIM : nawet bi, ji gi, tool yi, ndawal yi, ngóob mi. Laajal ma ni : {EXEMPLES_WO}.")
    return Reponse("aide", f"{salut}, {AIDER_FR[0].lower()}{AIDER_FR[1:]}", f"{_salut_wo(i.salut)} ! {AIDER_WO}")


def _saluer(r: Reponse, i: Intention) -> Reponse:
    """« Bonjour, quand semer l'arachide ? » : on rend le salut avant de répondre."""
    if i.salut and r.fonctionnalite != "aide":
        r.texte_fr = f"{i.salut} ! {r.texte_fr}"
        r.texte_wo = f"{_salut_wo(i.salut)} ! {r.texte_wo}"
    return r


def _hors_champ() -> Reponse:
    return Reponse("hors_champ",
                   "Ce sujet n'est pas couvert par Assaman & Suuf (ravageurs, élevage, fleuves et marchés n'en font pas partie). "
                   "Je réponds sur la saison des pluies, la date de semis, la culture à choisir, les besoins en semences et en "
                   f"engrais, et les alertes récolte. Par exemple : {EXEMPLES_FR}.",
                   "Assaman & Suuf du wax ci loolu. Maa ngi tontu ci nawet bi, ji gi, tool yi, ndawal yi ak ngóob mi. "
                   f"Laajal ma ni : {EXEMPLES_WO}.")


def _source(b: bt.Bulletin, theme: str) -> dict[str, str]:
    return {"titre": f"Bulletin agrométéorologique de l'ANACIM, décade {b.periode_fr}", "theme": theme, "fichier": b.fichier}


# Mots de date : ils choisissent le bulletin, ils ne disent pas de quoi parler
MOTS_DATE = frozenset(normaliser(m) for m in (*bt.MOIS_FR, *bt.MOIS_WO, "premiere", "deuxieme", "troisieme", "debut", "milieu"))


def _precis(question: str) -> set[str]:
    return {m for m in bt.mots_precis(question) if m not in MOTS_DATE and not m.isdigit()}


def _racine(mot: str) -> str:
    """« chenilles » → « chenill » : le pluriel et le singulier se retrouvent."""
    return mot[: max(5, len(mot) - 2)]


def _phrases_precises(b: bt.Bulletin, theme: str | None, precis: set[str]) -> list[str]:
    """Les phrases qui citent les mots rares de la question, les plus proches d'abord (« Bakel » pèse plus que « fleuve »)."""
    sections = bt.THEMES[theme][1] if theme else tuple(b.sections)
    notees = []
    for rang, p in enumerate(x for s in sections for x in bt.phrases_gardees(b, s)):
        texte = normaliser(p)
        cites = {m for m in precis if _racine(m) in texte}
        if cites:
            notees.append((-bt.rarete(cites), rang, p))
    return [p for *_, p in sorted(notees)]


def _bulletin(i: Intention, nom: str | None) -> Reponse:
    t = normaliser(i.texte)
    if not bt.disponibles():
        return Reponse("bulletin", "Les bulletins de l'ANACIM ne sont pas installés sur ce serveur.",
                       "Bulletin yu ANACIM yi nekkuñu ci serwëer bi.")
    theme, mois, decade = bt.trouver_theme(t), bt.trouver_mois(t), bt.trouver_decade(t)
    annee = i.annee_citee
    b = bt.choisir(annee, mois, decade)
    if b is None:
        quand = " ".join(x for x in (bt.MOIS_FR[mois - 1] if mois else "", str(annee) if annee else "") if x) or "cette période"
        return Reponse("bulletin", f"Pas de bulletin de l'ANACIM pour {quand} : la base couvre {bt.etendue_fr()}.",
                       f"Amul bulletin ANACIM ci {quand}. Bulletin yi am nañu {bt.etendue_fr()}.", annee=annee)
    lieux = (nom,) if nom else ()
    # Les mots du thème lui-même (« conseils », « pluie ») ne précisent rien : tout le thème en parle
    mots_du_theme = {normaliser(m) for m in bt.THEMES[theme][0]} if theme else set()
    precis = {m for m in _precis(i.texte) if not any(m.startswith(x) or x.startswith(m) for x in mots_du_theme)}
    texte = ""
    if precis:  # « sauteriaux », « chenille légionnaire » : les phrases qui en parlent, du bulletin demandé ou du plus récent qui en parle
        date_dite = annee is not None or mois is not None or decade is not None
        candidats = [b] if date_dite else [b, *reversed([x for x in bt.charger() if x is not b])][:12]
        for c in candidats:
            precises = _phrases_precises(c, theme, precis)
            if precises:
                b, texte = c, bt.couper(precises)
                break
    if not texte:
        theme, texte = bt.extrait(b, theme, lieux)
    libelle = bt.THEMES_FR.get(theme or "sommaire", "l'essentiel") if theme != "lieu" else (nom or "le lieu demandé")
    theme_wo = bt.THEMES_WO.get(theme or "sommaire", "li ëpp solo") if theme != "lieu" else (nom or "")
    entete = f"Bulletin de l'ANACIM du {b.periode_fr.removeprefix('du ')}, {libelle}"
    if not texte:
        fr = f"{entete} : rien n'est signalé sur ce sujet."
    else:
        fr = f"{entete} : {texte}"
    wo = (f"Bulletin ANACIM bi ci {b.mois_wo} {b.annee} (décade {b.decade}) wax na ci {theme_wo}. "
          "Li mu wax ci farañse la bind : déglul ko ci farañse walla jàng ko ci suuf.")
    return Reponse("bulletin", fr, wo, i.code_departement if nom else None, nom, None, b.annee,
                   "bulletin ANACIM, texte cité", sources=[_source(b, theme or "sommaire")])


COUVERTURE_MIN = 0.5  # part (pondérée par la rareté) des mots précis de la question que le passage doit contenir


def _couvre(question: str, passage: str) -> bool:
    """« Qui a gagné la coupe du monde ? » ne doit pas tomber sur « accessibles à tout le monde » : un seul mot commun
    ne suffit pas, le passage doit contenir l'essentiel des mots rares de la question."""
    precis = _precis(question)
    if not precis:
        return False
    texte = normaliser(passage)
    trouves = {m for m in precis if _racine(m) in texte}
    return bool(trouves) and bt.rarete(trouves) >= COUVERTURE_MIN * bt.rarete(precis)


async def _libre(i: Intention, rediger: Rediger | None) -> Reponse:
    trouves = [(note, p) for note, p in bt.chercher(i.texte, n=8) if _couvre(i.texte, p.texte)][:4]
    if not trouves:
        return Reponse("libre",
                       "Je n'ai pas trouvé de réponse à cette question dans les données de la plateforme ni dans les bulletins "
                       f"de l'ANACIM. Essayez par exemple : {EXEMPLES_FR}.",
                       f"Gisuma tontu laaj boobu ci xibaar yi ma am. Laajal ma ni : {EXEMPLES_WO}.")
    passages = [{**_source(p.bulletin, p.theme), "extrait": p.texte} for _, p in trouves]
    sources = list({(x["titre"], x["theme"]): {k: v for k, v in x.items() if k != "extrait"} for x in passages}.values())
    premier = trouves[0][1]
    wo = (f"Bulletin ANACIM bi ci {premier.bulletin.mois_wo} {premier.bulletin.annee} wax na ci {bt.THEMES_WO.get(premier.theme, premier.theme)}. "
          "Tontu bi ci farañse la bind : déglul ko ci farañse walla jàng ko ci suuf.")
    redige = await rediger(i.texte, passages) if rediger else None
    if redige:
        return Reponse("libre", redige, wo, annee=premier.bulletin.annee, nature="rédigé à partir des bulletins ANACIM",
                       sources=sources, redige_par_ia=True)
    fr = (f"D'après le bulletin de l'ANACIM du {premier.bulletin.periode_fr.removeprefix('du ')} "
          f"({bt.THEMES_FR.get(premier.theme, premier.theme)}) : {bt.couper(bt.phrases(premier.texte)) or premier.texte}")
    return Reponse("libre", fr, wo, annee=premier.bulletin.annee, nature="bulletin ANACIM, texte cité", sources=sources)
