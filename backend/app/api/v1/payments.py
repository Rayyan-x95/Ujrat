"""Payments API endpoints."""
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from backend.app.services.upi_service import UPIService, UPILinkParams
from backend.app.core.security import get_current_user
from backend.app.core.database import get_supabase_client
from backend.app.core.db_errors import map_db_error

router = APIRouter()


class UPIDeepLinkRequest(BaseModel):
    payee_vpa: str
    payee_name: str = "Freelancer"
    amount: float = Field(gt=0)
    currency: str = "INR"
    invoice_number: str
    note: Optional[str] = None
    transaction_ref: Optional[str] = None


class UPIDeepLinkResponse(BaseModel):
    deep_link_uri: str
    gpay_link: str
    phonepe_link: str
    paytm_link: str


class UTRVerificationRequest(BaseModel):
    utr: str


class UTRVerificationResponse(BaseModel):
    is_valid: bool
    utr: str


class RecordPaymentRequest(BaseModel):
    invoice_id: str
    amount: float = Field(gt=0)
    payment_method: str = "UPI"
    transaction_reference: Optional[str] = None
    paid_at: Optional[str] = None
    notes: Optional[str] = None


@router.post("/upi/deep-link", response_model=UPIDeepLinkResponse)
async def generate_upi_deep_link(
    request: UPIDeepLinkRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Generate NPCI standard and app-specific UPI deep links."""
    try:
        params = UPILinkParams(
            payee_vpa=request.payee_vpa,
            payee_name=request.payee_name,
            amount=request.amount,
            currency=request.currency,
            invoice_number=request.invoice_number,
            note=request.note,
            transaction_ref=request.transaction_ref,
        )
        deep_link = UPIService.generate_deep_link(params)
        gpay = UPIService.generate_app_specific_deep_link(params, "tez://upi/pay?")
        phonepe = UPIService.generate_app_specific_deep_link(params, "phonepe://pay?")
        paytm = UPIService.generate_app_specific_deep_link(params, "paytmmp://pay?")
        return UPIDeepLinkResponse(
            deep_link_uri=deep_link,
            gpay_link=gpay,
            phonepe_link=phonepe,
            paytm_link=paytm,
        )
    except ValueError as e:
        # Domain validation messages are user-meaningful by design.
        raise HTTPException(status_code=400, detail=str(e))
    except OverflowError:
        raise HTTPException(status_code=400, detail="Numeric value out of range")
    # Everything else bubbles as a plain 500; never echo internal error text.


@router.post("/upi/verify-utr", response_model=UTRVerificationResponse)
async def verify_utr(
    request: UTRVerificationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Verify 12-digit numeric NPCI UPI transaction reference (UTR)."""
    valid = UPIService.validate_utr(request.utr)
    return UTRVerificationResponse(is_valid=valid, utr=request.utr)


@router.get("", response_model=List[Dict[str, Any]])
async def list_payments(
    invoice_id: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List payments strictly scoped to current workspace."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    sb = get_supabase_client()
    query = sb.table("payments").select("*").eq("workspace_id", workspace_id).is_("deleted_at", "null")
    if invoice_id:
        query = query.eq("invoice_id", invoice_id)
    query = query.order("created_at", desc=True)

    res = query.range(offset, offset + limit - 1).execute()
    return res.data or []


@router.post("", response_model=Dict[str, Any])
async def record_payment(
    request: RecordPaymentRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Record a payment, verifying transaction UTR and updating invoice status."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    if request.transaction_reference and not UPIService.validate_utr(request.transaction_reference):
        raise HTTPException(status_code=400, detail="Invalid 12-digit UTR transaction reference")

    sb = get_supabase_client()

    # Verify invoice exists in this workspace
    inv_res = (
        sb.table("invoices")
        .select("id, status, total, outstanding_balance")
        .eq("id", request.invoice_id)
        .eq("workspace_id", workspace_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not inv_res.data:
        raise HTTPException(status_code=404, detail="Invoice not found in workspace")

    invoice = inv_res.data[0]
    if invoice.get("status") in ("paid", "cancelled"):
        raise HTTPException(status_code=400, detail="Invoice is not open for payment")

    outstanding = invoice.get("outstanding_balance")
    if outstanding is None:
        outstanding = invoice.get("total") or 0
    if request.amount > outstanding:
        raise HTTPException(status_code=400, detail="Payment amount exceeds the outstanding balance")

    # Atomic settle via the reconcile_gateway_payment RPC (single transaction,
    # invoice lock + idempotent transaction_reference handling).
    import uuid as _uuid
    tx_ref = request.transaction_reference or f"MANUAL-{_uuid.uuid4()}"
    try:
        rpc_res = sb.rpc("reconcile_gateway_payment", {
            "p_invoice_id": request.invoice_id,
            "p_amount": request.amount,
            "p_transaction_id": tx_ref,
            "p_gateway": request.payment_method or "UPI",
            "p_metadata": {"notes": request.notes, "paid_at": request.paid_at},
        }).execute()
    except Exception as exc:
        raise map_db_error(exc)
    if not rpc_res.data:
        raise HTTPException(status_code=500, detail="Failed to record payment")
    return rpc_res.data
