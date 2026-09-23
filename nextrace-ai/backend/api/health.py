"""NEXTRACE AI — Health API"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "mode": "demo", "version": "0.1.0"}
