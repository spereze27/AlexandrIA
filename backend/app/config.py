"""Application settings loaded from environment variables / Secret Manager."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All config is injected via Cloud Run env vars (from Secret Manager or Terraform)"""

    # ── Environment ──
    environment: str = "dev"
    debug: bool = False

    # ── Database (Cloud SQL via unix socket) ──
    db_host: str = "/cloudsql/project:region:instance"
    db_name: str = "formbuilder"
    db_user: str = "formbuilder_app"
    db_password: str = ""
    db_pool_size: int = 5
    db_max_overflow: int = 10

    @property
    def database_url(self) -> str:
        """Build async SQLAlchemy connection string for Cloud SQL unix socket."""
        if self.db_host.startswith("/cloudsql/"):
            # Cloud Run: connect via unix socket
            return (
                f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
                f"@/{self.db_name}?host={self.db_host}"
            )
        # Local dev: connect via TCP
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}/{self.db_name}"
        )

    # ── Gemini (LangGraph Agent) ──
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # ── Google OAuth ──
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""

    # ── JWT ──
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # ── Google Sheets ──
    google_sheets_sa_key: str = ""  # Base64-encoded service account JSON

    # ── Cloud Storage ──
    gcs_bucket_name: str = "formbuilder-media"

    # ── CORS ──
    frontend_url: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
