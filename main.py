"""Ujrat Operations API - Root ASGI Application Entrypoint.
Imports and exposes the authoritative FastAPI app for Render / PaaS deployment.
"""
import sys
import os

# Ensure root directory is on Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from backend.app.main import app

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
