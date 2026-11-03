"""Tax Engine API endpoints."""
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from backend.app.schemas.tax import TaxCalculationRequest, TaxBreakdownResult
from backend.app.services.tax_engine import (
    calculate_invoice_tax,
    validate_tax_calculation,
    validate_gstin_format,
)
from backend.app.core.security import get_current_user

router = APIRouter()


class GSTINValidationRequest(BaseModel):
    gstin: str


class GSTINValidationResponse(BaseModel):
    is_valid: bool
    state_name: str = ""
    pan: str = ""
    error: str = ""


@router.post("/calculate", response_model=TaxBreakdownResult)
async def calculate_tax(
    request: TaxCalculationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Authoritative server-side GST and TDS invoice tax calculation."""
    try:
        result = calculate_invoice_tax(request)
        validation = validate_tax_calculation(result)
        if not validation["is_valid"]:
            # Even if validation has warnings/arithmetic notices, return result but attach warnings
            for err in validation["errors"]:
                if err not in result.warnings:
                    result.warnings.append(err)
        return result
    except ValueError as e:
        # Domain validation messages are user-meaningful by design.
        raise HTTPException(status_code=400, detail=str(e))
    except OverflowError:
        raise HTTPException(status_code=400, detail="Numeric value out of range")
    # Everything else bubbles as a plain 500; never echo internal error text.


@router.post("/validate-gstin", response_model=GSTINValidationResponse)
async def validate_gstin(
    request: GSTINValidationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Validate 15-character GSTIN with state code prefix and PAN extraction."""
    res = validate_gstin_format(request.gstin)
    return GSTINValidationResponse(
        is_valid=res["is_valid"],
        state_name=res.get("state_name", ""),
        pan=res.get("pan", ""),
        error=res.get("error", ""),
    )
