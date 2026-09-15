from pathlib import Path
from urllib.parse import quote, urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), env_file_encoding="utf-8", extra="ignore")

    # Supabase
    supabase_url: str
    supabase_service_key: str

    # JWT
    jwt_secret: str
    jwt_expire_hours: int = 24

    # CORS — stored as a raw comma-separated string, exposed as a list via property
    allowed_origins: str = "http://localhost:8081"

    # Rate limiting — Upstash Redis (preferred)
    upstash_redis_rest_url: str | None = None
    upstash_redis_rest_token: str | None = None

    # App
    env: str = "development"
    log_level: str = "INFO"

    # Google OAuth (identity provider) — audience for token verification
    google_client_id: str | None = None

    # Bootstrap admins — comma-separated emails auto-promoted to role='admin' on sign-in
    admin_emails: str = ""

    # Supabase Storage bucket for STL uploads + model previews
    storage_bucket: str = "models"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def admin_emails_list(self) -> list[str]:
        return [e.strip().lower() for e in self.admin_emails.split(",") if e.strip()]

    @property
    def is_production(self) -> bool:
        return self.env.lower() == "production"

    @property
    def rate_limit_storage_uri(self) -> str:
        if self.upstash_redis_rest_url and self.upstash_redis_rest_token:
            host = urlparse(self.upstash_redis_rest_url).hostname
            token = quote(self.upstash_redis_rest_token, safe="")
            return f"rediss://default:{token}@{host}:6379"
        return "memory://"


settings = Settings()  # type: ignore[call-arg]


# ---------------------------------------------------------------------------
# 3D-printing domain constants
# ---------------------------------------------------------------------------
# Build volume of the Bambu Lab A1 (the reference printer). Customisations may
# not exceed the print plate footprint or the maximum print height.
BUILD_PLATE_WIDTH_MM = 256.0
BUILD_PLATE_DEPTH_MM = 256.0
MAX_HEIGHT_MM = 256.0

# A1 + AMS lite supports up to 4 filament colors in a single print.
MAX_COLORS = 4

# Default filament density (PLA) used to estimate weight from STL volume.
DEFAULT_FILAMENT_DENSITY_G_PER_CM3 = 1.24
