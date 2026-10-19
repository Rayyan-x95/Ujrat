"""Integration tests for FastAPI endpoints."""
import unittest
import warnings
import jwt

with warnings.catch_warnings():
    warnings.filterwarnings("ignore", category=DeprecationWarning)
    from fastapi.testclient import TestClient

try:
    from backend.app.main import app
    from backend.app.core.config import settings
except ImportError:
    from app.main import app
    from app.core.config import settings


class TestFastAPIEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        # Generate valid mock Bearer JWT
        cls.token = jwt.encode(
            {"sub": "usr-12345", "email": "test@ujrat.in", "workspace_id": "ws-12345", "role": "authenticated"},
            settings.SUPABASE_JWT_SECRET,
            algorithm="HS256",
        )
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

    def test_health_check(self):
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("timestamp", data)

    def test_tax_calculate_endpoint(self):
        payload = {
            "freelancer": {
                "is_gst_registered": True,
                "state": "Karnataka",
                "gstin": "29AAAAA1111A1Z1",
            },
            "client": {
                "state": "Karnataka",
                "gstin": "29BBBBB2222B1Z2",
            },
            "items": [
                {
                    "description": "API Integration",
                    "quantity": 1,
                    "rate": 10000,
                    "gst_rate": 18,
                }
            ],
        }
        resp = self.client.post("/api/v1/tax/calculate", json=payload, headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["place_of_supply"], "intra_state")
        self.assertEqual(data["cgst"], 900.0)
        self.assertEqual(data["sgst"], 900.0)
        self.assertEqual(data["grand_total"], 11800.0)

    def test_tax_validate_gstin(self):
        resp = self.client.post(
            "/api/v1/tax/validate-gstin",
            json={"gstin": "29AAAAA1111A1Z1"},
            headers=self.headers,
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["is_valid"])
        self.assertEqual(data["state_name"], "Karnataka")
        self.assertEqual(data["pan"], "AAAAA1111A")

    def test_upi_deep_link_generation(self):
        payload = {
            "payee_vpa": "agency@upi",
            "payee_name": "Agency",
            "amount": 2500.0,
            "invoice_number": "INV-2026-001",
        }
        resp = self.client.post("/api/v1/payments/upi/deep-link", json=payload, headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["deep_link_uri"].startswith("upi://pay?"))
        self.assertTrue(data["gpay_link"].startswith("tez://upi/pay?"))

    def test_upi_utr_verification(self):
        resp = self.client.post(
            "/api/v1/payments/upi/verify-utr",
            json={"utr": "123456789012"},
            headers=self.headers,
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["is_valid"])


if __name__ == "__main__":
    unittest.main()
