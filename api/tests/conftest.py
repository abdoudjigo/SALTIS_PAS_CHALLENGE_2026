import asyncio

import pytest
from fastapi.testclient import TestClient

from api.cache import ServiceCache, StockageMemoire
from api.config import Parametres
from api.main import creer_app

from .donnees_test import marts_synthetiques

JETON = "jeton-de-test"


def parametres_test(**autres) -> Parametres:
    valeurs = dict(api_admin_token=JETON, prechargement_au_demarrage=False, redis_url="redis://127.0.0.1:1/0", cache_ttl_version_s=0,
                   voix_questions=True)  # les tests couvrent aussi les routes de questions, coupées par défaut en production
    valeurs.update(autres)
    return Parametres(_env_file=None, **valeurs)


def service_test(p: Parametres | None = None, lecteur=marts_synthetiques, stockage=None) -> ServiceCache:
    p = p or parametres_test()
    return ServiceCache(p, lecteur, stockage or StockageMemoire(p.cache_versions_conservees))


@pytest.fixture
def service() -> ServiceCache:
    s = service_test()
    asyncio.run(s.precharger("test"))
    return s


@pytest.fixture
def client(service):
    with TestClient(creer_app(service.p, service)) as c:
        yield c


@pytest.fixture
def client_vide():
    s = service_test()
    with TestClient(creer_app(s.p, s)) as c:
        yield c
