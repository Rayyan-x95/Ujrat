"""Application configuration and settings."""
import os
from typing import List
try:
    from dotenv import load_dotenv
    load_dotenv(".env")
    load_dotenv("../.env")
except ImportError:
    pass
from pydantic import BaseModel


class Settings(BaseModel):
    """Configuration loaded from environment variables."""
    PROJECT_NAME: str = "Ujrat Operations API"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Supabase credentials (checks VITE_* or standard prefixes)
    SUPABASE_URL: str = os.getenv("VITE_SUPABASE_URL", os.getenv("SUPABASE_URL", "http://localhost:54321"))
    SUPABASE_ANON_KEY: str = os.getenv("VITE_SUPABASE_ANON_KEY", os.getenv("SUPABASE_ANON_KEY", ""))
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "super-secret-jwt-token-with-at-least-32-characters")

    # Optional direct Postgres connection
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # CORS origins
    @classmethod
    def get_cors_origins(cls) -> List[str]:
        raw = os.getenv("CORS_ORIGINS")
        if not raw:
            return [
                "http://localhost:5173",
                "http://localhost:4173",
                "http://localhost:3000",
                "http://127.0.0.1:5173",
            ]
        try:
            import json
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    CORS_ORIGINS: List[str] = []

    def __init__(self, **data):
        super().__init__(**data)
        if not self.CORS_ORIGINS:
            self.CORS_ORIGINS = self.get_cors_origins()


settings = Settings()

