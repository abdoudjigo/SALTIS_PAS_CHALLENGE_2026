"""Durcissement HTTP : limitation de débit par adresse IP, taille maximale des requêtes, en-têtes de sécurité.

La limitation est en mémoire, par processus : l'API de production tourne avec un seul worker (deploy/Dockerfile.api).
Derrière Caddy, l'adresse du client vient de X-Forwarded-For (uvicorn --proxy-headers).
"""

import time
from collections import OrderedDict, deque

from fastapi import Request

from .erreurs import ErreurApi

ENTETES_SECURITE = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}
MAX_ADRESSES = 20_000  # borne la mémoire : au-delà, les adresses les plus anciennes sont oubliées


class LimiteDebit:
    """Fenêtre glissante : au plus `maxi` appels par `fenetre_s` secondes et par adresse. `maxi` ≤ 0 = sans limite."""

    def __init__(self, maxi: int, fenetre_s: float = 60.0):
        self.maxi, self.fenetre_s = maxi, fenetre_s
        self._appels: OrderedDict[str, deque[float]] = OrderedDict()

    def attente(self, adresse: str) -> int:
        """Enregistre un appel ; rend 0 s'il est accepté, sinon le nombre de secondes à attendre."""
        if self.maxi <= 0:
            return 0
        maintenant = time.monotonic()
        appels = self._appels.setdefault(adresse, deque())
        self._appels.move_to_end(adresse)
        while appels and maintenant - appels[0] >= self.fenetre_s:
            appels.popleft()
        if len(appels) >= self.maxi:
            return max(1, int(self.fenetre_s - (maintenant - appels[0])) + 1)
        appels.append(maintenant)
        while len(self._appels) > MAX_ADRESSES:
            self._appels.popitem(last=False)
        return 0


def adresse_client(request: Request) -> str:
    return request.client.host if request.client else "inconnue"


def trop_de_requetes(attente: int) -> ErreurApi:
    return ErreurApi(429, "trop_de_requetes", "Trop de requêtes depuis cette adresse. Réessayez dans un instant.",
                     f"Réessayer dans {attente} s", {"Retry-After": str(attente)})


def limiter(request: Request, famille: str) -> None:
    """Applique la limite `famille` (voir `creer_limites`) à l'adresse du client ; lève 429 au-delà."""
    attente = request.app.state.limites[famille].attente(adresse_client(request))
    if attente:
        raise trop_de_requetes(attente)


def creer_limites(p) -> dict[str, LimiteDebit]:
    return {
        "global": LimiteDebit(p.limite_requetes_par_minute),
        "voix_texte": LimiteDebit(p.limite_voix_texte_par_minute),
        "voix_synthese": LimiteDebit(p.limite_voix_synthese_par_minute),
        "voix_francais": LimiteDebit(p.limite_voix_francais_par_minute),
        "llm": LimiteDebit(p.limite_llm_par_minute),
        "admin": LimiteDebit(p.limite_admin_par_minute),
        "avis": LimiteDebit(5, 600),  # avis ONG : 5 envois par adresse et par 10 minutes
    }


async def lire_corps(request: Request, maxi: int, erreur: ErreurApi) -> bytes:
    """Lit le corps sans jamais garder plus de `maxi` octets en mémoire (Content-Length annoncé ou flux)."""
    annonce = request.headers.get("content-length", "")
    if annonce.isdigit() and int(annonce) > maxi:
        raise erreur
    morceaux, total = [], 0
    async for morceau in request.stream():
        total += len(morceau)
        if total > maxi:
            raise erreur
        morceaux.append(morceau)
    return b"".join(morceaux)
