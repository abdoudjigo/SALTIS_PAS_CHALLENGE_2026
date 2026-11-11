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
    cors_origines: list[str] = ["*"]
    http_max_age_s: int = 60


@lru_cache
def parametres() -> Parametres:
    return Parametres()
