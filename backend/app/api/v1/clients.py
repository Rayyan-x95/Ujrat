"""Clients API endpoints with strict workspace isolation."""
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from backend.app.core.security import get_current_user
from backend.app.core.database import get_supabase_client
from backend.app.services.tax_engine import validate_gstin_format

router = APIRouter()


class ClientCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    email: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "India"
    address: Optional[str] = None
    is_sez: Optional[bool] = False
    currency: Optional[str] = "INR"
    notes: Optional[str] = None


class ClientUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    address: Optional[str] = None
    is_sez: Optional[bool] = None
    currency: Optional[str] = None
    notes: Optional[str] = None


@router.get("", response_model=List[Dict[str, Any]])
async def list_clients(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List all active clients for the current workspace."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    sb = get_supabase_client()
    res = (
        sb.table("clients")
        .select("*")
        .eq("workspace_id", workspace_id)
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.post("", response_model=Dict[str, Any])
async def create_client(
    request: ClientCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Create a client scoped to current workspace."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    pan = request.pan
    if request.gstin:
        val = validate_gstin_format(request.gstin)
        if val["is_valid"] and not pan:
            pan = val.get("pan")

    data = {
        "workspace_id": workspace_id,
        "name": request.name.strip(),
        "email": request.email.strip() if request.email else None,
        "phone": request.phone.strip() if request.phone else None,
        "company_name": request.company_name.strip() if request.company_name else None,
        "gstin": request.gstin.strip().upper() if request.gstin else None,
        "pan": pan.strip().upper() if pan else None,
        "state": request.state.strip() if request.state else None,
        "country": request.country.strip() if request.country else "India",
        "address": request.address.strip() if request.address else None,
        "is_sez": bool(request.is_sez),
        "currency": (request.currency or "INR").upper(),
        "notes": request.notes,
    }

    sb = get_supabase_client()
    res = sb.table("clients").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create client")

    return res.data[0]


@router.get("/{client_id}", response_model=Dict[str, Any])
async def get_client(
    client_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get single client by ID scoped to workspace."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    sb = get_supabase_client()
    res = (
        sb.table("clients")
        .select("*")
        .eq("id", client_id)
        .eq("workspace_id", workspace_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Client not found")
    return res.data[0]


@router.put("/{client_id}", response_model=Dict[str, Any])
async def update_client(
    client_id: str,
    request: ClientUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update client scoped to workspace."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    sb = get_supabase_client()
    update_data = {k: v for k, v in request.model_dump(exclude_unset=True).items()}
    if "gstin" in update_data and update_data["gstin"]:
        val = validate_gstin_format(update_data["gstin"])
        if val["is_valid"] and not update_data.get("pan"):
            update_data["pan"] = val.get("pan")

    res = (
        sb.table("clients")
        .update(update_data)
        .eq("id", client_id)
        .eq("workspace_id", workspace_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Client not found or update failed")
    return res.data[0]


@router.delete("/{client_id}", response_model=Dict[str, Any])
async def delete_client(
    client_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Soft delete client scoped to workspace."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    sb = get_supabase_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    res = (
        sb.table("clients")
        .update({"deleted_at": now_iso})
        .eq("id", client_id)
        .eq("workspace_id", workspace_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Client not found or already deleted")
    return {"message": "Client deleted successfully", "id": client_id}
