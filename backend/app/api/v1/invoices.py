"""Invoices API endpoints with tax calculation and state machine enforcement."""
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from backend.app.core.security import get_current_user
from backend.app.core.database import get_supabase_client
from backend.app.schemas.tax import (
    TaxCalculationRequest,
    FreelancerTaxProfile,
    ClientTaxProfile,
    InvoiceItemTaxInput,
    InvoiceDiscountInput,
    TDSInput,
)
from backend.app.services.tax_engine import calculate_invoice_tax
from backend.app.services.state_machines import InvoiceStateMachine, StateMachineError

router = APIRouter()


class InvoiceLineCreate(BaseModel):
    description: str
    quantity: float = Field(default=1.0, ge=0)
    rate: float = Field(default=0.0, ge=0)
    gst_rate: float = Field(default=18.0, ge=0)
    cess_rate: Optional[float] = Field(default=0.0, ge=0)
    hsn_code: Optional[str] = None
    sac_code: Optional[str] = None
    unit: Optional[str] = "NOS"
    discount_amount: Optional[float] = Field(default=0.0, ge=0)


class InvoiceCreateRequest(BaseModel):
    client_id: str
    project_id: Optional[str] = None
    invoice_number: str
    invoice_date: str
    due_date: str
    items: List[InvoiceLineCreate]
    discount_type: Optional[str] = "fixed"
    discount_value: Optional[float] = 0.0
    discount_scope: Optional[str] = "before_tax"
    tds_section: Optional[str] = None
    tds_rate: Optional[float] = None
    is_reverse_charge: Optional[bool] = False
    currency: Optional[str] = "INR"
    exchange_rate: Optional[float] = 1.0
    notes: Optional[str] = None
    terms: Optional[str] = None


class InvoiceStatusUpdateRequest(BaseModel):
    status: str
    notes: Optional[str] = None


