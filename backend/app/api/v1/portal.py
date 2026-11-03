"""Client Portal Zero-Auth API Endpoints.
Zero-auth client access gated exclusively by valid portal tokens.

The portal token is a live credential (90 days). It must travel in a header,
never in the URL: path tokens land in access logs, browser history and
Referer headers.
"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

from backend.app.core.database import get_supabase_client
from backend.app.services.upi_service import UPIService

router = APIRouter()

PortalToken = Header(default=None, alias="X-Portal-Token")


def _require_token(token: Optional[str]) -> str:
    if not token or not token.strip():
        raise HTTPException(status_code=401, detail="Missing portal token")
    return token


class PortalPaymentSubmissionRequest(BaseModel):
    invoice_id: str
    amount: float = Field(gt=0, allow_inf_nan=False)
    utr_number: str
    notes: Optional[str] = None


@router.get("/project", response_model=Dict[str, Any])
async def get_portal_project_data(token: Optional[str] = PortalToken):
    """Retrieve portal project data using SECURITY DEFINER RPC."""
    token = _require_token(token)
    sb = get_supabase_client()
    res = sb.rpc("get_portal_project", {"token_val": token}).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Invalid or expired portal token")
    return res.data[0] if isinstance(res.data, list) else res.data


@router.get("/invoices", response_model=List[Dict[str, Any]])
async def get_portal_invoices_data(token: Optional[str] = PortalToken):
    """Retrieve portal invoices using SECURITY DEFINER RPC."""
    token = _require_token(token)
    sb = get_supabase_client()
    res = sb.rpc("get_portal_invoices", {"token_val": token}).execute()
    return res.data or []


@router.get("/contract", response_model=Dict[str, Any])
async def get_portal_contract_data(token: Optional[str] = PortalToken):
    """Retrieve portal contract using SECURITY DEFINER RPC."""
    token = _require_token(token)
    sb = get_supabase_client()
    res = sb.rpc("get_portal_contract", {"token_val": token}).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Contract not found or expired token")
    return res.data[0] if isinstance(res.data, list) else res.data


@router.post("/submit-payment", response_model=Dict[str, Any])
async def submit_portal_payment(
    request: PortalPaymentSubmissionRequest,
    token: Optional[str] = PortalToken,
):
    """Client submits payment proof (12-digit UTR) via portal token."""
    token = _require_token(token)
    if not UPIService.validate_utr(request.utr_number):
        raise HTTPException(status_code=400, detail="Invalid 12-digit UTR number format")

    sb = get_supabase_client()

    # The RPC owns every check: token validity, that the invoice belongs to the
    # token's project, the amount against the outstanding balance, duplicate
    # UTRs and the submission rate limit. Writing the payment row and the
    # invoice status directly here bypassed all of them and let a portal
    # holder touch any invoice id.
    # supabase-py v2 raises on RPC errors; they surface as HTTP 500 (mapped by
    # FastAPI's generic handler, no internal details leak into the body).
    sb.rpc(
        "submit_portal_payment",
        {
            "token_val": token,
            "invoice_id_val": request.invoice_id,
            "amt": request.amount,
            "pay_method": "UPI",
            "tx_ref": request.utr_number,
        },
    ).execute()

    return {"message": "Payment submitted for verification"}
