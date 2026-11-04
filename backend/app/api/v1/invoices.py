"""Invoices API endpoints with tax calculation and state machine enforcement."""
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
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
from backend.app.core.db_errors import map_db_error

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
    items: List[InvoiceLineCreate] = Field(max_length=200)
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
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List invoices scoped to workspace."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    sb = get_supabase_client()
    query = (
        sb.table("invoices")
        .select("*, projects(id, name, client_id), invoice_items(*)")
        .eq("workspace_id", workspace_id)
        .is_("deleted_at", "null")
    )
    if client_id:
        # public.invoices has no client_id column - the client comes from the project.
        query = query.eq("projects.client_id", client_id)
    if project_id:
        query = query.eq("project_id", project_id)
    if status:
        query = query.eq("status", status)

    res = query.order("invoice_date", desc=True).range(offset, offset + limit - 1).execute()
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

    if not request.project_id:
        # public.invoices.project_id is NOT NULL - the invoice is always
        # attached to a project (the client is derived from it).
        raise HTTPException(status_code=400, detail="project_id is required to create an invoice")

    # Fetch workspace settings (GST profile lives here, not on workspaces)
    ws_res = sb.table("workspace_settings").select(
        "is_gst_registered, gstin, state, tax_scheme, lut_number, lut_expiry_date"
    ).eq("workspace_id", workspace_id).execute()
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
            # public.clients has no country/is_sez columns yet; domestic defaults.
            country="India",
            is_sez=False,
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

    # Column names must match public.invoices: there is no client_id (the
    # client comes from the project), no total_tax and no grand_total - the
    # column is "total" - and no terms column.
    inv_data = {
        "workspace_id": workspace_id,
        "project_id": request.project_id,
        "invoice_number": request.invoice_number,
        "invoice_date": request.invoice_date,
        "due_date": request.due_date,
        "status": "draft",
        "subtotal": tax_breakdown.subtotal,
        "discount_amount": tax_breakdown.discount_amount,
        "discount_type": tax_breakdown.discount_type,
        "discount_scope": tax_breakdown.discount_scope,
        "taxable_amount": tax_breakdown.taxable_amount,
        "cgst": tax_breakdown.cgst,
        "sgst": tax_breakdown.sgst,
        "igst": tax_breakdown.igst,
        "cess_amount": tax_breakdown.cess,
        "total": tax_breakdown.grand_total,
        "round_off": tax_breakdown.round_off,
        "net_receivable": tax_breakdown.net_receivable,
        "tds_section": tax_breakdown.tds_section,
        "tds_rate": tax_breakdown.tds_rate,
        "tds_amount": tax_breakdown.tds_amount,
        "supply_type": tax_breakdown.supply_type,
        "tax_scheme": tax_breakdown.tax_scheme,
        "is_interstate": tax_breakdown.is_interstate,
        "is_zero_rated": tax_breakdown.is_zero_rated,
        "is_reverse_charge": tax_breakdown.is_reverse_charge,
        "freelancer_gstin": tax_breakdown.freelancer_gstin,
        "client_gstin": tax_breakdown.client_gstin,
        "freelancer_state": tax_breakdown.freelancer_state,
        "client_state": tax_breakdown.client_state,
        "outstanding_balance": tax_breakdown.grand_total,
        "currency": tax_breakdown.currency,
        "exchange_rate": tax_breakdown.exchange_rate,
        "exchange_rate_date": tax_breakdown.exchange_rate_date,
        "inr_total": tax_breakdown.inr_grand_total,
        "notes": request.notes,
    }

    # Item payloads for the atomic RPC: invoice_id and workspace_id are set
    # inside the transaction; "amount" mirrors line_total for the legacy col.
    item_payload = []
    for line in tax_breakdown.line_items:
        item_payload.append({
            "description": line.description,
            "quantity": line.quantity,
            "rate": line.rate,
            "gst_rate": line.gst_rate,
            "discount_amount": line.discount_amount,
            "taxable_amount": line.taxable_amount,
            "cess_rate": line.cess_rate,
            "cgst_amount": line.cgst_amount,
            "sgst_amount": line.sgst_amount,
            "igst_amount": line.igst_amount,
            "cess_amount": line.cess_amount,
            "line_total": line.line_total,
            "amount": line.line_total,
            "hsn_code": line.hsn_code,
            "sac_code": line.sac_code,
            "unit": line.unit,
        })

    # Atomic create - header + items in ONE transaction. The previous code did
    # two bare inserts; a crash in between left a full-total invoice with zero
    # items, uncorrectable after issue.
    try:
        rpc_res = sb.rpc(
            "create_invoice_transactional_service",
            {
                "p_workspace_id": workspace_id,
                "p_invoice_data": inv_data,
                "p_invoice_items": item_payload,
            },
        ).execute()
    except Exception as exc:
        raise map_db_error(exc)
    if not rpc_res.data:
        raise HTTPException(status_code=500, detail="Failed to create invoice")
    created_invoice = rpc_res.data["invoice"]
    invoice_items = rpc_res.data.get("invoice_items") or []
    return {**created_invoice, "tax_breakdown": tax_breakdown.model_dump(), "line_items": invoice_items}


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
        .select("*, projects(id, name), invoice_items(*), payments(*)")
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
