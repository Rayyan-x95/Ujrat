"""Database client and connectivity layer."""
from typing import Optional
from supabase import create_client, Client
from backend.app.core.config import settings

_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """Return singleton Supabase service client for operations."""
    global _supabase_client
    if _supabase_client is None:
        key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY or "anon-placeholder"
        _supabase_client = create_client(settings.SUPABASE_URL, key)
    return _supabase_client