@router.get("", response_model=List[Dict[str, Any]])
async def list_invoices(
    client_id: Optional[str] = None,
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List invoices scoped to workspace."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    sb = get_supabase_client()
    query = (
        sb.table("invoices")
        .select("*, clients(name, company_name), invoice_items(*)")
        .eq("workspace_id", workspace_id)
        .is_("deleted_at", "null")
    )
    if client_id:
        query = query.eq("client_id", client_id)
    if project_id:
        query = query.eq("project_id", project_id)
    if status:
        query = query.eq("status", status)

    res = query.order("invoice_date", desc=True).execute()
    return res.data or []


@router.post("", response_model=Dict[str, Any])
async def create_invoice(
    request: InvoiceCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Create invoice with authoritative server-side tax calculation."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    sb = get_supabase_client()

    # Fetch workspace profile (freelancer profile)
    ws_res = sb.table("workspaces").select("*").eq("id", workspace_id).execute()
    freelancer_data = ws_res.data[0] if ws_res.data else {}

    # Fetch client profile
    client_res = sb.table("clients").select("*").eq("id", request.client_id).eq("workspace_id", workspace_id).execute()
    if not client_res.data:
        raise HTTPException(status_code=404, detail="Client not found in workspace")
    client_data = client_res.data[0]

    # Calculate authoritative tax
    calc_req = TaxCalculationRequest(
        freelancer=FreelancerTaxProfile(
            is_gst_registered=bool(freelancer_data.get("is_gst_registered", False)),
            gstin=freelancer_data.get("gstin"),
            state=freelancer_data.get("state"),
            tax_scheme=freelancer_data.get("tax_scheme", "regular"),
            lut_number=freelancer_data.get("lut_number"),
            lut_expiry_date=freelancer_data.get("lut_expiry_date"),
        ),
        client=ClientTaxProfile(
            gstin=client_data.get("gstin"),
            state=client_data.get("state"),
            country=client_data.get("country", "India"),
            is_sez=bool(client_data.get("is_sez", False)),
        ),
        items=[
            InvoiceItemTaxInput(
                description=it.description,
                quantity=it.quantity,
                rate=it.rate,
                gst_rate=it.gst_rate,
                cess_rate=it.cess_rate or 0.0,
                hsn_code=it.hsn_code,
                sac_code=it.sac_code,
                unit=it.unit or "NOS",
                discount_amount=it.discount_amount or 0.0,
            )
            for it in request.items
        ],
        invoiceDiscount=InvoiceDiscountInput(
            type=request.discount_type or "fixed",
            value=request.discount_value or 0.0,
            scope=request.discount_scope or "before_tax",
        ) if request.discount_value and request.discount_value > 0 else None,
        tds=TDSInput(
            section=request.tds_section,
            rate=request.tds_rate,
        ) if request.tds_section else None,
        isReverseCharge=request.is_reverse_charge,
        currency=request.currency or "INR",
        exchangeRate=request.exchange_rate or 1.0,
    )

    tax_breakdown = calculate_invoice_tax(calc_req)

    # Insert invoice header
    inv_data = {
        "workspace_id": workspace_id,
        "client_id": request.client_id,
        "project_id": request.project_id,
        "invoice_number": request.invoice_number,
        "invoice_date": request.invoice_date,
        "due_date": request.due_date,
        "status": "draft",
        "subtotal": tax_breakdown.subtotal,
        "discount_amount": tax_breakdown.discount_amount,
        "taxable_amount": tax_breakdown.taxable_amount,
        "cgst": tax_breakdown.cgst,
        "sgst": tax_breakdown.sgst,
        "igst": tax_breakdown.igst,
        "cess_amount": tax_breakdown.cess,
        "total_tax": tax_breakdown.total_gst,
        "round_off": tax_breakdown.round_off,
        "grand_total": tax_breakdown.grand_total,
        "tds_amount": tax_breakdown.tds_amount,
        "outstanding_balance": tax_breakdown.grand_total,
        "currency": tax_breakdown.currency,
        "notes": request.notes,
        "terms": request.terms,
    }

    inv_insert = sb.table("invoices").insert(inv_data).execute()
    if not inv_insert.data:
        raise HTTPException(status_code=500, detail="Failed to create invoice header")
    created_invoice = inv_insert.data[0]
    invoice_id = created_invoice["id"]

    # Insert line items
    line_inserts = []
    for line in tax_breakdown.line_items:
        line_inserts.append({
            "invoice_id": invoice_id,
            "workspace_id": workspace_id,
            "description": line.description,
            "quantity": line.quantity,
            "rate": line.rate,
            "gst_rate": line.gst_rate,
            "cgst_amount": line.cgst_amount,
            "sgst_amount": line.sgst_amount,
            "igst_amount": line.igst_amount,
            "cess_amount": line.cess_amount,
            "line_total": line.line_total,
            "hsn_code": line.hsn_code,
            "sac_code": line.sac_code,
            "unit": line.unit,
        })

    if line_inserts:
        sb.table("invoice_items").insert(line_inserts).execute()

    return {**created_invoice, "tax_breakdown": tax_breakdown.model_dump(), "line_items": line_inserts}


@router.get("/{invoice_id}", response_model=Dict[str, Any])
async def get_invoice(
    invoice_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get invoice by ID with line items and client data."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    sb = get_supabase_client()
    res = (
        sb.table("invoices")
        .select("*, clients(*), invoice_items(*), payments(*)")
        .eq("id", invoice_id)
        .eq("workspace_id", workspace_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return res.data[0]


@router.put("/{invoice_id}/status", response_model=Dict[str, Any])
async def update_invoice_status(
    invoice_id: str,
    request: InvoiceStatusUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update invoice status with State Machine enforcement."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    sb = get_supabase_client()
    cur_res = sb.table("invoices").select("status").eq("id", invoice_id).eq("workspace_id", workspace_id).execute()
    if not cur_res.data:
        raise HTTPException(status_code=404, detail="Invoice not found")

    cur_status = cur_res.data[0].get("status", "draft")
    try:
        InvoiceStateMachine.transition(cur_status, request.status)
    except StateMachineError as err:
        raise HTTPException(status_code=400, detail=str(err))

    update_res = (
        sb.table("invoices")
        .update({"status": request.status})
        .eq("id", invoice_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    return update_res.data[0]


@router.delete("/{invoice_id}", response_model=Dict[str, Any])
async def delete_invoice(
    invoice_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Soft delete invoice."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    sb = get_supabase_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    res = (
        sb.table("invoices")
        .update({"deleted_at": now_iso})
        .eq("id", invoice_id)
        .eq("workspace_id", workspace_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Invoice not found or already deleted")
    return {"message": "Invoice deleted successfully", "id": invoice_id}
