"""Unit tests for Python backend domain services."""
import unittest
from backend.app.schemas.tax import (
    TaxCalculationRequest,
    FreelancerTaxProfile,
    ClientTaxProfile,
    InvoiceItemTaxInput,
    TDSInput,
    InvoiceDiscountInput,
)
from backend.app.services.tax_engine import (
    calculate_invoice_tax,
    validate_tax_calculation,
    validate_gstin_format,
    extract_pan_from_gstin,
)
from backend.app.services.upi_service import UPIService, UPILinkParams
from backend.app.services.state_machines import (
    ProjectStateMachine,
    InvoiceStateMachine,
    PaymentStateMachine,
    StateMachineError,
)


class TestTaxEngine(unittest.TestCase):
    def test_intra_state_gst_split(self):
        req = TaxCalculationRequest(
            freelancer=FreelancerTaxProfile(is_gst_registered=True, state="Karnataka", gstin="29AAAAA1111A1Z1"),
            client=ClientTaxProfile(state="Karnataka", gstin="29BBBBB2222B1Z2"),
            items=[InvoiceItemTaxInput(description="Design", quantity=1, rate=10000, gst_rate=18)],
        )
        res = calculate_invoice_tax(req)
        self.assertEqual(res.place_of_supply, "intra_state")
        self.assertEqual(res.taxable_amount, 10000.0)
        self.assertEqual(res.cgst, 900.0)
        self.assertEqual(res.sgst, 900.0)
        self.assertEqual(res.igst, 0.0)
        self.assertEqual(res.grand_total, 11800.0)
        val = validate_tax_calculation(res)
        self.assertTrue(val["is_valid"])

    def test_inter_state_igst(self):
        req = TaxCalculationRequest(
            freelancer=FreelancerTaxProfile(is_gst_registered=True, state="Karnataka", gstin="29AAAAA1111A1Z1"),
            client=ClientTaxProfile(state="Maharashtra", gstin="27BBBBB2222B1Z2"),
            items=[InvoiceItemTaxInput(description="Engineering", quantity=2, rate=25000, gst_rate=18)],
        )
        res = calculate_invoice_tax(req)
        self.assertEqual(res.place_of_supply, "inter_state")
        self.assertEqual(res.taxable_amount, 50000.0)
        self.assertEqual(res.cgst, 0.0)
        self.assertEqual(res.sgst, 0.0)
        self.assertEqual(res.igst, 9000.0)
        self.assertEqual(res.grand_total, 59000.0)

    def test_export_under_lut(self):
        req = TaxCalculationRequest(
            freelancer=FreelancerTaxProfile(is_gst_registered=True, state="Karnataka", lut_number="AD290324000123L"),
            client=ClientTaxProfile(country="United States", state="California"),
            items=[InvoiceItemTaxInput(description="US Export", quantity=1, rate=100000, gst_rate=18)],
        )
        res = calculate_invoice_tax(req)
        self.assertEqual(res.place_of_supply, "export")
        self.assertEqual(res.supply_type, "zero_rated_lut")
        self.assertEqual(res.total_gst, 0.0)
        self.assertIn("SUPPLY MEANT FOR EXPORT UNDER BOND OR LETTER OF UNDERTAKING", res.declarations[0])

    def test_tds_194j_calculation(self):
        req = TaxCalculationRequest(
            freelancer=FreelancerTaxProfile(is_gst_registered=True, state="Karnataka", gstin="29AAAAA1111A1Z1"),
            client=ClientTaxProfile(state="Karnataka", gstin="29BBBBB2222B1Z2"),
            items=[InvoiceItemTaxInput(description="Consulting", quantity=1, rate=100000, gst_rate=18)],
            tds=TDSInput(section="194J", rate=10),
        )
        res = calculate_invoice_tax(req)
        self.assertEqual(res.tds_amount, 10000.0)
        self.assertEqual(res.net_receivable, 108000.0)

    def test_gstin_and_pan_validation(self):
        val = validate_gstin_format("29AAAAA1111A1Z1")
        self.assertTrue(val["is_valid"])
        self.assertEqual(val["state_name"], "Karnataka")
        self.assertEqual(val["pan"], "AAAAA1111A")
        self.assertEqual(extract_pan_from_gstin("29AAAAA1111A1Z1"), "AAAAA1111A")


class TestUPIService(unittest.TestCase):
    def test_upi_deep_link_generation(self):
        params = UPILinkParams(
            payee_vpa="freelancer@upi",
            payee_name="Jane Doe",
            amount=5000.0,
            invoice_number="INV-001",
            note="Project Milestone",
        )
        link = UPIService.generate_deep_link(params)
        self.assertTrue(link.startswith("upi://pay?"))
        self.assertIn("pa=freelancer%40upi", link)
        self.assertIn("am=5000.00", link)
        self.assertIn("cu=INR", link)

    def test_utr_validation(self):
        self.assertTrue(UPIService.validate_utr("123456789012"))
        self.assertFalse(UPIService.validate_utr("12345"))
        self.assertFalse(UPIService.validate_utr("12345678901A"))


class TestStateMachines(unittest.TestCase):
    def test_invoice_transitions(self):
        self.assertTrue(InvoiceStateMachine.validate("draft", "sent"))
        self.assertTrue(InvoiceStateMachine.validate("sent", "paid"))
        self.assertFalse(InvoiceStateMachine.validate("paid", "draft"))
        with self.assertRaises(StateMachineError):
            InvoiceStateMachine.transition("paid", "draft")

    def test_project_transitions(self):
        self.assertTrue(ProjectStateMachine.validate("lead", "proposal"))
        self.assertTrue(ProjectStateMachine.validate("in_progress", "delivered"))
        self.assertFalse(ProjectStateMachine.validate("lead", "completed"))


if __name__ == "__main__":
    unittest.main()
