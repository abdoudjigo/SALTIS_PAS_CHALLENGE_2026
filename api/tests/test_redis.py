"""Stockage Redis (simulé par fakeredis) : publication, bascule atomique, élagage, verrou, repli mémoire."""

import asyncio

import fakeredis
import pytest

from api.cache import CacheIndisponible, StockageMemoire, StockageRedis
from api.cache.cles import SUFFIXE_GZIP

from .conftest import parametres_test, service_test


def _redis(versions=2):
    serveur = fakeredis.FakeServer()
    return serveur, StockageRedis(fakeredis.FakeAsyncRedis(server=serveur), "saltis", versions)


def test_publication_bascule_et_elagage():
    async def scenario():
        _, s = _redis(versions=2)
        for v in ("v1", "v2", "v3"):
            await s.publier(v, {"a": b"petit", "b" + SUFFIXE_GZIP: b"gz"}, b"{}", b"{}")
        assert await s.version_active() == "v3"
        assert await s.versions() == ["v3", "v2"]
        assert await s.lire("v3", "a") == (b"petit", False)
        assert await s.lire("v3", "b") == (b"gz", True)
        assert await s.lire("v1", "a") is None  # v1 supprimée
        assert not [k async for k in s.client.scan_iter(match="saltis:v1:*")]
        assert await s.activer("v2") and await s.version_active() == "v2"
        assert not await s.activer("v1")

    asyncio.run(scenario())


def test_verrou_exclusif():
    async def scenario():
        _, s = _redis()
        assert await s.verrouiller("a", 60)
        assert not await s.verrouiller("b", 60)
        await s.deverrouiller("b")  # pas le bon jeton : verrou conservé
        assert not await s.verrouiller("b", 60)
        await s.deverrouiller("a")
        assert await s.verrouiller("b", 60)

    asyncio.run(scenario())


def test_service_complet_sur_redis():
    async def scenario():
        _, s = _redis()
        service = service_test(stockage=s)
        info = await service.precharger("test")
        version, index = await service.etat_actif()
        assert version == info.version and "SEN.7.1_1" in index.departements
        contenu, compresse, servie = await service.lire(version, "suivi:SEN.7.1_1:2024")
        assert compresse and servie == version
        # Un second worker qui démarre trouve le cache sans relire Snowflake.
        autre = service_test(stockage=s, lecteur=lambda: pytest.fail("Snowflake ne doit pas être relu"))
        await autre.demarrer()
        assert (await autre.etat_actif())[0] == version

    asyncio.run(scenario())


def test_repli_memoire_si_redis_tombe():
    async def scenario():
        serveur, s = _redis()
        service = service_test(parametres_test(), stockage=s)
        await service.precharger("test")
        serveur.connected = False
        with pytest.raises(CacheIndisponible):
            await service.etat_actif()
        assert isinstance(service.stockage, StockageMemoire)
        await service._tache  # préchargement en mémoire lancé automatiquement
        version, _ = await service.etat_actif()
        assert version and service.stockage.mode == "memoire"

    asyncio.run(scenario())


def test_prechargement_concurrent_refuse():
    async def scenario():
        _, s = _redis()
        await s.verrouiller("autre-processus", 60)
        from api.cache import PrechargementEnCours

        with pytest.raises(PrechargementEnCours):
            await service_test(stockage=s).precharger("test")

    asyncio.run(scenario())
