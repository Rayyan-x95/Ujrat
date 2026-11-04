"""Cross-implementation tax parity on a golden fixture.

The Python Tax Engine 2.0 and the TypeScript InvoiceCalculator must agree
exactly. Both suites read the same file (frontend/src/__tests__/tax-parity.json)
so a change to either engine that diverges fails here - the money lanes follow
the Python engine, statutory output the TypeScript one.
"""
import json
import unittest
from pathlib import Path

try:
    from backend.app.schemas.tax import TaxCalculationRequest
    from backend.app.services.tax_engine import calculate_invoice_tax
except ImportError:
    from app.schemas.tax import TaxCalculationRequest
    from app.services.tax_engine import calculate_invoice_tax

FIXTURE = Path(__file__).parents[2] / "frontend" / "src" / "__tests__" / "tax-parity.json"

NUMERIC_KEYS = (
    "subtotal", "discount_amount", "post_tax_discount", "taxable_amount",
    "cgst", "sgst", "igst", "cess", "total_gst", "round_off", "grand_total",
    "tds_rate", "tds_amount", "net_receivable", "inr_grand_total",
)
EXACT_KEYS = (
    "discount_type", "discount_scope", "is_interstate", "is_zero_rated",
    "is_reverse_charge", "place_of_supply", "supply_type", "tax_scheme", "currency",
)


class TaxEngineParityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(FIXTURE, encoding="utf-8") as fh:
            cls.cases = json.load(fh)["cases"]

    def test_matches_golden_fixture(self):
        for case in self.cases:
            with self.subTest(case=case["name"]):
                payload = {k: v for k, v in case["input"].items() if v is not None}
                result = calculate_invoice_tax(TaxCalculationRequest(**payload))
                actual = result.model_dump()

                # Sanity: the case must exercise real money, not all zeros.
                self.assertGreater(actual["taxable_amount"], 0)

                for key in NUMERIC_KEYS:
                    if key in case["expected"]:
                        self.assertEqual(actual[key], case["expected"][key], f"{case['name']}: {key}")
                for key in EXACT_KEYS:
                    if key in case["expected"]:
                        self.assertEqual(actual[key], case["expected"][key], f"{case['name']}: {key}")


if __name__ == "__main__":
    unittest.main()
