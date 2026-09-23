"""
NEXTRACE AI — Forensic Analysis API Router
Isolated from live-session, forecast, and investigation endpoints.

Endpoints:
  POST /api/forensic/{historical_job_id}/analyze
  GET  /api/forensic/{historical_job_id}/status
  GET  /api/forensic/{historical_job_id}/result

The forensic module consumes the completed historical result.
It does NOT re-parse the PCAP file.
It does NOT return partial final assessments before analysis is complete.
"""
from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

# Import historical job registry — read-only, never modified here
from backend.api.historical import _JOBS as _HIST_JOBS

router = APIRouter(prefix="/forensic", tags=["Forensic Analysis"])

# ── In-memory forensic registry ────────────────────────────────────────────────
# Keyed by historical_job_id. COMPLETELY isolated from live/forecast/investigation.
_FORENSIC_JOBS: dict[str, dict[str, Any]] = {}


def _get_completed_hist_job(historical_job_id: str) -> dict[str, Any]:
    """
    Retrieve a completed historical job or raise an appropriate HTTP error.
    Forensic analysis requires a completed (not just queued/processing) job.
    """
    hist_job = _HIST_JOBS.get(historical_job_id)
    if not hist_job:
        raise HTTPException(
            status_code=404,
            detail=f"Historical job '{historical_job_id}' not found."
        )
    if hist_job["status"] == "failed":
        raise HTTPException(
            status_code=422,
            detail=(
                f"Historical job '{historical_job_id}' failed during processing. "
                f"Forensic analysis requires a successfully completed historical job."
            )
        )
    if hist_job["status"] != "completed":
        raise HTTPException(
            status_code=409,
            detail=(
                f"Historical job '{historical_job_id}' is not yet complete "
                f"(status: {hist_job['status']}, progress: {hist_job['progress']:.0f}%). "
                f"Forensic analysis can only start after historical analysis completes."
            )
        )
    result = hist_job.get("result")
    if not result:
        raise HTTPException(
            status_code=500,
            detail="Historical result is missing despite completed status."
        )
    return hist_job


# ── Background forensic runner ─────────────────────────────────────────────────

async def _run_forensic_async(historical_job_id: str) -> None:
    """
    Runs forensic analysis in a thread pool to avoid blocking the event loop.
    Stages: integrity → evidence_summary → anti_forensic → hypotheses → assessment
    """
    stages = [
        ("building_integrity",    15),
        ("evidence_summary",      35),
        ("anti_forensic_scan",    55),
        ("hypothesis_evaluation", 75),
        ("final_assessment",      90),
    ]

    def _update(stage: str, pct: int) -> None:
        if historical_job_id in _FORENSIC_JOBS:
            _FORENSIC_JOBS[historical_job_id]["current_stage"] = stage
            _FORENSIC_JOBS[historical_job_id]["progress"] = pct

    def _run() -> None:
        try:
            _update("building_integrity", 10)
            hist_job = _HIST_JOBS.get(historical_job_id)
            if not hist_job or hist_job.get("status") != "completed":
                raise ValueError("Historical job not in completed state.")

            hist_result = hist_job["result"]
            if not hist_result:
                raise ValueError("Historical result is empty.")

            from backend.forensic.analyzer import run_forensic_analysis

            # Simulate brief stage delays for realistic UX
            import time as _time

            _update("building_integrity", 15)
            _time.sleep(0.15)

            _update("evidence_summary", 35)
            _time.sleep(0.10)

            _update("anti_forensic_scan", 55)
            _time.sleep(0.10)

            _update("hypothesis_evaluation", 75)
            _time.sleep(0.10)

            _update("final_assessment", 90)

            # Run the full analysis
            forensic_result = run_forensic_analysis(hist_job, hist_result)

            _FORENSIC_JOBS[historical_job_id]["result"]       = forensic_result
            _FORENSIC_JOBS[historical_job_id]["status"]       = "completed"
            _FORENSIC_JOBS[historical_job_id]["progress"]     = 100
            _FORENSIC_JOBS[historical_job_id]["current_stage"]= "completed"
            _FORENSIC_JOBS[historical_job_id]["completed_at"] = _time.time()

        except Exception as exc:
            if historical_job_id in _FORENSIC_JOBS:
                _FORENSIC_JOBS[historical_job_id]["status"]       = "failed"
                _FORENSIC_JOBS[historical_job_id]["error"]        = str(exc)
                _FORENSIC_JOBS[historical_job_id]["current_stage"]= "failed"

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _run)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/{historical_job_id}/analyze")
async def start_forensic_analysis(historical_job_id: str) -> JSONResponse:
    """
    Start forensic analysis for a completed historical job.
    Returns immediately with forensic job metadata (202 Accepted).
    """
    # Validate that historical job is completed — raises 404/409/422 if not.
    _get_completed_hist_job(historical_job_id)

    # Idempotent: if already running or completed, return existing state
    existing = _FORENSIC_JOBS.get(historical_job_id)
    if existing and existing["status"] not in ("failed",):
        return JSONResponse({
            "historical_job_id": historical_job_id,
            "status":            existing["status"],
            "progress":          existing["progress"],
            "message":           "Forensic analysis already exists for this job.",
        }, status_code=200)

    # Create forensic job record
    _FORENSIC_JOBS[historical_job_id] = {
        "historical_job_id": historical_job_id,
        "forensic_id":       f"FA-{str(uuid.uuid4())[:8].upper()}",
        "status":            "queued",
        "progress":          0,
        "current_stage":     "queued",
        "error":             None,
        "result":            None,
        "created_at":        time.time(),
        "completed_at":      None,
    }

    asyncio.create_task(_run_forensic_async(historical_job_id))

    return JSONResponse({
        "historical_job_id": historical_job_id,
        "forensic_id":       _FORENSIC_JOBS[historical_job_id]["forensic_id"],
        "status":            "queued",
        "message":           "Forensic analysis started.",
    }, status_code=202)


