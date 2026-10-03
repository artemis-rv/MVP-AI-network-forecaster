"""
NEXTRACE AI — FastAPI Application Entry Point
"""
from __future__ import annotations

import os
from pathlib import Path
import sys

_parent_dir = str(Path(__file__).resolve().parent.parent)
if _parent_dir not in sys.path:
    sys.path.insert(0, _parent_dir)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.health import router as health_router
from backend.api.live import router as live_router
from backend.api.forecast import router as forecast_router
from backend.api.websocket_handler import router as ws_router
from backend.api.historical import router as historical_router
from backend.api.forensic import router as forensic_router
from backend.api.simulator import router as simulator_router
from backend.api.reports import router as reports_router
from backend.api.admin import router as admin_router
from backend.api.alerts import router as alerts_router
from backend.api.explain import router as explain_router

app = FastAPI(
    title="NEXTRACE AI Backend",
    description="Network Attack Forecasting & Forensic Intelligence — Demo Backend",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── CORS — allow local dev servers, Vercel apps, and custom domains ───────
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4173",  # Vite preview
]
if os.environ.get("FRONTEND_URL"):
    custom_origins = [o.strip() for o in os.environ.get("FRONTEND_URL", "").split(",") if o.strip()]
    allowed_origins.extend(custom_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────
app.include_router(health_router,     prefix="/api")
app.include_router(live_router,       prefix="/api")
app.include_router(forecast_router,   prefix="/api")
app.include_router(ws_router)
app.include_router(historical_router, prefix="/api")
app.include_router(forensic_router,   prefix="/api")
app.include_router(simulator_router,  prefix="/api")
app.include_router(reports_router,    prefix="/api")
app.include_router(admin_router,      prefix="/api")
app.include_router(alerts_router,     prefix="/api")
app.include_router(explain_router,    prefix="/api")


# ── Baseline security headers on every API response ───────────
@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.get("/")
async def root() -> dict:
    return {
        "product": "NEXTRACE AI",
        "tagline": "Predict. Trace. Secure.",
        "mode":    "demo",
        "docs":    "/api/docs",
    }


# ── Dev runner ────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info",
    )
