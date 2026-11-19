"""Paramètres de l'API, lus dans les variables d'environnement ou dans `.env`."""

from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Parametres(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Snowflake : mêmes variables que dbt. Les marts sont lus dans <database>.<schema_marts>.
    snowflake_account: str = ""
    snowflake_user: str = ""
    snowflake_password: SecretStr = SecretStr("")
    snowflake_role: str = "SYSADMIN"
    snowflake_warehouse: str = "SALTIS_WH"
    snowflake_database: str = "SALTIS"
    snowflake_schema_marts: str = "MARTS"
    # Résultats des modèles d'IA (ml/), chargés par ml/charger_snowflake.py. Facultatifs : absents, l'API sert les marts seuls.
    snowflake_schema_ml: str = "ML"

    # IA vocale (wolof) : Space Hugging Face voix/space/ (ex. « akai/assaman-suuf-voix ») ; vide = voix wolof désactivée
    voix_space: str = ""
    hf_token: SecretStr = SecretStr("")

    # Serveur (python -m api)
    api_host: str = "127.0.0.1"
    api_port: int = 8080

    # Redis, optionnel : vide = cache en mémoire, rechargé depuis Snowflake à chaque démarrage.
    redis_url: str = ""
    redis_prefixe: str = "saltis"
    cache_versions_conservees: int = Field(2, ge=1, description="Version active + versions précédentes gardées pour le retour arrière")
    cache_ttl_version_s: float = Field(2.0, ge=0, description="Durée pendant laquelle un worker garde en mémoire le nom de la version active")
    cache_duree_verrou_s: int = Field(900, ge=30)
    prechargement_au_demarrage: bool = True

    # HTTP
    api_admin_token: SecretStr = SecretStr("")
    # CORS : « * » pour le développement ; en production le site et l'API ont la même origine (docker-compose.prod.yml : []).
    cors_origines: list[str] = ["*"]
    http_max_age_s: int = 60
    # Documentation interactive (/docs, /redoc, /openapi.json) : coupée en production (API_DOCS=false)
    api_docs: bool = True

    # Sécurité : débit par adresse IP et par minute (0 = sans limite), taille des corps JSON
    limite_requetes_par_minute: int = Field(1200, ge=0)
    limite_voix_texte_par_minute: int = Field(60, ge=0)
    limite_voix_synthese_par_minute: int = Field(20, ge=0, description="Reconnaissance et synthèse vocales (coûteuses)")
    limite_admin_par_minute: int = Field(10, ge=0)
    taille_max_json_octets: int = Field(64 * 1024, ge=1024)

    # Avis ONG envoyés par e-mail (POST /avis). Une variable vide = envoi indisponible (503), l'API continue.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: SecretStr = SecretStr("")
    avis_destinataire: str = ""
    voix_cache_max_fichiers: int = Field(400, ge=0, description="Voix gardées sur disque (au-delà, la voix n'est plus enregistrée)")


@lru_cache
def parametres() -> Parametres:
    return Parametres()
