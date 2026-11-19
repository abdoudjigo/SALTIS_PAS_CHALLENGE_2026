"""Lancement de l'API en une commande.

    python -m api                 http://127.0.0.1:8080/docs
    python -m api --port 8081     sur un autre port
    python -m api --reload        redémarre à chaque modification du code (recharge aussi les marts)

Arrêt : Ctrl + C dans le terminal.
"""

import argparse
import socket
import sys

import uvicorn

from .config import parametres


def port_occupe(hote: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1" if hote == "0.0.0.0" else hote, port)) == 0


def main() -> int:
    p = parametres()
    parser = argparse.ArgumentParser(prog="python -m api", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=p.api_port, help=f"port d'écoute (défaut : {p.api_port})")
    parser.add_argument("--host", default=p.api_host, help=f"adresse d'écoute (défaut : {p.api_host} ; 0.0.0.0 = accessible du réseau)")
    parser.add_argument("--reload", action="store_true", help="redémarrer à chaque modification du code")
    args = parser.parse_args()

    if port_occupe(args.host, args.port):
        print(
            f"\n  Le port {args.port} est déjà utilisé par un autre programme.\n"
            f"  Voir lequel     : ss -ltnp | grep :{args.port}\n"
            f"  Autre port      : python -m api --port {args.port + 1}\n",
            file=sys.stderr,
        )
        return 1

    cache = f"Redis ({p.redis_url.split('@')[-1]})" if p.redis_url else "mémoire (rechargé depuis Snowflake à chaque démarrage)"
    print(
        f"\n  API SALTIS — documentation : http://{'localhost' if args.host in ('127.0.0.1', '0.0.0.0') else args.host}:{args.port}/docs\n"
        f"  Cache : {cache}\n"
        f"  Arrêt : Ctrl + C\n",
        flush=True,
    )
    uvicorn.run("api.main:app", host=args.host, port=args.port, reload=args.reload, reload_dirs=["api"] if args.reload else None)
    return 0


if __name__ == "__main__":
    sys.exit(main())
