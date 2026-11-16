"""Lecture des marts dans Snowflake (lecture seule).

Snowflake n'est appelé qu'au préchargement du cache, jamais pendant une requête HTTP.
"""

import logging
import re
import warnings
from typing import Any, Callable

from .config import Parametres
from .source_locale import lire_resultats_ml

log = logging.getLogger(__name__)

_IDENTIFIANT = re.compile(r"^[A-Z][A-Z0-9_]*$")
# Tri : colonnes simples séparées par des virgules, « nulls first / last » facultatif. Rien d'autre n'entre dans le SQL.
_ORDRE = re.compile(r"^[a-z][a-z0-9_]*( nulls (first|last))?(, [a-z][a-z0-9_]*( nulls (first|last))?)*$")

# Un lecteur rend {cle_mart: [lignes]} ; les clés des lignes sont en minuscules.
Lecteur = Callable[[], dict[str, list[dict[str, Any]]]]


def _identifiant(valeur: str) -> str:
    valeur = valeur.upper()
    if not _IDENTIFIANT.match(valeur):
        raise ValueError(f"identifiant Snowflake refusé : {valeur!r}")
    return valeur


def _ordre(valeur: str) -> str:
    if not _ORDRE.match(valeur):
        raise ValueError(f"tri Snowflake refusé : {valeur!r}")
    return valeur


def requete_lecture(base: str, schema: str, table: str, ordre: str) -> str:
    """Seule requête envoyée à Snowflake. Aucune valeur n'y entre : seulement des identifiants du registre
    (api/marts.py) et de la configuration, chacun vérifié par une liste blanche de caractères."""
    return f'select * from "{_identifiant(base)}"."{_identifiant(schema)}"."{_identifiant(table)}" order by {_ordre(ordre)}'


def _connexion(p: Parametres):
    # Avertissements du connecteur sans effet (keep-alive, proxy) : masqués pour garder une console lisible.
    warnings.filterwarnings("ignore", category=FutureWarning, module=r"snowflake\..*")
    logging.getLogger("snowflake").setLevel(logging.ERROR)
    import snowflake.connector

    if not (p.snowflake_account and p.snowflake_user):
        raise RuntimeError("SNOWFLAKE_ACCOUNT et SNOWFLAKE_USER doivent être renseignés (fichier .env)")
    return snowflake.connector.connect(
        account=p.snowflake_account,
        user=p.snowflake_user,
        password=p.snowflake_password.get_secret_value(),
        role=p.snowflake_role,
        warehouse=p.snowflake_warehouse,
        database=p.snowflake_database,
        login_timeout=30,
        network_timeout=180,
        application="saltis-api",
    )


def creer_lecteur(p: Parametres, tables: dict[str, tuple[str, str, str, bool]]) -> Lecteur:
    """`tables` : {cle: (nom_table, order_by, schema, obligatoire)}, schema = "marts" ou "ml".
    Les noms viennent du registre, jamais d'une requête HTTP.
    Une table facultative illisible (pas encore chargée, droits manquants) est simplement absente du résultat."""

    def lire() -> dict[str, list[dict[str, Any]]]:
        from snowflake.connector import DictCursor
        from snowflake.connector.errors import ProgrammingError

        base = _identifiant(p.snowflake_database)
        schemas = {"marts": _identifiant(p.snowflake_schema_marts), "ml": _identifiant(p.snowflake_schema_ml)}
        resultat: dict[str, list[dict[str, Any]]] = {}
        conn = _connexion(p)
        try:
            with conn.cursor(DictCursor) as cur:
                for cle, (table, ordre, famille, obligatoire) in tables.items():
                    schema = schemas[famille]
                    sql = requete_lecture(base, schema, table, ordre)
                    try:
                        cur.execute(sql)
                    except ProgrammingError as exc:
                        if obligatoire:
                            raise
                        log.warning("Snowflake %s.%s.%s facultatif non lu (%s) : routes correspondantes indisponibles",
                                    base, schema, table, exc.msg)
                        continue
                    lignes = cur.fetchall()
                    resultat[cle] = [{k.lower(): v for k, v in ligne.items()} for ligne in lignes]
                    log.info("Snowflake %s.%s.%s : %d lignes", base, schema, table, len(lignes))
        finally:
            conn.close()

        # Résultats des modèles absents ou vides dans SALTIS.ML : lus dans ml/sorties/*.csv.
        manquants = {cle for cle, (_, _, famille, _) in tables.items() if famille == "ml" and not resultat.get(cle)}
        if manquants and resultat.get("vulnerabilite"):
            resultat.update(lire_resultats_ml(manquants, resultat["vulnerabilite"]))
        return resultat

    return lire


def tester_connexion(p: Parametres) -> bool:
    conn = _connexion(p)
    try:
        with conn.cursor() as cur:
            cur.execute("select 1")
            return cur.fetchone()[0] == 1
    finally:
        conn.close()
