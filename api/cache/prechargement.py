"""Préchargement en ligne de commande, à lancer après chaque `dbt build`.

    python -m api.cache.prechargement             lit les marts et publie une nouvelle version dans Redis (si REDIS_URL est défini)
    python -m api.cache.prechargement --verifier  lit, valide et construit sans rien publier
"""

import argparse
import asyncio
import logging
import sys
import time
from datetime import datetime, timezone

from ..config import parametres
from ..marts import tables_a_lire
from ..source_snowflake import creer_lecteur
from .construction import construire, valider
from .service import ServiceCache, nouvelle_version
from .stockage import StockageRedis


async def _verifier() -> int:
    p = parametres()
    t0 = time.perf_counter()
    bruts = creer_lecteur(p, tables_a_lire())()
    valides, ignorees = valider(bruts)
    maintenant = datetime.now(timezone.utc)
    c = construire(valides, nouvelle_version(maintenant), maintenant, f"{p.snowflake_database}.{p.snowflake_schema_marts}",
                   f"{p.snowflake_database}.{p.snowflake_schema_ml}".upper())
    print(f"Contrat respecté : {', '.join(f'{k}={len(v)}' for k, v in valides.items())}")
    if ignorees:
        print(f"Colonnes hors contrat (ignorées) : {ignorees}")
    print(
        f"{c.nb_cles} réponses, {c.taille_octets / 1e6:.1f} Mo ({c.taille_stockee_octets / 1e6:.1f} Mo stockés dans Redis), "
        f"{time.perf_counter() - t0:.1f} s. Rien n'a été publié."
    )
    return 0


async def _publier() -> int:
    p = parametres()
    if not p.redis_url:
        print("Pas de Redis configuré (REDIS_URL vide) : rien à publier. L'API recharge les marts toute seule à chaque\n"
              "démarrage (python -m api). Pour seulement vérifier les marts : python -m api.cache.prechargement --verifier")
        return 0
    stockage = StockageRedis.depuis_url(p.redis_url, p.redis_prefixe, p.cache_versions_conservees)
    try:
        await stockage.ping()
    except Exception as exc:  # noqa: BLE001
        print(f"Redis injoignable ({p.redis_url.split('@')[-1]}) : {exc}", file=sys.stderr)
        return 2
    try:
        info = await ServiceCache(p, creer_lecteur(p, tables_a_lire()), stockage).precharger("cli")
    finally:
        await stockage.fermer()
    print(
        f"Version {info.version} active : {info.nb_cles} réponses, {info.taille_octets / 1e6:.1f} Mo "
        f"(lecture {info.duree_lecture_s} s, construction {info.duree_construction_s} s, publication {info.duree_publication_s} s)"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--verifier", action="store_true", help="lire, valider et construire sans publier")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s : %(message)s")
    logging.getLogger("snowflake").setLevel(logging.ERROR)
    return asyncio.run(_verifier() if args.verifier else _publier())


if __name__ == "__main__":
    sys.exit(main())
