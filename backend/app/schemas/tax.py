"""Pydantic schemas for the Ujrat Tax Engine."""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field

TaxScheme = Literal["regular", "composition", "non_gst"]
SupplyType = Literal[
    "taxable",
    "exempt",
    "nil_rated",
    "zero_rated_lut",
    "zero_rated_non_lut",
    "sez_with_tax",
    "sez_without_tax",
]
PlaceOfSupplyType = Literal["intra_state", "inter_state", "sez", "export", "import"]
DiscountType = Literal["percentage", "fixed"]
DiscountScope = Literal["before_tax", "after_tax"]
SupportedCurrency = Literal["INR", "USD", "EUR", "GBP", "AED", "SGD", "JPY"]


class FreelancerTaxProfile(BaseModel):
    is_gst_registered: bool = False
    gstin: Optional[str] = None
    state: Optional[str] = None
    tax_scheme: Optional[TaxScheme] = "regular"
    lut_number: Optional[str] = None
    lut_expiry_date: Optional[str] = None


class ClientTaxProfile(BaseModel):
    gstin: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    is_sez: Optional[bool] = False


class InvoiceItemTaxInput(BaseModel):
    description: str = "Item"
    quantity: float = Field(default=1.0, ge=0)
    rate: float = Field(default=0.0, ge=0)
    gst_rate: float = Field(default=18.0, ge=0)
    cess_rate: Optional[float] = Field(default=0.0, ge=0)
    hsn_code: Optional[str] = None
    sac_code: Optional[str] = None
    unit: Optional[str] = "NOS"
    discount_amount: Optional[float] = Field(default=0.0, ge=0)


class InvoiceDiscountInput(BaseModel):
    type: DiscountType = "fixed"
    value: float = Field(default=0.0, ge=0)
    scope: DiscountScope = "before_tax"


class TDSInput(BaseModel):
    section: str = "194J"
    rate: Optional[float] = None


class TaxCalculationRequest(BaseModel):
    freelancer: FreelancerTaxProfile
    client: ClientTaxProfile
    items: List[InvoiceItemTaxInput]
    invoiceDiscount: Optional[InvoiceDiscountInput] = None
    tds: Optional[TDSInput] = None
    isReverseCharge: Optional[bool] = False
    currency: Optional[SupportedCurrency] = "INR"
    exchangeRate: Optional[float] = 1.0
    exchangeRateDate: Optional[str] = None
    supply_type: Optional[SupplyType] = None
    lutNumber: Optional[str] = None
    lutExpiryDate: Optional[str] = None


class CalculatedLineItem(BaseModel):
    description: str
    quantity: float
    rate: float
    gross_amount: float
    discount_amount: float
    taxable_amount: float
    gst_rate: float
    cgst_rate: float
    sgst_rate: float
    igst_rate: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    cess_rate: float
    cess_amount: float
    line_total: float
    hsn_code: str
    sac_code: str
    unit: str


class TaxBreakdownResult(BaseModel):
    subtotal: float
    discount_amount: float
    discount_type: DiscountType
    discount_scope: DiscountScope
    post_tax_discount: float
    taxable_amount: float
    cgst: float
    sgst: float
    igst: float
    cess: float
    total_gst: float
    grand_total_unrounded: float
    round_off: float
    grand_total: float

    # TDS
    tds_section: Optional[str]
    tds_rate: float
    tds_amount: float
    net_receivable: float

    # Determination
    place_of_supply: PlaceOfSupplyType
    is_interstate: bool
    is_zero_rated: bool
    is_reverse_charge: bool
    supply_type: SupplyType
    tax_scheme: TaxScheme

    # Identity
    freelancer_state: str
    client_state: str
    freelancer_gstin: str
    client_gstin: str

    # Currency
    currency: SupportedCurrency
    exchange_rate: float
    exchange_rate_date: str
    inr_subtotal: float
    inr_grand_total: float
    inr_net_receivable: Optional[float]

    # Statutory
    declarations: List[str]
    warnings: List[str]

    # Detailed items
    line_items: List[CalculatedLineItem]
