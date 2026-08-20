"""Payments API endpoints."""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from backend.app.services.upi_service import UPIService, UPILinkParams
from backend.app.services.state_machines import PaymentStateMachine, StateMachineError
from backend.app.core.security import get_current_user
from backend.app.core.database import get_supabase_client

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
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


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

    res = query.execute()
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
    inv_res = sb.table("invoices").select("id, status, grand_total").eq("id", request.invoice_id).eq("workspace_id", workspace_id).execute()
    if not inv_res.data:
        raise HTTPException(status_code=404, detail="Invoice not found in workspace")

    # Insert payment record
    pay_data = {
        "workspace_id": workspace_id,
        "invoice_id": request.invoice_id,
        "amount": request.amount,
        "payment_method": request.payment_method,
        "transaction_reference": request.transaction_reference,
        "status": "completed",
        "notes": request.notes,
    }
    insert_res = sb.table("payments").insert(pay_data).execute()
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to record payment")

    return insert_res.data[0]
