"""Ujrat Lifecycle State Machines in Python.
Guarantees authoritative server-side validation of Project, Invoice, Payment, Contract, and Proposal transitions.
"""
from typing import Dict, List, Any, Optional


class StateMachineError(Exception):
    """Raised when an invalid state transition is attempted."""
    pass


class StateMachine:
    def __init__(self, allowed: Dict[str, List[str]], action_name: str, error_context: str = "state"):
        self.allowed = allowed
        self.action_name = action_name
        self.error_context = error_context

    def validate(self, current: str, next_state: str) -> bool:
        if current == next_state:
            return True
        return next_state in self.allowed.get(current, [])

    def transition(self, current: str, next_state: str, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.validate(current, next_state):
            raise StateMachineError(
                f"Invalid {self.error_context} transition from '{current}' to '{next_state}'"
            )
        return {
            "next": next_state,
            "activity_log": {
                "action": self.action_name,
                "details": {**(details or {}), "from": current, "to": next_state},
            },
        }


ProjectStateMachine = StateMachine(
    allowed={
        "lead": ["proposal", "archived"],
        "proposal": ["approved", "archived"],
        "approved": ["contract_signed", "archived"],
        "contract_signed": ["advance_paid", "in_progress", "archived"],
        "advance_paid": ["in_progress", "archived"],
        "in_progress": ["delivered", "archived"],
        "delivered": ["invoice_sent", "archived"],
        "invoice_sent": ["paid", "archived", "delivered"],
        "paid": ["completed", "archived"],
        "completed": ["archived"],
        "archived": ["lead", "proposal", "in_progress"],
    },
    action_name="Project Status Updated",
    error_context="project state",
)

ProposalStateMachine = StateMachine(
    allowed={
        "draft": ["sent"],
        "sent": ["approved", "rejected", "revision_requested"],
        "approved": ["draft", "sent"],
        "rejected": ["draft", "sent"],
        "revision_requested": ["draft", "sent"],
    },
    action_name="Proposal Status Updated",
    error_context="proposal state",
)

InvoiceStateMachine = StateMachine(
    allowed={
        "draft": ["sent", "pending_verification", "cancelled"],
        "sent": ["viewed", "pending_verification", "paid", "overdue", "cancelled"],
        "viewed": ["pending_verification", "paid", "overdue", "cancelled"],
        "pending_verification": ["paid", "sent", "overdue", "cancelled"],
        "paid": [],
        "overdue": ["paid", "cancelled"],
        "cancelled": [],
    },
    action_name="Invoice Status Updated",
    error_context="invoice state",
)

PaymentStateMachine = StateMachine(
    allowed={
        "pending": ["pending_verification", "completed", "failed"],
        "pending_verification": ["completed", "failed"],
        "completed": [],
        "failed": [],
    },
    action_name="Payment Status Updated",
    error_context="payment state",
)

PaymentRequestStateMachine = StateMachine(
    allowed={
        "pending": ["viewed", "initiated", "cancelled", "expired"],
        "viewed": ["initiated", "awaiting_verification", "cancelled", "expired"],
        "initiated": ["awaiting_verification", "cancelled", "expired"],
        "awaiting_verification": ["verified", "rejected", "initiated", "paid", "cancelled"],
        "verified": ["paid", "rejected"],
        "rejected": ["initiated", "cancelled"],
        "paid": [],
        "cancelled": [],
        "expired": [],
    },
    action_name="Payment Request Lifecycle Updated",
    error_context="payment request",
)

ContractStateMachine = StateMachine(
    allowed={
        "draft": ["sent", "void"],
        "sent": ["signed", "void"],
        "signed": ["void"],
        "void": ["draft"],
    },
    action_name="Contract Status Updated",
    error_context="contract state",
)
