"""API v1 routers."""
from fastapi import APIRouter
from backend.app.api.v1 import tax, payments, clients, projects, invoices, portal

api_router = APIRouter()
api_router.include_router(tax.router, prefix="/tax", tags=["tax"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
api_router.include_router(portal.router, prefix="/portal", tags=["portal"])
