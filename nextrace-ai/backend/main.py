"""
NEXTRACE AI — FastAPI Application Entry Point
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.health import router as health_router
from backend.api.live import router as live_router
from backend.api.forecast import router as forecast_router
from backend.api.websocket_handler import router as ws_router
from backend.api.historical import router as historical_router
from backend.api.forensic import router as forensic_router
from backend.api.simulator import router as simulator_router

app = FastAPI(
    title="NEXTRACE AI Backend",
    description="Network Attack Forecasting & Forensic Intelligence — Demo Backend",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── CORS — allow local Vite dev server ────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",  # Vite preview
    ],
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