@router.get("/{historical_job_id}/status")
async def get_forensic_status(historical_job_id: str) -> JSONResponse:
    """
    Poll forensic analysis progress.
    Returns status, progress, and current_stage.
    """
    fjob = _FORENSIC_JOBS.get(historical_job_id)
    if not fjob:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No forensic analysis found for historical job '{historical_job_id}'. "
                f"POST /api/forensic/{historical_job_id}/analyze to start one."
            )
        )

    return JSONResponse({
        "historical_job_id": historical_job_id,
        "forensic_id":       fjob.get("forensic_id"),
        "status":            fjob["status"],
        "progress":          fjob["progress"],
        "current_stage":     fjob["current_stage"],
        "error":             fjob.get("error"),
        "created_at":        fjob.get("created_at"),
        "completed_at":      fjob.get("completed_at"),
    })


@router.get("/{historical_job_id}/result")
async def get_forensic_result(historical_job_id: str) -> JSONResponse:
    """
    Return the complete forensic analysis result.
    Only available after status is 'completed'.
    Does NOT return partial final assessments.
    """
    fjob = _FORENSIC_JOBS.get(historical_job_id)
    if not fjob:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No forensic analysis found for job '{historical_job_id}'. "
                f"POST /api/forensic/{historical_job_id}/analyze to start."
            )
        )

    if fjob["status"] == "failed":
        raise HTTPException(
            status_code=422,
            detail=f"Forensic analysis failed: {fjob.get('error', 'Unknown error')}",
        )

    if fjob["status"] != "completed":
        raise HTTPException(
            status_code=409,
            detail=(
                f"Forensic analysis not yet complete. "
                f"Status: {fjob['status']} ({fjob['progress']}%). "
                f"Poll GET /api/forensic/{historical_job_id}/status."
            ),
        )

    result = fjob.get("result")
    if not result:
        raise HTTPException(
            status_code=500,
            detail="Forensic result is missing despite completed status."
        )

    return JSONResponse({
        "historical_job_id": historical_job_id,
        "forensic_id":       fjob.get("forensic_id"),
        "status":            "completed",
        "created_at":        fjob.get("created_at"),
        "completed_at":      fjob.get("completed_at"),
        "result":            result,
    })
