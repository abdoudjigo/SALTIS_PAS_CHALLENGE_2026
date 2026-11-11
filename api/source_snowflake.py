"""Lecture des marts dans Snowflake (lecture seule).

Snowflake n'est appelé qu'au préchargement du cache, jamais pendant une requête HTTP.
"""

import logging
import re
import warnings
from typing import Any, Callable

from .config import Parametres

log = logging.getLogger(__name__)

_IDENTIFIANT = re.compile(r"^[A-Z][A-Z0-9_]*$")

# Un lecteur rend {cle_mart: [lignes]} ; les clés des lignes sont en minuscules.
Lecteur = Callable[[], dict[str, list[dict[str, Any]]]]


def _identifiant(valeur: str) -> str:
    valeur = valeur.upper()
    if not _IDENTIFIANT.match(valeur):
        raise ValueError(f"identifiant Snowflake refusé : {valeur!r}")
    return valeur


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


def creer_lecteur(p: Parametres, tables: dict[str, tuple[str, str]]) -> Lecteur:
    """`tables` : {cle_mart: (nom_table, order_by)}. Les noms viennent du registre, jamais d'une requête HTTP."""

    def lire() -> dict[str, list[dict[str, Any]]]:
        from snowflake.connector import DictCursor

        base = _identifiant(p.snowflake_database)
        schema = _identifiant(p.snowflake_schema_marts)
        resultat: dict[str, list[dict[str, Any]]] = {}
        conn = _connexion(p)
        try:
            with conn.cursor(DictCursor) as cur:
                for cle, (table, ordre) in tables.items():
                    sql = f'select * from "{base}"."{schema}"."{_identifiant(table)}" order by {ordre}'
                    cur.execute(sql)
                    lignes = cur.fetchall()
                    resultat[cle] = [{k.lower(): v for k, v in ligne.items()} for ligne in lignes]
                    log.info("Snowflake %s.%s.%s : %d lignes", base, schema, table, len(lignes))
        finally:
            conn.close()
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
