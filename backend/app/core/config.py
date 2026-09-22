"""App configuration - validated via Pydantic. No secrets in git."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    api_v1_prefix: str = "/api/v1"
    # 5173 = tenant PWA, 5174 = platform admin console.
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174", "https://frontend-eight-mu-71.vercel.app",]
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    database_url: str = ""
    # App-specific signing only. Never used for Supabase Auth verification.
    jwt_secret: str = "change-me"
    log_level: str = "INFO"
    jwks_cache_ttl_seconds: int = 600
    jwks_timeout_seconds: float = 5.0
    # Resolved user-context (profile/org/stores) cache. Short: only skips
    # repeated auth lookups; JWT itself is verified on every request.
    user_context_ttl_seconds: int = 45
    # Platform admins (SaaS operators): comma-separated login emails.
    # Tenant access by admins is audited. Empty = no platform admin.
    platform_admin_emails: str = ""
    # Billing provider webhook verification ("manual" disables provider checks).
    billing_provider: str = "manual"
    billing_webhook_secret: str = ""

    @property
    def platform_admins(self) -> set[str]:
        return {e.strip().lower() for e in self.platform_admin_emails.split(",") if e.strip()}

    @property
    def is_dev(self) -> bool:
        return self.env == "development"

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    def check_supabase(self) -> None:
        if not self.supabase_url or not self.supabase_anon_key:
            raise RuntimeError(
                "SUPABASE_URL / SUPABASE_ANON_KEY missing. "
                "Copy backend/.env.example to backend/.env"
            )


settings = Settings()
