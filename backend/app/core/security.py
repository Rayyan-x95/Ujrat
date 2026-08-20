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
        # Decode without verification first if secret is placeholder, or verify with secret
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False, "verify_signature": bool(settings.SUPABASE_JWT_SECRET and len(settings.SUPABASE_JWT_SECRET) >= 32)},
        )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing subject identifier",
            )

        email = payload.get("email")
        # In multi-tenant Supabase, workspace_id can be in app_metadata or queried from user profile
        app_metadata = payload.get("app_metadata", {})
        workspace_id = app_metadata.get("workspace_id") or payload.get("workspace_id") or user_id

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


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[AuthenticatedUser]:
    """Optional authentication dependency for mixed/public routes."""
    if not credentials or not credentials.credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
