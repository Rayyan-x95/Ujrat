"""Ujrat Tax Engine 2.0 - Unified Invoice & Tax Calculator in Python.
Integer Paise Precision Math • GST Determination • TDS Breakdown • Statutory Validations
"""
import math
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any

from backend.app.schemas.tax import (
    CalculatedLineItem,
    ClientTaxProfile,
    FreelancerTaxProfile,
    InvoiceItemTaxInput,
    TaxBreakdownResult,
    TaxCalculationRequest,
)

# 40 Official & Legacy Indian State / Union Territory GST Codes
GST_STATE_CODES: Dict[str, str] = {
    "01": "Jammu and Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "25": "Daman and Diu (Legacy)",
    "26": "Dadra and Nagar Haveli and Daman and Diu",
    "27": "Maharashtra",
    "28": "Andhra Pradesh (Old)",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman and Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh",
    "38": "Ladakh",
    "97": "Other Territory",
}

STATE_NAME_TO_CODE: Dict[str, str] = {
    name.lower().strip(): code for code, name in GST_STATE_CODES.items()
}

TDS_SECTIONS: Dict[str, Dict[str, Any]] = {
    "194J": {
        "code": "194J",
        "name": "Fees for Professional or Technical Services",
        "default_rate": 10.0,
        "description": "10% for professional services (architecture, design, engineering, legal, consulting). 2% for technical software support.",
        "cbdt_circular": "CBDT Circular No. 3/2020 & Section 194J of Income Tax Act 1961",
    },
    "194J_TECH": {
        "code": "194J_TECH",
        "name": "Fees for Technical Services (FTS)",
        "default_rate": 2.0,
        "description": "2% for pure technical services and call centre operations.",
        "cbdt_circular": "Finance Act 2020 amendment to Section 194J(1)",
    },
    "194C": {
        "code": "194C",
        "name": "Payments to Contractors & Sub-contractors",
        "default_rate": 1.0,
        "description": "1% for individuals/HUFs, 2% for corporate entities on contract work.",
        "cbdt_circular": "Section 194C of Income Tax Act 1961",
    },
    "194H": {
        "code": "194H",
        "name": "Commission or Brokerage",
        "default_rate": 2.0,
        "description": "2% on commission/brokerage payments above ₹20,000 threshold.",
        "cbdt_circular": "Section 194H of Income Tax Act 1961 (amended by Finance (No. 2) Act, 2024)",
    },
    "194Q": {
        "code": "194Q",
        "name": "TDS on Purchase of Goods",
        "default_rate": 0.1,
        "description": "0.1% on purchase of goods exceeding ₹50 Lakhs in aggregate FY.",
        "cbdt_circular": "Finance Act 2021 addition",
    },
}


def to_paise(amount: float) -> int:
    """Convert rupee amount to integer paise, matching JS Math.round(Number(amount || 0) * 100)."""
    # Note: JavaScript Math.round rounds half-up toward +infinity
    # In Python, standard round() is banker's rounding (half to even).
    # To match JS Math.round exactly for positive floats: int(floor(x + 0.5))
    x = float(amount or 0) * 100.0
    return math.floor(x + 0.5)


def from_paise(paise: int) -> float:
    """Convert integer paise back to rupees."""
    return round(paise) / 100.0


def extract_state_code(gstin: Optional[str] = None, state_name: Optional[str] = None) -> Optional[str]:
    """Extract 2-digit GST state code from GSTIN or state name."""
    if gstin and re.match(r"^\d{2}", gstin.strip()):
        code = gstin.strip()[:2]
        if code in GST_STATE_CODES:
            return code

    if state_name:
        normalized = re.sub(r"\s+", " ", state_name.lower().strip())
        if not normalized:
            return None
        if normalized in STATE_NAME_TO_CODE:
            return STATE_NAME_TO_CODE[normalized]

        best_match_code = None
        max_match_len = 0
        for name, code in STATE_NAME_TO_CODE.items():
            if "(legacy)" in name or "(old)" in name:
                continue
            clean_name = re.sub(r"\s*\([^)]*\)", "", name).strip()
            # Match boundary or substring
            is_match = (
                normalized == clean_name
                or normalized.startswith(clean_name + " ")
                or clean_name.startswith(normalized + " ")
                or bool(re.search(r"\b" + re.escape(clean_name) + r"\b", normalized, re.IGNORECASE))
                or bool(re.search(r"\b" + re.escape(normalized) + r"\b", clean_name, re.IGNORECASE))
            )
            if is_match and len(clean_name) > max_match_len:
                max_match_len = len(clean_name)
                best_match_code = code

        if best_match_code:
            return best_match_code

    return None


