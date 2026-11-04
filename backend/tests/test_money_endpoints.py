"""Endpoint-level tests for the money paths.

Covers the audit contract: record-payment validation (overpay, terminal
statuses, UTR shape, duplicate mapping), the atomic invoice create via the
service-role RPC, the 200-line payload cap, project-create status validation,
and invalid invoice transitions mapping to 400.
"""
import unittest
import warnings
import jwt
from unittest.mock import patch

with warnings.catch_warnings():
    warnings.filterwarnings("ignore", category=DeprecationWarning)
    from fastapi.testclient import TestClient

try:
    from backend.app.main import app
    from backend.app.core.config import settings
except ImportError:
    from app.main import app
    from app.core.config import settings


class FakeRes:
    def __init__(self, data):
        self.data = data

    def execute(self):
        return self


class FakeTable:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def is_(self, *_a, **_k):
        return self

    def execute(self):
        return FakeRes(self._rows)


class FakeDBError(Exception):
    """Duck-typed postgrest.APIError (carries .code / .message)."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


class FakeSupabase:
    def __init__(self, tables=None, rpc_result=None, rpc_error=None):
        self.tables = tables or {}
        self._rpc_result = rpc_result
        self._rpc_error = rpc_error
        self.rpc_calls = []

    def table(self, name):
        return FakeTable(self.tables.get(name, []))

    def rpc(self, name, params):
        self.rpc_calls.append((name, params))
        if self._rpc_error is not None:
            raise self._rpc_error
        return FakeRes(self._rpc_result)


def _token():
    # security.py trusts only app_metadata.workspace_id.
    return jwt.encode(
        {"sub": "usr-1", "app_metadata": {"workspace_id": "ws-1"}, "role": "authenticated"},
        settings.SUPABASE_JWT_SECRET,
        algorithm="HS256",
    )


class BaseEndpointCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.headers = {"Authorization": f"Bearer {_token()}"}


OPEN_INVOICE = {"id": "inv-1", "status": "sent", "total": 100.0, "outstanding_balance": 100.0}


class TestRecordPayment(BaseEndpointCase):
    def _post(self, fake, payload):
        with patch("backend.app.api.v1.payments.get_supabase_client", return_value=fake):
            return self.client.post("/api/v1/payments", json=payload, headers=self.headers)

    def test_records_payment_via_reconcile_rpc(self):
        fake = FakeSupabase(tables={"invoices": [OPEN_INVOICE]},
                            rpc_result={"payment_id": "pay-1", "status": "completed"})
        resp = self._post(fake, {"invoice_id": "inv-1", "amount": 100.0, "transaction_reference": "123456789012"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["payment_id"], "pay-1")
        self.assertEqual(fake.rpc_calls[0][0], "reconcile_gateway_payment")
        self.assertEqual(fake.rpc_calls[0][1]["p_transaction_id"], "123456789012")

    def test_rejects_amount_above_outstanding(self):
        fake = FakeSupabase(tables={"invoices": [OPEN_INVOICE]})
        resp = self._post(fake, {"invoice_id": "inv-1", "amount": 100.01})
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(fake.rpc_calls)

    def test_rejects_settled_invoice(self):
        fake = FakeSupabase(tables={"invoices": [{"id": "inv-1", "status": "paid", "total": 100.0, "outstanding_balance": 0.0}]})
        resp = self._post(fake, {"invoice_id": "inv-1", "amount": 10.0})
        self.assertEqual(resp.status_code, 400)

    def test_rejects_malformed_utr(self):
        fake = FakeSupabase(tables={"invoices": [OPEN_INVOICE]})
        resp = self._post(fake, {"invoice_id": "inv-1", "amount": 10.0, "transaction_reference": "NOT-A-UTR"})
        self.assertEqual(resp.status_code, 400)

    def test_maps_duplicate_utr_to_409(self):
        fake = FakeSupabase(tables={"invoices": [OPEN_INVOICE]},
                            rpc_error=FakeDBError("23505", "duplicate key value violates unique constraint"))
        resp = self._post(fake, {"invoice_id": "inv-1", "amount": 50.0})
        self.assertEqual(resp.status_code, 409)


INVOICE_PAYLOAD = {
    "project_id": "proj-1",
    "client_id": "cli-1",
    "invoice_number": "INV-0001",
    "invoice_date": "2026-11-03",
    "due_date": "2026-11-17",
    "items": [{"description": "UI redesign", "quantity": 1, "rate": 10000.0, "gst_rate": 18.0}],
}


class TestCreateInvoice(BaseEndpointCase):
    def _post(self, fake, payload):
        with patch("backend.app.api.v1.invoices.get_supabase_client", return_value=fake):
            return self.client.post("/api/v1/invoices", json=payload, headers=self.headers)

    def test_creates_invoice_via_service_role_rpc(self):
        fake = FakeSupabase(
            tables={
                "workspace_settings": [{"is_gst_registered": True, "gstin": "29ABCDE1234F1Z5",
                                        "state": "Karnataka", "tax_scheme": "regular"}],
                "clients": [{"id": "cli-1", "gstin": "29XYZAB5678K1Z3", "state": "Karnataka"}],
            },
            rpc_result={"invoice": {"id": "inv-1", "status": "draft"},
                        "invoice_items": [{"description": "UI redesign"}]},
        )
        resp = self._post(fake, INVOICE_PAYLOAD)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(fake.rpc_calls[0][0], "create_invoice_transactional_service")
        self.assertEqual(fake.rpc_calls[0][1]["p_invoice_data"]["workspace_id"], "ws-1")
        self.assertEqual(resp.json()["id"], "inv-1")
        self.assertEqual(resp.json()["line_items"][0]["description"], "UI redesign")
        # Item payload mirrors line_total into the legacy amount column.
        self.assertEqual([line["amount"] for line in fake.rpc_calls[0][1]["p_invoice_items"]], [11800.0])

    def test_maps_duplicate_invoice_number_to_409(self):
        fake = FakeSupabase(
            tables={
                "workspace_settings": [{}],
                "clients": [{"id": "cli-1"}],
            },
            rpc_error=FakeDBError("23505", "duplicate key value violates unique constraint"),
        )
        resp = self._post(fake, INVOICE_PAYLOAD)
        self.assertEqual(resp.status_code, 409)

    def test_rejects_payload_with_over_200_line_items(self):
        fake = FakeSupabase(tables={})
        payload = {
            **INVOICE_PAYLOAD,
            "items": [{"description": f"Item {i}", "quantity": 1, "rate": 1.0, "gst_rate": 18.0} for i in range(201)],
        }
        resp = self._post(fake, payload)
        self.assertEqual(resp.status_code, 422)
        self.assertFalse(fake.rpc_calls)


class TestProjectCreate(BaseEndpointCase):
    def test_rejects_unknown_status(self):
        fake = FakeSupabase(tables={})
        with patch("backend.app.api.v1.projects.get_supabase_client", return_value=fake):
            resp = self.client.post(
                "/api/v1/projects",
                json={"client_id": "c1", "name": "Logo", "status": "quantum"},
                headers=self.headers,
            )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Invalid project status", resp.json()["detail"])
        # Rejected before any DB write.
        self.assertFalse(fake.rpc_calls)


class TestInvoiceStatusTransition(BaseEndpointCase):
    def test_rejects_invalid_transition(self):
        fake = FakeSupabase(tables={"invoices": [{"status": "paid"}]})
        with patch("backend.app.api.v1.invoices.get_supabase_client", return_value=fake):
            resp = self.client.put(
                "/api/v1/invoices/inv-1/status",
                json={"status": "draft"},
                headers=self.headers,
            )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Invalid invoice state transition", resp.json()["detail"])


if __name__ == "__main__":
    unittest.main()
