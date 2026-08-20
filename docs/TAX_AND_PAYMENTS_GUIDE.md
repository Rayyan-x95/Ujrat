# 🇮🇳 Indian GST & UPI Payments Engineering Guide

This guide details the mathematical and legal standards implemented in Ujrat's **Tax Calculation Engine** and **Zero-Fee UPI Payment System**.

---

## 1. Indian GST Compliance Architecture

### 1.1 Interstate vs Intrastate Determination & Place of Supply Rules
Under the Indian Integrated Goods and Services Tax (IGST) Act, 2017 (specifically Section 12 for domestic service supplies), the tax type depends on the **Location of the Supplier** vs the **Place of Supply (Recipient's Location)**:
* **B2B Registered Clients**: The place of supply is the location of the registered recipient (identified by the client's 2-digit GSTIN state prefix).
* **B2C / Unregistered Clients**: The place of supply is the recipient's address on record (or the supplier's state if client location is absent).

```
IF supplier.state_code == client.state_code THEN
    TAX = CGST (Central GST) + SGST/UTGST (State/Union Territory GST)
    Rate Split = Standard GST Rate / 2  (e.g., 18% -> 9% CGST + 9% SGST)
ELSE
    TAX = IGST (Integrated GST)
    Rate = Full Standard GST Rate       (e.g., 18% -> 18% IGST)
END IF
```

### 1.2 Common Freelance HSN/SAC Codes
* **`998314`**: IT design and development services (Web/App development)
* **`998313`**: Information technology consulting and support services
* **`998391`**: Specialty design services (UI/UX, Graphic Design, Branding)
* **`998399`**: Other professional, technical and business services
* **`998431`**: On-line content provision and copywriting services

### 1.3 Tax Deduction at Source (TDS)
For corporate clients deducting TDS before invoice settlement under the Income-tax Act, 1961:
* **Section 194J (Fees for Professional / Technical Services)**: **10%** for professional fees; **2%** for technical/FTS services.
* **Section 194C (Payments to Contractors / Deliverables)**: **1%** for Individuals/HUF, **2%** for Companies/LLPs.
* **Section 194H (Commission or Brokerage)**: **2%** (reduced from 5% under Finance Act (No. 2), 2024, effective October 1, 2024).
* **Net Payable Calculation**:
  $$\text{Net Payable} = (\text{Subtotal} + \text{CGST} + \text{SGST} + \text{IGST}) - \text{TDS Amount}$$

---

## 2. Zero-Fee UPI Payment System

### 2.1 NPCI UPI Deep Link Specification
Ujrat compiles official NPCI-compliant UPI payment URIs that trigger native UPI applications on mobile and generate dynamic SVG QR codes on desktop:

```text
upi://pay?pa={vpa}&pn={payeeName}&am={amount}&cu=INR&tn={transactionNote}&tr={invoiceNumber}
```

#### Parameter Breakdown:
* **`pa`** (Payee Address): UPI VPA (e.g. `designer@okhdfcbank`, `9876543210@paytm`)
* **`pn`** (Payee Name): Registered business name or freelancer name (URL-encoded)
* **`am`** (Amount): Total invoice value in INR with exactly 2 decimal places (e.g. `50000.00`)
* **`cu`** (Currency): Must be strictly `INR`
* **`tn`** (Transaction Note): Max 80 characters (e.g. `Payment for INV-042 - Ujrat`)
* **`tr`** (Transaction Reference ID): Unique invoice reference or payment intent ID

### 2.2 App-Specific Intent Handlers
Ujrat enables 1-tap direct app routing for mobile browsers:
* **Google Pay**: `gpay://upi/pay?...`
* **PhonePe**: `phonepe://pay?...`
* **Paytm**: `paytmmp://pay?...`
* **BHIM**: `bhim://pay?...`
* **Universal UPI Intent**: `upi://pay?...` (triggers OS intent chooser)

---

## 3. Financial Invariant Guarantees

1. **Floating-Point Precision**: All currency math uses whole-number paise or `round(val, 2)` banker's rounding to eliminate floating point drift (`0.1 + 0.2 != 0.3`).
2. **Zero Gateway Deductions**: Direct P2P/P2M settlement guarantees **100%** freelancer revenue retention with 0% intermediate gateway fee leakage.