def extract_pan_from_gstin(gstin: Optional[str] = None) -> Optional[str]:
    """Extract 10-character PAN from valid 15-character GSTIN."""
    if not gstin:
        return None
    clean = gstin.strip().upper()
    if re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", clean):
        return clean[2:12]
    return None


def validate_gstin_format(gstin: Optional[str] = None) -> Dict[str, Any]:
    """Validate 15-digit GSTIN with state code prefix."""
    if not gstin or not gstin.strip():
        return {"is_valid": False, "error": "GSTIN is empty"}

    clean = gstin.strip().upper()
    if not re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", clean):
        return {"is_valid": False, "error": "Invalid 15-character GSTIN format (e.g. 29AAAAA1111A1Z1)"}

    state_code = clean[:2]
    state_name = GST_STATE_CODES.get(state_code)
    if not state_name:
        return {"is_valid": False, "error": f"Invalid GST state code prefix: {state_code}"}

    pan = clean[2:12]
    return {"is_valid": True, "state_name": state_name, "pan": pan}


def evaluate_tax_rules(
    freelancer: FreelancerTaxProfile,
    client: ClientTaxProfile,
    custom_supply_type: Optional[str] = None,
    is_custom_rcm: Optional[bool] = False,
    custom_lut_number: Optional[str] = None,
    custom_lut_expiry_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Evaluate tax rules, place of supply, and compliance declarations."""
    declarations: List[str] = []
    warnings: List[str] = []

    tax_scheme = "non_gst" if freelancer.is_gst_registered is False else (freelancer.tax_scheme or "regular")
    free_state_code = extract_state_code(freelancer.gstin, freelancer.state)
    client_state_code = extract_state_code(client.gstin, client.state)

    client_country = (client.country or "").strip().lower()
    client_state_str = (client.state or "").strip().lower()

    is_foreign_client = client_country != "" and client_country not in ("india", "in")
    is_export_keyword = client_state_str in ("export", "outside india", "international", "foreign", "row")
    is_export = is_foreign_client or is_export_keyword

    place_of_supply = "intra_state"
    is_interstate = False
    is_zero_rated = False
    supply_type = custom_supply_type or "taxable"

    lut_no = custom_lut_number or freelancer.lut_number
    raw_lut_exp = custom_lut_expiry_date or freelancer.lut_expiry_date
    lut_exp_date: Optional[str] = None
    if raw_lut_exp:
        match = re.match(r"^(\d{4}-\d{2}-\d{2})", str(raw_lut_exp).strip())
        if match:
            lut_exp_date = match.group(1)

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    is_lut_expired = bool(lut_exp_date and lut_exp_date < today_str)
    is_lut_valid = bool(lut_no and not is_lut_expired)

    suppresses_gst = tax_scheme in ("non_gst", "composition")

    if is_export:
        place_of_supply = "export"
        is_interstate = True
        is_zero_rated = True

        if not suppresses_gst:
            if is_lut_valid:
                supply_type = "zero_rated_lut"
                declarations.append(
                    f"SUPPLY MEANT FOR EXPORT UNDER BOND OR LETTER OF UNDERTAKING (LUT NO: {lut_no}) WITHOUT PAYMENT OF INTEGRATED TAX."
                )
            else:
                supply_type = "zero_rated_non_lut"
                declarations.append("SUPPLY MEANT FOR EXPORT ON PAYMENT OF INTEGRATED TAX.")
                if not lut_no:
                    warnings.append("No active LUT Number specified for foreign client. IGST will be applied per GST export rules.")
                elif is_lut_expired:
                    warnings.append(f"LUT Number {lut_no} expired on {raw_lut_exp or ''}. IGST will be applied per GST export rules.")

    elif client.is_sez:
        place_of_supply = "sez"
        is_interstate = True
        is_zero_rated = True

        if not suppresses_gst:
            if is_lut_valid:
                supply_type = "sez_without_tax"
                declarations.append(
                    f"SUPPLY TO SEZ DEVELOPER/UNIT UNDER BOND/LUT (NO: {lut_no}) WITHOUT PAYMENT OF INTEGRATED TAX."
                )
            else:
                supply_type = "sez_with_tax"
                declarations.append("SUPPLY TO SEZ DEVELOPER/UNIT ON PAYMENT OF INTEGRATED TAX.")

    elif free_state_code and client_state_code:
        if free_state_code == client_state_code:
            place_of_supply = "intra_state"
            is_interstate = False
        else:
            place_of_supply = "inter_state"
            is_interstate = True
    elif freelancer.state and client.state and freelancer.state.strip().lower() == client.state.strip().lower():
        place_of_supply = "intra_state"
        is_interstate = False
    elif client.state:
        place_of_supply = "inter_state"
        is_interstate = True

    if tax_scheme == "composition":
        declarations.append("COMPOSITION TAXABLE PERSON, NOT ELIGIBLE TO COLLECT TAX ON SUPPLIES.")

    is_reverse_charge = bool(is_custom_rcm)
    if is_reverse_charge:
        declarations.append("TAX ON THIS INVOICE IS PAYABLE ON REVERSE CHARGE BASIS BY THE RECIPIENT OF SUPPLY.")

    return {
        "place_of_supply": place_of_supply,
        "is_interstate": is_interstate,
        "is_zero_rated": is_zero_rated,
        "suppresses_gst": suppresses_gst,
        "is_reverse_charge": is_reverse_charge,
        "supply_type": supply_type,
        "tax_scheme": tax_scheme,
        "freelancer_state_code": free_state_code,
        "client_state_code": client_state_code,
        "declarations": declarations,
        "warnings": warnings,
    }


def calculate_gst_breakdown(
    items: List[InvoiceItemTaxInput],
    is_interstate: bool,
    is_zero_rated: bool,
    is_reverse_charge: bool,
    invoice_discount_before_tax_paise: int = 0,
    suppresses_gst: bool = False,
    supply_type: Optional[str] = None,
) -> Dict[str, Any]:
    """Calculate GST breakdown across lines with integer paise precision."""
    subtotal_paise = 0
    line_discounts_paise = 0
    gross_taxable_paise = 0

    prep_items = []
    for item in items:
        qty = float(item.quantity or 0)
        rate = float(item.rate or 0)
        gross_line_paise = to_paise(qty * rate)
        line_discount_paise = to_paise(float(item.discount_amount or 0))
        line_taxable_paise = max(0, gross_line_paise - line_discount_paise)

        subtotal_paise += gross_line_paise
        line_discounts_paise += line_discount_paise
        gross_taxable_paise += line_taxable_paise

        prep_items.append({
            "item": item,
            "qty": qty,
            "rate": rate,
            "gross_line_paise": gross_line_paise,
            "line_discount_paise": line_discount_paise,
            "line_taxable_paise": line_taxable_paise,
        })

    cgst_total_paise = 0
    sgst_total_paise = 0
    igst_total_paise = 0
    cess_total_paise = 0
    net_taxable_total_paise = 0
    allocated_discount_total_paise = 0

    is_tax_exempt = (
        suppresses_gst
        or is_reverse_charge
        or supply_type in ("zero_rated_lut", "sez_without_tax", "exempt", "nil_rated")
        or (is_zero_rated and supply_type not in ("zero_rated_non_lut", "sez_with_tax"))
    )

    line_items: List[CalculatedLineItem] = []
    for index, prep in enumerate(prep_items):
        item_invoice_discount_paise = 0
        if invoice_discount_before_tax_paise > 0 and gross_taxable_paise > 0:
            if index == len(prep_items) - 1:
                item_invoice_discount_paise = max(0, invoice_discount_before_tax_paise - allocated_discount_total_paise)
            else:
                item_invoice_discount_paise = math.floor(
                    ((prep["line_taxable_paise"] / gross_taxable_paise) * invoice_discount_before_tax_paise) + 0.5
                )

        item_invoice_discount_paise = min(item_invoice_discount_paise, prep["line_taxable_paise"])
        allocated_discount_total_paise += item_invoice_discount_paise

        net_line_taxable_paise = max(0, prep["line_taxable_paise"] - item_invoice_discount_paise)
        net_taxable_total_paise += net_line_taxable_paise

        gst_rate = float(prep["item"].gst_rate or 0)
        cess_rate = float(prep["item"].cess_rate or 0)

        cgst_rate = 0.0
        sgst_rate = 0.0
        igst_rate = 0.0
        cgst_paise = 0
        sgst_paise = 0
        igst_paise = 0
        cess_paise = 0

        if not is_tax_exempt and gst_rate > 0:
            if is_interstate:
                igst_rate = gst_rate
                igst_paise = math.floor((net_line_taxable_paise * (igst_rate / 100.0)) + 0.5)
                igst_total_paise += igst_paise
            else:
                cgst_rate = gst_rate / 2.0
                sgst_rate = gst_rate / 2.0
                cgst_paise = math.floor((net_line_taxable_paise * (cgst_rate / 100.0)) + 0.5)
                sgst_paise = math.floor((net_line_taxable_paise * (sgst_rate / 100.0)) + 0.5)
                cgst_total_paise += cgst_paise
                sgst_total_paise += sgst_paise

        if not is_tax_exempt and cess_rate > 0:
            cess_paise = math.floor((net_line_taxable_paise * (cess_rate / 100.0)) + 0.5)
            cess_total_paise += cess_paise

        line_total_paise = net_line_taxable_paise + cgst_paise + sgst_paise + igst_paise + cess_paise

        line_items.append(
            CalculatedLineItem(
                description=prep["item"].description or "",
                quantity=prep["qty"],
                rate=prep["rate"],
                gross_amount=from_paise(prep["gross_line_paise"]),
                discount_amount=from_paise(prep["line_discount_paise"] + item_invoice_discount_paise),
                taxable_amount=from_paise(net_line_taxable_paise),
                gst_rate=gst_rate,
                cgst_rate=cgst_rate,
                sgst_rate=sgst_rate,
                igst_rate=igst_rate,
                cgst_amount=from_paise(cgst_paise),
                sgst_amount=from_paise(sgst_paise),
                igst_amount=from_paise(igst_paise),
                cess_rate=cess_rate,
                cess_amount=from_paise(cess_paise),
                line_total=from_paise(line_total_paise),
                hsn_code=prep["item"].hsn_code or "",
                sac_code=prep["item"].sac_code or prep["item"].hsn_code or "",
                unit=prep["item"].unit or "NOS",
            )
        )

    total_gst_paise = cgst_total_paise + sgst_total_paise + igst_total_paise + cess_total_paise

    return {
        "line_items": line_items,
        "subtotal": from_paise(subtotal_paise),
        "line_discounts_total": from_paise(line_discounts_paise),
        "allocated_invoice_discount": from_paise(allocated_discount_total_paise),
        "taxable_subtotal": from_paise(net_taxable_total_paise),
        "cgst_total": from_paise(cgst_total_paise),
        "sgst_total": from_paise(sgst_total_paise),
        "igst_total": from_paise(igst_total_paise),
        "cess_total": from_paise(cess_total_paise),
        "total_gst": from_paise(total_gst_paise),
    }


def calculate_tds_breakdown(
    taxable_amount: float,
    tds_config: Optional[Any] = None,
) -> Dict[str, Any]:
    """Calculate TDS on taxable value under specified CBDT section."""
    if not tds_config or not getattr(tds_config, "section", None) or tds_config.section == "NONE":
        return {
            "section": None,
            "rate": 0.0,
            "tds_amount": 0.0,
            "net_receivable": taxable_amount,
            "legal_circular": None,
        }

    section_key = tds_config.section
    base_key = section_key.split("_")[0] if "_" in section_key else section_key
    section_meta = TDS_SECTIONS.get(section_key) or TDS_SECTIONS.get(base_key)

    custom_rate = getattr(tds_config, "rate", None)
    if custom_rate is not None and isinstance(custom_rate, (int, float)) and math.isfinite(custom_rate):
        rate = float(custom_rate)
    elif section_meta:
        rate = float(section_meta["default_rate"])
    else:
        rate = 0.0

    if rate <= 0:
        return {
            "section": section_key,
            "rate": 0.0,
            "tds_amount": 0.0,
            "net_receivable": taxable_amount,
            "legal_circular": section_meta["cbdt_circular"] if section_meta else None,
        }

    taxable_paise = to_paise(taxable_amount)
    tds_paise = math.floor((taxable_paise * (rate / 100.0)) + 0.5)
    tds_amount = from_paise(tds_paise)
    net_receivable = from_paise(max(0, taxable_paise - tds_paise))

    return {
        "section": section_key,
        "rate": rate,
        "tds_amount": tds_amount,
        "net_receivable": net_receivable,
        "legal_circular": section_meta["cbdt_circular"] if section_meta else None,
    }


def calculate_invoice_tax(input_data: TaxCalculationRequest) -> TaxBreakdownResult:
    """Master tax calculation service matching TypeScript TaxEngine.calculateInvoiceTax."""
    rules = evaluate_tax_rules(
        freelancer=input_data.freelancer,
        client=input_data.client,
        custom_supply_type=input_data.supply_type,
        is_custom_rcm=input_data.isReverseCharge,
        custom_lut_number=input_data.lutNumber,
        custom_lut_expiry_date=input_data.lutExpiryDate,
    )

    pre_tax_discount_paise = 0
    post_tax_discount_paise = 0
    discount_type = input_data.invoiceDiscount.type if input_data.invoiceDiscount else "fixed"
    discount_scope = input_data.invoiceDiscount.scope if input_data.invoiceDiscount else "before_tax"

    if input_data.invoiceDiscount and input_data.invoiceDiscount.value > 0:
        disc_val = float(input_data.invoiceDiscount.value)
        raw_subtotal_paise = sum(
            to_paise(float(it.quantity or 0) * float(it.rate or 0)) for it in input_data.items
        )

        if discount_type == "percentage":
            calculated_discount_paise = math.floor((raw_subtotal_paise * (disc_val / 100.0)) + 0.5)
        else:
            calculated_discount_paise = to_paise(disc_val)

        if discount_scope == "before_tax":
            pre_tax_discount_paise = min(raw_subtotal_paise, calculated_discount_paise)
        else:
            post_tax_discount_paise = calculated_discount_paise

    gst_res = calculate_gst_breakdown(
        items=input_data.items,
        is_interstate=rules["is_interstate"],
        is_zero_rated=rules["is_zero_rated"],
        is_reverse_charge=rules["is_reverse_charge"],
        invoice_discount_before_tax_paise=pre_tax_discount_paise,
        suppresses_gst=rules["suppresses_gst"],
        supply_type=rules["supply_type"],
    )

    taxable_paise = to_paise(gst_res["taxable_subtotal"])
    total_gst_paise = to_paise(gst_res["total_gst"])
    post_tax_discount_paise = min(post_tax_discount_paise, taxable_paise + total_gst_paise)
    total_discount_paise = (
        to_paise(gst_res["line_discounts_total"] + gst_res["allocated_invoice_discount"])
        + post_tax_discount_paise
    )

    raw_grand_total_paise = taxable_paise + total_gst_paise - post_tax_discount_paise
    grand_total_unrounded = from_paise(max(0, raw_grand_total_paise))
    grand_total = float(round(grand_total_unrounded))
    round_off = from_paise(to_paise(grand_total) - to_paise(grand_total_unrounded))

    tds_res = calculate_tds_breakdown(gst_res["taxable_subtotal"], input_data.tds)
    tds_paise = to_paise(tds_res["tds_amount"])
    net_receivable_paise = max(0, to_paise(grand_total) - tds_paise)
    net_receivable = from_paise(net_receivable_paise)

    currency = input_data.currency or "INR"
    exchange_rate = float(input_data.exchangeRate or 1.0)
    exchange_rate_date = input_data.exchangeRateDate or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    inr_subtotal = from_paise(math.floor((to_paise(gst_res["subtotal"]) * exchange_rate) + 0.5))
    inr_grand_total = from_paise(math.floor((to_paise(grand_total) * exchange_rate) + 0.5))
    inr_net_receivable = from_paise(math.floor((net_receivable_paise * exchange_rate) + 0.5))

    return TaxBreakdownResult(
        subtotal=gst_res["subtotal"],
        discount_amount=from_paise(total_discount_paise),
        discount_type=discount_type,
        discount_scope=discount_scope,
        post_tax_discount=from_paise(post_tax_discount_paise),
        taxable_amount=gst_res["taxable_subtotal"],
        cgst=gst_res["cgst_total"],
        sgst=gst_res["sgst_total"],
        igst=gst_res["igst_total"],
        cess=gst_res["cess_total"],
        total_gst=gst_res["total_gst"],
        grand_total_unrounded=grand_total_unrounded,
        round_off=round_off,
        grand_total=grand_total,
        tds_section=tds_res["section"],
        tds_rate=tds_res["rate"],
        tds_amount=tds_res["tds_amount"],
        net_receivable=net_receivable,
        place_of_supply=rules["place_of_supply"],
        is_interstate=rules["is_interstate"],
        is_zero_rated=rules["is_zero_rated"],
        is_reverse_charge=rules["is_reverse_charge"],
        supply_type=rules["supply_type"],
        tax_scheme=rules["tax_scheme"],
        freelancer_state=input_data.freelancer.state or "",
        client_state=input_data.client.state or "",
        freelancer_gstin=input_data.freelancer.gstin or "",
        client_gstin=input_data.client.gstin or "",
        currency=currency,
        exchange_rate=exchange_rate,
        exchange_rate_date=exchange_rate_date,
        inr_subtotal=inr_subtotal,
        inr_grand_total=inr_grand_total,
        inr_net_receivable=inr_net_receivable,
        declarations=rules["declarations"],
        warnings=rules["warnings"],
        line_items=gst_res["line_items"],
    )


def validate_tax_calculation(result: TaxBreakdownResult) -> Dict[str, Any]:
    """Validate tax calculation invariants."""
    errors: List[str] = []
    header_taxable_paise = to_paise(result.taxable_amount)

    line_sum_paise = sum(to_paise(it.taxable_amount) for it in result.line_items)
    if result.line_items and abs(line_sum_paise - header_taxable_paise) > 1:
        errors.append(
            f"Taxable subtotal mismatch: lines sum to ₹{from_paise(line_sum_paise)} but header reports ₹{result.taxable_amount}"
        )

    if result.place_of_supply == "intra_state":
        if result.cgst != result.sgst:
            errors.append(f"Intra-state GST asymmetry: CGST (₹{result.cgst}) must equal SGST (₹{result.sgst})")
        if result.igst > 0:
            errors.append(f"Intra-state supply cannot levy IGST (found ₹{result.igst})")

    if result.place_of_supply in ("inter_state", "export", "sez"):
        if result.cgst > 0 or result.sgst > 0:
            errors.append("Inter-state/Export supply cannot levy CGST or SGST")

    post_tax_discount_paise = to_paise(result.post_tax_discount or 0)
    calc_grand_unrounded_paise = max(0, header_taxable_paise + to_paise(result.total_gst) - post_tax_discount_paise)
    diff_grand = abs(calc_grand_unrounded_paise - to_paise(result.grand_total_unrounded))
    if diff_grand > 2:
        errors.append(
            f"Grand total arithmetic divergence: expected ₹{from_paise(calc_grand_unrounded_paise)}, got ₹{result.grand_total_unrounded}"
        )

    return {"is_valid": len(errors) == 0, "errors": errors}
