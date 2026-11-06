"""JWT Security, decoding, and FastAPI dependencies."""
from typing import Optional, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from pydantic import BaseModel
from backend.app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)


class AuthenticatedUser(BaseModel):
    user_id: str
    email: Optional[str] = None
    workspace_id: Optional[str] = None
    role: str = "authenticated"

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)

    def __getitem__(self, key: str) -> Any:
        return getattr(self, key)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> AuthenticatedUser:
    """Validate Supabase JWT and return authenticated user context."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        # Always verify the signature. A short or missing secret must fail the
        # request, never silently turn verification off.
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False, "verify_signature": True},
        )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing subject identifier",
            )

        email = payload.get("email")
        app_metadata = payload.get("app_metadata") or {}
        # Only app_metadata.workspace_id (set server-side via the admin API) is
        # trusted; a top-level claim is client-derived and may be user-reachable
        # via custom access token hooks, so it is ignored.
        workspace_id = app_metadata.get("workspace_id") if isinstance(app_metadata, dict) else None
        if not workspace_id:
            try:
                from backend.app.core.database import get_supabase_client
                sb = get_supabase_client()
                res = sb.table("workspaces").select("id").eq("profile_id", user_id).is_("deleted_at", "null").limit(1).execute()
                if res.data:
                    workspace_id = res.data[0]["id"]
            except Exception:
                workspace_id = None
        if not workspace_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Workspace context could not be resolved",
            )

        return AuthenticatedUser(
            user_id=user_id,
            email=email,
            workspace_id=workspace_id,
            role=payload.get("role", "authenticated"),
        )
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
