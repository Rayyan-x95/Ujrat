"""Client Portal Zero-Auth API Endpoints.
Zero-auth client access gated exclusively by valid portal tokens.
"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.app.core.database import get_supabase_client
from backend.app.services.upi_service import UPIService

router = APIRouter()


class PortalPaymentSubmissionRequest(BaseModel):
    invoice_id: str
    amount: float = Field(gt=0)
    utr_number: str
    notes: Optional[str] = None


@router.get("/project/{token}", response_model=Dict[str, Any])
async def get_portal_project_data(token: str):
    """Retrieve portal project data using SECURITY DEFINER RPC."""
    sb = get_supabase_client()
    res = sb.rpc("get_portal_project", {"token_val": token}).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Invalid or expired portal token")
    return res.data[0] if isinstance(res.data, list) else res.data


@router.get("/invoices/{token}", response_model=List[Dict[str, Any]])
async def get_portal_invoices_data(token: str):
    """Retrieve portal invoices using SECURITY DEFINER RPC."""
    sb = get_supabase_client()
    res = sb.rpc("get_portal_invoices", {"token_val": token}).execute()
    return res.data or []


@router.get("/contract/{token}", response_model=Dict[str, Any])
async def get_portal_contract_data(token: str):
    """Retrieve portal contract using SECURITY DEFINER RPC."""
    sb = get_supabase_client()
    res = sb.rpc("get_portal_contract", {"token_val": token}).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Contract not found or expired token")
    return res.data[0] if isinstance(res.data, list) else res.data


@router.post("/submit-payment/{token}", response_model=Dict[str, Any])
async def submit_portal_payment(
    token: str,
    request: PortalPaymentSubmissionRequest,
):
    """Client submits payment proof (12-digit UTR) via portal token."""
    if not UPIService.validate_utr(request.utr_number):
        raise HTTPException(status_code=400, detail="Invalid 12-digit UTR number format")

    sb = get_supabase_client()

    # Validate portal token by fetching project
    proj_res = sb.rpc("get_portal_project", {"token_val": token}).execute()
    if not proj_res.data:
        raise HTTPException(status_code=403, detail="Invalid portal token")

    project = proj_res.data[0] if isinstance(proj_res.data, list) else proj_res.data
    workspace_id = project.get("workspace_id")

    # Record payment with pending_verification status
    pay_data = {
        "workspace_id": workspace_id,
        "invoice_id": request.invoice_id,
        "amount": request.amount,
        "payment_method": "UPI",
        "transaction_reference": request.utr_number,
        "status": "pending_verification",
        "notes": request.notes or "Submitted via Client Portal",
    }
    insert_res = sb.table("payments").insert(pay_data).execute()
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to submit payment proof")

    # Update invoice to pending_verification
    sb.table("invoices").update({"status": "pending_verification"}).eq("id", request.invoice_id).execute()

    return {"message": "Payment submitted for verification", "payment": insert_res.data[0]}
