"""Service de cache : version active, préchargement depuis Snowflake, repli mémoire, retour arrière."""

import asyncio
import logging
import time
from datetime import datetime, timezone
from uuid import uuid4

from redis.exceptions import RedisError

from ..config import Parametres
from ..schemas import EtatCache, InfoVersion
from ..source_snowflake import Lecteur
from .construction import ErreurContrat, Index, construire, valider
from .stockage import Stockage, StockageMemoire, StockageRedis

log = logging.getLogger(__name__)


class CacheIndisponible(Exception):
    """Aucune version prête à servir (préchargement en cours, Redis injoignable…)."""


class PrechargementEnCours(Exception):
    pass


def nouvelle_version(instant: datetime) -> str:
    return f"v{instant:%Y%m%dT%H%M%S}{instant.microsecond // 1000:03d}Z"


class ServiceCache:
    def __init__(self, parametres: Parametres, lecteur: Lecteur, stockage: Stockage | None = None):
        self.p = parametres
        self.lecteur = lecteur
        self.stockage: Stockage | None = stockage
        self.statut = "vide"
        self.derniere_erreur: str | None = None
        self._version: str | None = None
        self._index: Index | None = None
        self._vu_a = 0.0
        self._tache: asyncio.Task | None = None

    # ------------------------------------------------------------ cycle de vie

    async def demarrer(self) -> None:
        if self.stockage is None:
            redis = await self._connecter_redis() if self.p.redis_url else None
            self.stockage = redis or StockageMemoire(self.p.cache_versions_conservees)
        try:
            version = await self._version_courante(force=True)
        except RedisError as exc:
            await self._basculer_memoire(exc)
            return
        if version:
            log.info("Cache prêt sans appel à Snowflake : version %s (%s)", version, self.stockage.mode)
        elif not self.p.prechargement_au_demarrage:
            return
        elif isinstance(self.stockage, StockageMemoire):
            # Mode simple : le serveur n'accepte les requêtes qu'une fois les marts chargés.
            log.info("Chargement des marts depuis Snowflake (environ 15 s)…")
            try:
                await self.precharger("demarrage")
            except Exception:  # noqa: BLE001 - l'API démarre quand même et répond 503 avec l'erreur
                log.exception("Chargement des marts en échec : les routes de données répondront 503")
        else:
            self.lancer_prechargement("demarrage")

    async def arreter(self) -> None:
        if self._tache and not self._tache.done():
            self._tache.cancel()
        if self.stockage:
            await self.stockage.fermer()

    async def _connecter_redis(self) -> StockageRedis | None:
        redis = StockageRedis.depuis_url(self.p.redis_url, self.p.redis_prefixe, self.p.cache_versions_conservees)
        try:
            await redis.ping()
            log.info("Redis joignable : %s", self.p.redis_url.split("@")[-1])
            return redis
        except (RedisError, OSError) as exc:
            log.warning("Redis injoignable (%s) : repli sur le cache mémoire du processus", exc)
            await redis.fermer()
            return None

    async def _basculer_memoire(self, exc: Exception) -> None:
        if isinstance(self.stockage, StockageMemoire):
            return
        log.error("Redis en erreur (%s) : bascule sur le cache mémoire et préchargement", exc)
        if self.stockage:
            try:
                await self.stockage.fermer()
            except Exception:  # noqa: BLE001 - la connexion est déjà perdue
                pass
        self.stockage = StockageMemoire(self.p.cache_versions_conservees)
        self._version, self._index, self.statut = None, None, "vide"
        self.lancer_prechargement("repli_memoire")

    async def reessayer_redis(self) -> bool:
        """Revient sur Redis s'il est de nouveau joignable. Rend vrai si le mode a changé."""
        if isinstance(self.stockage, StockageRedis) or not self.p.redis_url:
            return False
        redis = await self._connecter_redis()
        if not redis:
            return False
        self.stockage = redis
        self._version, self._index = None, None
        await self._version_courante(force=True)
        return True

    # ------------------------------------------------------------ lecture

    async def _version_courante(self, force: bool = False) -> str | None:
        maintenant = time.monotonic()
        if not force and self._version and maintenant - self._vu_a < self.p.cache_ttl_version_s:
            return self._version
        version = await self.stockage.version_active()
        if version != self._version:
            index = await self.stockage.lire_meta(version, "index") if version else None
            self._index = Index.model_validate_json(index) if index else None
            self._version = version if self._index else None
        self._vu_a = maintenant
        if self._version and self.statut in ("vide", "erreur"):
            self.statut = "pret"
        return self._version

    async def etat_actif(self) -> tuple[str, Index]:
        try:
            version = await self._version_courante()
        except RedisError as exc:
            await self._basculer_memoire(exc)
            raise CacheIndisponible("Redis injoignable : cache mémoire en cours de préparation") from None
        if not version or not self._index:
            raise CacheIndisponible(
                "Préchargement des marts en cours" if self.statut == "en_preparation" else "Cache vide : aucun préchargement réussi"
            )
        return version, self._index

    async def lire(self, version: str, cle: str) -> tuple[bytes, bool, str] | None:
        try:
            trouve = await self.stockage.lire(version, cle)
            if trouve is None:
                # La version a pu être remplacée entre-temps par un autre worker : on relit une fois.
                actuelle = await self._version_courante(force=True)
                if actuelle and actuelle != version:
                    trouve = await self.stockage.lire(actuelle, cle)
                    version = actuelle
            return (trouve[0], trouve[1], version) if trouve else None
        except RedisError as exc:
            await self._basculer_memoire(exc)
            raise CacheIndisponible("Redis injoignable : cache mémoire en cours de préparation") from None

    # ------------------------------------------------------------ préchargement

    def prechargement_en_cours(self) -> bool:
        return self._tache is not None and not self._tache.done()

    def lancer_prechargement(self, declencheur: str) -> bool:
        if self.prechargement_en_cours():
            return False
        if not self._version:
            self.statut = "en_preparation"

        async def executer():
            try:
                await self.precharger(declencheur)
            except PrechargementEnCours:
                log.info("Préchargement déjà mené par un autre processus")
            except Exception:  # noqa: BLE001 - l'erreur est conservée dans derniere_erreur
                log.exception("Préchargement en échec")

        self._tache = asyncio.create_task(executer(), name=f"prechargement-{declencheur}")
        return True

    async def precharger(self, declencheur: str) -> InfoVersion:
        jeton = uuid4().hex
        if not await self.stockage.verrouiller(jeton, self.p.cache_duree_verrou_s):
            raise PrechargementEnCours()
        try:
            t0 = time.perf_counter()
            bruts = await asyncio.to_thread(self.lecteur)
            t1 = time.perf_counter()
            valides, ignorees = await asyncio.to_thread(valider, bruts)
            genere_le = datetime.now(timezone.utc)
            version = nouvelle_version(genere_le)
            prefixe = f"{self.p.snowflake_database}.{self.p.snowflake_schema_marts}".upper()
            prefixe_ml = f"{self.p.snowflake_database}.{self.p.snowflake_schema_ml}".upper()
            construction = await asyncio.to_thread(construire, valides, version, genere_le, prefixe, prefixe_ml)
            t2 = time.perf_counter()
            info = InfoVersion(
                version=version,
                genere_le=genere_le,
                declencheur=declencheur,
                source=prefixe,
                lignes_par_mart={cle: len(lignes) for cle, lignes in valides.items()},
                colonnes_ignorees=ignorees,
                nb_cles=construction.nb_cles,
                taille_octets=construction.taille_octets,
                taille_stockee_octets=construction.taille_stockee_octets,
                duree_lecture_s=round(t1 - t0, 3),
                duree_construction_s=round(t2 - t1, 3),
                duree_publication_s=0.0,
            )
            await self.stockage.publier(
                version, construction.reponses, info.model_dump_json().encode(), construction.index.model_dump_json().encode()
            )
            info.duree_publication_s = round(time.perf_counter() - t2, 3)
            await self.stockage.ecrire_meta(version, "info", info.model_dump_json().encode())
            await self._version_courante(force=True)
            self.statut, self.derniere_erreur = "pret", None
            if ignorees:
                log.warning("Colonnes hors contrat ignorées : %s", ignorees)
            log.info(
                "Version %s publiée (%s) : %d réponses, %.1f Mo, lecture %.1fs, construction %.1fs, publication %.1fs",
                version, self.stockage.mode, info.nb_cles, info.taille_octets / 1e6,
                info.duree_lecture_s, info.duree_construction_s, info.duree_publication_s,
            )
            return info
        except Exception as exc:
            # Message limité : pas de détail de connexion exposé par /systeme/cache.
            self.derniere_erreur = str(exc) if isinstance(exc, ErreurContrat) else type(exc).__name__
            self.statut = "pret" if self._version else "erreur"
            raise
        finally:
            await self.stockage.deverrouiller(jeton)

    # ------------------------------------------------------------ administration

    async def retour_arriere(self) -> str | None:
        versions = await self.stockage.versions()
        active = await self.stockage.version_active()
        precedentes = versions[versions.index(active) + 1 :] if active in versions else []
        if not precedentes or not await self.stockage.activer(precedentes[0]):
            return None
        await self._version_courante(force=True)
        return precedentes[0]

    async def etat(self) -> EtatCache:
        info, versions = None, []
        try:
            version = await self._version_courante(force=True)
            versions = await self.stockage.versions()
            brut = await self.stockage.lire_meta(version, "info") if version else None
            info = InfoVersion.model_validate_json(brut) if brut else None
        except RedisError as exc:
            await self._basculer_memoire(exc)
            version = None
        return EtatCache(
            mode=self.stockage.mode,
            statut="en_preparation" if self.prechargement_en_cours() and not version else self.statut,
            version_active=version,
            versions_conservees=versions,
            info=info,
            derniere_erreur=self.derniere_erreur,
        )
