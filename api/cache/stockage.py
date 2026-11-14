"""Stockage des versions du cache : Redis (normal) ou mémoire du processus (repli).

Les deux stockages ont la même interface. Une version n'est visible qu'une fois entièrement écrite :
la bascule de `version_active` est la dernière opération, atomique.
"""

import logging
from abc import ABC, abstractmethod

from redis.asyncio import Redis

from .cles import SUFFIXE_GZIP

log = logging.getLogger(__name__)

TAILLE_LOT = 2000


class Stockage(ABC):
    mode: str

    @abstractmethod
    async def ping(self) -> bool: ...

    @abstractmethod
    async def version_active(self) -> str | None: ...

    @abstractmethod
    async def lire(self, version: str, cle: str) -> tuple[bytes, bool] | None:
        """Rend (contenu, est_compresse_gzip) ou None si la clé n'existe pas dans cette version."""

    @abstractmethod
    async def lire_meta(self, version: str, nom: str) -> bytes | None:
        """`nom` : `info` ou `index`."""

    @abstractmethod
    async def ecrire_meta(self, version: str, nom: str, contenu: bytes) -> None: ...

    @abstractmethod
    async def versions(self) -> list[str]: ...

    @abstractmethod
    async def publier(self, version: str, reponses: dict[str, bytes], info: bytes, index: bytes) -> None: ...

    @abstractmethod
    async def activer(self, version: str) -> bool: ...

    @abstractmethod
    async def verrouiller(self, jeton: str, duree_s: int) -> bool: ...

    @abstractmethod
    async def deverrouiller(self, jeton: str) -> None: ...

    async def fermer(self) -> None:
        return None


class StockageRedis(Stockage):
    mode = "redis"

    def __init__(self, client: Redis, prefixe: str = "saltis", versions_conservees: int = 2):
        self.client = client
        self.p = prefixe
        self.versions_conservees = versions_conservees

    @classmethod
    def depuis_url(cls, url: str, prefixe: str, versions_conservees: int) -> "StockageRedis":
        client = Redis.from_url(
            url, decode_responses=False, socket_connect_timeout=2, socket_timeout=5, health_check_interval=30, max_connections=64
        )
        return cls(client, prefixe, versions_conservees)

    def _k(self, *parties: str) -> str:
        return ":".join((self.p, *parties))

    def _reponse(self, version: str, cle: str) -> str:
        return f"{self.p}:{version}:r:{cle}"

    async def ping(self) -> bool:
        return bool(await self.client.ping())

    async def version_active(self) -> str | None:
        v = await self.client.get(self._k("version_active"))
        return v.decode() if v else None

    async def lire(self, version: str, cle: str) -> tuple[bytes, bool] | None:
        base = self._reponse(version, cle)
        compresse, brut = await self.client.mget(base + SUFFIXE_GZIP, base)  # un seul aller-retour
        if compresse is not None:
            return compresse, True
        return (brut, False) if brut is not None else None

    async def lire_meta(self, version: str, nom: str) -> bytes | None:
        return await self.client.get(self._k(version, nom))

    async def ecrire_meta(self, version: str, nom: str, contenu: bytes) -> None:
        await self.client.set(self._k(version, nom), contenu)

    async def versions(self) -> list[str]:
        return [v.decode() for v in await self.client.lrange(self._k("versions"), 0, -1)]

    async def publier(self, version: str, reponses: dict[str, bytes], info: bytes, index: bytes) -> None:
        pipe = self.client.pipeline(transaction=False)
        for i, (cle, contenu) in enumerate(reponses.items(), start=1):
            pipe.set(self._reponse(version, cle), contenu)
            if i % TAILLE_LOT == 0:
                await pipe.execute()
        pipe.set(self._k(version, "index"), index)
        pipe.set(self._k(version, "info"), info)
        await pipe.execute()
        await self._basculer(version)
        await self._elaguer()

    async def _basculer(self, version: str) -> None:
        async with self.client.pipeline(transaction=True) as tx:
            tx.lrem(self._k("versions"), 0, version)
            tx.lpush(self._k("versions"), version)
            tx.set(self._k("version_active"), version)
            await tx.execute()

    async def activer(self, version: str) -> bool:
        if not await self.client.exists(self._k(version, "info")):
            return False
        await self._basculer(version)
        return True

    async def _elaguer(self) -> None:
        versions = await self.versions()
        active = await self.version_active()
        for ancienne in versions[self.versions_conservees :]:
            if ancienne == active:
                continue
            nb = 0
            lot: list[bytes] = []
            async for cle in self.client.scan_iter(match=f"{self.p}:{ancienne}:*", count=1000):
                lot.append(cle)
                if len(lot) >= 1000:
                    nb += await self.client.unlink(*lot)
                    lot = []
            if lot:
                nb += await self.client.unlink(*lot)
            await self.client.lrem(self._k("versions"), 0, ancienne)
            log.info("Version %s supprimée du cache (%d clés)", ancienne, nb)

    async def verrouiller(self, jeton: str, duree_s: int) -> bool:
        return bool(await self.client.set(self._k("verrou"), jeton, nx=True, ex=duree_s))

    async def deverrouiller(self, jeton: str) -> None:
        if (await self.client.get(self._k("verrou"))) == jeton.encode():
            await self.client.delete(self._k("verrou"))

    async def fermer(self) -> None:
        await self.client.aclose()


class StockageMemoire(Stockage):
    """Repli quand Redis est injoignable : même comportement, limité au processus courant."""

    mode = "memoire"

    def __init__(self, versions_conservees: int = 2):
        self.versions_conservees = versions_conservees
        self._donnees: dict[str, dict[str, bytes]] = {}
        self._meta: dict[str, dict[str, bytes]] = {}
        self._versions: list[str] = []
        self._active: str | None = None
        self._jeton: str | None = None

    async def ping(self) -> bool:
        return True

    async def version_active(self) -> str | None:
        return self._active

    async def lire(self, version: str, cle: str) -> tuple[bytes, bool] | None:
        donnees = self._donnees.get(version, {})
        if (cle + SUFFIXE_GZIP) in donnees:
            return donnees[cle + SUFFIXE_GZIP], True
        return (donnees[cle], False) if cle in donnees else None

    async def lire_meta(self, version: str, nom: str) -> bytes | None:
        return self._meta.get(version, {}).get(nom)

    async def ecrire_meta(self, version: str, nom: str, contenu: bytes) -> None:
        self._meta.setdefault(version, {})[nom] = contenu

    async def versions(self) -> list[str]:
        return list(self._versions)

    async def publier(self, version: str, reponses: dict[str, bytes], info: bytes, index: bytes) -> None:
        self._donnees[version] = dict(reponses)
        self._meta[version] = {"info": info, "index": index}
        await self.activer(version)
        for ancienne in self._versions[self.versions_conservees :]:
            self._donnees.pop(ancienne, None)
            self._meta.pop(ancienne, None)
        self._versions = self._versions[: self.versions_conservees]

    async def activer(self, version: str) -> bool:
        if version not in self._meta:
            return False
        self._versions = [version] + [v for v in self._versions if v != version]
        self._active = version
        return True

    async def verrouiller(self, jeton: str, duree_s: int) -> bool:
        if self._jeton is not None:
            return False
        self._jeton = jeton
        return True

    async def deverrouiller(self, jeton: str) -> None:
        if self._jeton == jeton:
            self._jeton = None
