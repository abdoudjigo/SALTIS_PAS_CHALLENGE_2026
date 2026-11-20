"""Nommage des clés de réponse (relatives à une version). Seul endroit où les clés sont construites.

Disposition dans Redis (préfixe `saltis` par défaut) :

    saltis:version_active            nom de la version servie
    saltis:versions                  versions conservées, la plus récente en tête
    saltis:verrou                    verrou du préchargement (NX + expiration)
    saltis:<version>:info            InfoVersion (JSON)
    saltis:<version>:index           Index (JSON) : départements, cultures, années valides
    saltis:<version>:r:<cle>         réponse JSON prête à servir (≤ 1 Ko)
    saltis:<version>:r:<cle>|gz      réponse JSON compressée en gzip (> 1 Ko, seule variante stockée)
"""

import unicodedata

TOUTES = "*"
SUFFIXE_GZIP = "|gz"


def normaliser(texte: str) -> str:
    """Majuscules, sans accents ni espaces superflus : « maïs » → « MAIS »."""
    sans_accents = "".join(c for c in unicodedata.normalize("NFKD", texte) if not unicodedata.combining(c))
    return " ".join(sans_accents.upper().split())


def ref(nom: str) -> str:
    return f"ref:{nom}"


def carte_campagne(campagne: int) -> str:
    return f"agroclimat:campagne:{campagne}"


def carte_departement(code: str) -> str:
    return f"agroclimat:departement:{code}"


def suivi(code: str, annee: int, saison_seulement: bool) -> str:
    return f"suivi:{code}:{annee}" + (":saison" if saison_seulement else "")


def cultures(code: str, culture: str | None) -> str:
    return f"cultures:{code}:{culture or TOUTES}"


def besoins(code: str, culture: str | None) -> str:
    return f"besoins:{code}:{culture or TOUTES}"


def besoins_totaux(niveau: str, culture: str | None) -> str:
    return f"besoins:totaux:{niveau}:{culture or TOUTES}"


def agrodistrib_territoires(culture: str | None) -> str:
    return f"agrodistrib:territoires:{culture or TOUTES}"


def agrodistrib_agregats(niveau: str, culture: str | None) -> str:
    return f"agrodistrib:agregats:{niveau}:{culture or TOUTES}"


def vulnerabilite_classement() -> str:
    return "vulnerabilite:classement"


def vulnerabilite_departement(code: str) -> str:
    return f"vulnerabilite:departement:{code}"


def opportunites(couleur: str | None) -> str:
    return f"opportunites:carte:{couleur or TOUTES}"


def opportunites_departement(code: str) -> str:
    return f"opportunites:departement:{code}"


# ---- modèles d'IA (SALTIS.ML)
ANNEE_TYPE = "type"


def prev_saison_annee(annee: int) -> str:
    return f"prev:saison:annee:{annee}"


def prev_saison_departement(code: str) -> str:
    return f"prev:saison:departement:{code}"


def rendement(code: str, annee: int, culture: str | None) -> str:
    return f"prev:rendement:{code}:{annee}:{culture or TOUTES}"


def alerte_recolte(annee: int, moment: str, culture: str | None) -> str:
    return f"prev:alerte:{annee}:{moment}:{culture or TOUTES}"


def semis(code: str, annee: int | None, culture: str | None) -> str:
    return f"prev:semis:{code}:{annee or ANNEE_TYPE}:{culture or TOUTES}"


def semis_carte(annee: int | None, culture: str) -> str:
    return f"prev:semis-carte:{annee or ANNEE_TYPE}:{culture}"


def evaluation(modele: str | None) -> str:
    return f"prev:evaluation:{modele or TOUTES}"


def opportunites(couleur: str | None) -> str:
    return f"opportunites:carte:{couleur or TOUTES}"


def opportunites_departement(code: str) -> str:
    return f"opportunites:departement:{code}"


def prix_intrants(campagne: int | None) -> str:
    return f"prix:{campagne or TOUTES}"


def cadre_harmonise(code: str | None) -> str:
    return f"cadre-harmonise:{code or TOUTES}"
