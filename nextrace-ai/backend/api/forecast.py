"""NEXTRACE AI — Forecast REST API"""
from fastapi import APIRouter

from backend.services.live_session import live_session

router = APIRouter()


@router.get("/forecast/current")
async def get_current_forecast() -> dict:
    """
    Return the most recent forecast from the rule-based engine.

    When no session is active, returns a placeholder 'No Active Session' result.
    All results are clearly labelled as deterministic demo predictions.
    """
    return live_session.get_current_forecast()
