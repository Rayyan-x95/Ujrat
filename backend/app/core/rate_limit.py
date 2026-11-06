"""Sliding-window rate limit for the abuse-prone API surfaces.

The portal endpoints run SECURITY DEFINER RPCs and /tax is CPU work.

State lives in Supabase (`edge_function_rate_limits`) when a client is
configured, so the limit applies across processes; when it isn't (local
tests), an in-process fallback keeps the same window/algorithm and the
table is bounded (oldest-first eviction) so memory cannot grow forever.
shortcut: in-process fallback can't share state across processes - revisit on scale-out.
"""
import asyncio
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

WINDOW_SECONDS = 60
MAX_REQUESTS_PER_WINDOW = 60
MAX_BUCKETS = 10_000
PROTECTED_PREFIXES = ("/api/v1/portal", "/api/v1/tax")


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, **kwargs):
        super().__init__(app, **kwargs)
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    def _check_in_process(self, ip: str) -> bool:
        now = time.monotonic()
        bucket = self._hits[ip]
        while bucket and bucket[0] <= now - WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= MAX_REQUESTS_PER_WINDOW:
            return False
        bucket.append(now)
        # Evict oldest buckets (not the one we just touched) when the table
        # grows past the cap so memory cannot grow unboundedly.
        if len(self._hits) > MAX_BUCKETS:
            for key in list(self._hits.keys())[: len(self._hits) - MAX_BUCKETS]:
                if key != ip:
                    del self._hits[key]
        return True

    def _check_supabase_store(self, ip: str) -> bool | None:
        """Try the shared consume_edge_rate_limit RPC. Returns None on failure."""
        try:
            from backend.app.core.database import get_supabase_client

            sb = get_supabase_client()
            res = sb.rpc("consume_edge_rate_limit", {
                "p_scope": f"api-rate-limit:{ip}",
                "p_window_seconds": WINDOW_SECONDS,
                "p_max_requests": MAX_REQUESTS_PER_WINDOW,
            }).execute()
            row = (res.data or [{}])[0] if isinstance(res.data, list) else (res.data or {})
            return bool(row.get("allowed"))
        except Exception:
            return None

    @staticmethod
    def _client_ip(request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # Render terminates TLS and forwards the caller in X-Forwarded-For;
            # request.client.host would be the proxy and put every user in one
            # bucket.
            # shortcut: trusts X-Forwarded-For; only safe behind a proxy that
            # overwrites it - revisit if the API is exposed directly.
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if any(request.url.path.startswith(p) for p in PROTECTED_PREFIXES):
            ip = self._client_ip(request)
            # The Supabase client is synchronous; keep it off the event loop so
            # a slow rate-limit store cannot stall unrelated requests.
            allowed = await asyncio.to_thread(self._check_supabase_store, ip)
            if allowed is None:
                allowed = self._check_in_process(ip)
            if not allowed:
                return JSONResponse({"detail": "Too many requests"}, status_code=429)
        return await call_next(request)
