"""NPCI Unified Payments Interface (UPI) Deep Link & QR Service."""
import math
import re
import time
import urllib.parse
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class UPILinkParams(BaseModel):
    payee_vpa: str
    payee_name: str = "Freelancer"
    amount: float = Field(gt=0)
    currency: str = "INR"
    invoice_number: str
    note: Optional[str] = None
    transaction_ref: Optional[str] = None


class UPIService:
    """Gateway-Independent Direct NPCI UPI Specification Implementation in Python."""

    @staticmethod
    def validate_utr(utr: str) -> bool:
        """Validate 12-digit numeric NPCI UPI Transaction Reference (UTR)."""
        if not utr or not isinstance(utr, str):
            return False
        clean = utr.strip()
        return bool(re.match(r"^\d{12}$", clean))

    @staticmethod
    def generate_deep_link(params: UPILinkParams) -> str:
        """Generate official NPCI UPI Deep Link URI.
        Spec: upi://pay?pa=<upi_id>&pn=<payee_name>&am=<amount>&cu=INR&tn=<note>&tr=<ref>
        """
        clean_vpa = params.payee_vpa.strip()
        if not clean_vpa or "@" not in clean_vpa:
            raise ValueError("Invalid or empty payee UPI VPA.")

        if not math.isfinite(params.amount) or params.amount <= 0:
            raise ValueError("Payment amount must be greater than zero.")

        amount_str = f"{params.amount:.2f}"
        clean_payee = (params.payee_name or "Freelancer").strip()
        ref = params.transaction_ref or f"INV-{params.invoice_number}-{str(int(time.time() * 1000))[-6:]}"
        note = (params.note or f"Invoice {params.invoice_number}").strip()

        upi_params: Dict[str, str] = {
            "pa": clean_vpa,
            "pn": clean_payee,
            "am": amount_str,
            "cu": (params.currency or "INR").upper(),
            "tr": ref,
            "tn": note,
        }

        query = urllib.parse.urlencode(upi_params, quote_via=urllib.parse.quote)
        return f"upi://pay?{query}"

    @staticmethod
    def generate_app_specific_deep_link(params: UPILinkParams, scheme_prefix: str) -> str:
        """Generate intent link for specific payment apps:
        - Google Pay: tez://upi/pay?
        - PhonePe: phonepe://pay?
        - Paytm: paytmmp://pay?
        """
        query_string = UPIService.generate_deep_link(params).replace("upi://pay?", "")
        return f"{scheme_prefix}{query_string}"
