"""Database client and connectivity layer."""
from typing import Optional
from supabase import create_client, Client
from backend.app.core.config import settings

_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """Return singleton Supabase service client for operations."""
    global _supabase_client
    if _supabase_client is None:
        key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
        if not key:
            # Fail closed against a real deployment; an offline local/test
            # environment (default localhost URL) may proceed without a key.
            if "localhost" in settings.SUPABASE_URL or "127.0.0.1" in settings.SUPABASE_URL:
                key = "anon-placeholder"
            else:
                raise RuntimeError(
                    "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be configured"
                )
        _supabase_client = create_client(settings.SUPABASE_URL, key)
    return _supabase_client
