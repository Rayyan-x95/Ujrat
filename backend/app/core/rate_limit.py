"""In-process sliding-window rate limit for the abuse-prone API surfaces.

The portal endpoints run SECURITY DEFINER RPCs and /tax is CPU work. This
per-process limiter suits the single-instance deployment; swap in a
distributed limiter if it ever runs replicas.
shortcut: state is per-process, not per-instance - revisit on scale-out.
"""
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

WINDOW_SECONDS = 60
MAX_REQUESTS_PER_WINDOW = 60
PROTECTED_PREFIXES = ("/api/v1/portal", "/api/v1/tax")


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, **kwargs):
        super().__init__(app, **kwargs)
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if any(request.url.path.startswith(p) for p in PROTECTED_PREFIXES):
            now = time.monotonic()
            ip = request.client.host if request.client else "unknown"
            bucket = self._hits[ip]
            while bucket and bucket[0] <= now - WINDOW_SECONDS:
                bucket.popleft()
            if len(bucket) >= MAX_REQUESTS_PER_WINDOW:
                return JSONResponse({"detail": "Too many requests"}, status_code=429)
            bucket.append(now)
        return await call_next(request)
