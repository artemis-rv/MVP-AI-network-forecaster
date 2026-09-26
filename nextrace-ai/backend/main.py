"""
NEXTRACE AI — FastAPI Application Entry Point
"""
from __future__ import annotations

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ... other imports ...
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

app = FastAPI(
    title="NEXTRACE AI Backend",
    description="Network Attack Forecasting & Forensic Intelligence — Demo Backend",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── CORS — allow local Vite dev server and production frontend ────────────────────────
# You can pass FRONTEND_URL like FRONTEND_URL="https://my-frontend.vercel.app,http://localhost:5173"
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4173",  # Vite preview
]
if os.environ.get("FRONTEND_URL"):
    allowed_origins.extend(os.environ.get("FRONTEND_URL", "").split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
