"""
NEXTRACE AI — Historical Analysis API Router
Isolated from live-session and forecast endpoints.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/historical", tags=["Historical Analysis"])

# ── In-memory job registry ─────────────────────────────────────────────────────
# Keyed by job_id. Never shares state with live_session.py.
_JOBS: dict[str, dict[str, Any]] = {}

_ALLOWED_EXTENSIONS = {".pcap", ".pcapng", ".cap", ".gz", ".dmp"}
_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB guard


# ── Helpers ───────────────────────────────────────────────────────────────────

def _new_job(
    filename: str,
    file_size: int,
    is_demo: bool = False,
    sha256: str | None = None,
    upload_at: float | None = None,
) -> dict[str, Any]:
    job_id = f"HIST-{str(uuid.uuid4())[:8].upper()}"
    now = upload_at or time.time()
    _JOBS[job_id] = {
        "job_id":             job_id,
        "filename":           filename,
        "file_size":          file_size,
        "is_demo":            is_demo,
        "sha256":             sha256,               # None for demo until simulated
        "upload_timestamp":   now,
        "processing_start":   None,
        "status":             "queued",
        "progress":           0.0,
        "packets_processed":  0,
        "flows_detected":     0,
        "current_stage":      "queued",
        "error":              None,
        "result":             None,
        "created_at":         now,
        "completed_at":       None,
        "temp_path":          None,
    }
    return _JOBS[job_id]


def _set_progress(job_id: str, stage: str, pct: float,
                  packets: int = 0, flows: int = 0) -> None:
    if job_id in _JOBS:
        _JOBS[job_id]["status"]            = "processing" if pct < 100 else "completed"
        _JOBS[job_id]["progress"]          = round(pct, 1)
        _JOBS[job_id]["current_stage"]     = stage
        _JOBS[job_id]["packets_processed"] = packets
        _JOBS[job_id]["flows_detected"]    = flows


# ── Background processing ──────────────────────────────────────────────────────

async def _run_analysis_async(job_id: str, path: str) -> None:
    """Run PCAP analysis in a thread pool to avoid blocking the event loop."""
    job = _JOBS[job_id]

    def _progress_cb(stage: str, pct: float) -> None:
        _JOBS[job_id]["status"]        = "processing" if pct < 100 else "completed"
        _JOBS[job_id]["progress"]      = round(pct, 1)
        _JOBS[job_id]["current_stage"] = stage

    def _run() -> None:
        try:
            _JOBS[job_id]["status"]          = "parsing"
            _JOBS[job_id]["processing_start"] = time.time()
            from backend.historical.analyzer import run_analysis
            result = run_analysis(path, window_seconds=15.0, progress_callback=_progress_cb)
            _JOBS[job_id]["result"]           = result
            _JOBS[job_id]["status"]           = "completed"
            _JOBS[job_id]["progress"]         = 100.0
            _JOBS[job_id]["current_stage"]    = "completed"
            _JOBS[job_id]["packets_processed"]= result.get("packet_count", 0)
            _JOBS[job_id]["flows_detected"]   = result.get("flow_count", 0)
            _JOBS[job_id]["completed_at"]     = time.time()
        except Exception as exc:
            _JOBS[job_id]["status"]  = "failed"
            _JOBS[job_id]["error"]   = str(exc)
            _JOBS[job_id]["current_stage"] = "failed"
        finally:
            # Clean up temp file
            try:
                if path and os.path.exists(path):
                    os.unlink(path)
            except Exception:
                pass

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _run)


async def _run_demo_async(job_id: str) -> None:
    """Run demo analysis with simulated progress ticks."""
    stages = [
        ("parsing",             10.0, 0.4),
        ("parsing",             30.0, 0.3),
        ("building_flows",      50.0, 0.3),
        ("feature_engineering", 70.0, 0.3),
        ("detection",           85.0, 0.2),
        ("timeline",            95.0, 0.2),
        ("completed",          100.0, 0.0),
    ]

    _JOBS[job_id]["status"]          = "processing"
    _JOBS[job_id]["processing_start"] = time.time()
    # Assign a deterministic simulated hash for the demo dataset.
    # Clearly labelled — this is NOT a real capture hash.
    _JOBS[job_id]["sha256"] = (
        "SIMULATED:a3f8c2d1e9b4076f5ae12890cd34567890abcdef1234567890abcdef12345678"
    )

    for stage, pct, delay in stages:
        if delay:
            await asyncio.sleep(delay)
        _JOBS[job_id]["progress"]      = pct
        _JOBS[job_id]["current_stage"] = stage
        _JOBS[job_id]["status"]        = "processing" if pct < 100 else "completed"

    from backend.historical.demo import generate_demo_result
    result = generate_demo_result()
    _JOBS[job_id]["result"]            = result
    _JOBS[job_id]["status"]            = "completed"
    _JOBS[job_id]["progress"]          = 100.0
    _JOBS[job_id]["current_stage"]     = "completed"
    _JOBS[job_id]["packets_processed"] = result.get("packet_count", 0)
    _JOBS[job_id]["flows_detected"]    = result.get("flow_count", 0)
    _JOBS[job_id]["completed_at"]      = time.time()


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_pcap(file: UploadFile = File(...)) -> JSONResponse:
    """
    Accept a .pcap / .pcapng file, validate it, and kick off background analysis.
    Returns job metadata immediately.
    """
    filename = file.filename or "upload.pcap"
    ext = Path(filename).suffix.lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Accepted: {', '.join(_ALLOWED_EXTENSIONS)}",
        )

    # Read file content
    upload_ts = time.time()
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed: {_MAX_FILE_SIZE // 1024 // 1024} MB",
        )

    # SHA-256 of uploaded bytes — computed once over the exact byte stream.
    file_sha256 = hashlib.sha256(content).hexdigest()

    # Write to temp file
    suffix = ext if ext in _ALLOWED_EXTENSIONS else ".pcap"
    fd, temp_path = tempfile.mkstemp(suffix=suffix, prefix="nextrace_hist_")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(content)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {exc}")

    job = _new_job(filename, len(content), is_demo=False, sha256=file_sha256, upload_at=upload_ts)
    job["temp_path"] = temp_path

    # Fire-and-forget background task
    asyncio.create_task(_run_analysis_async(job["job_id"], temp_path))

    return JSONResponse({
        "job_id":            job["job_id"],
        "filename":          filename,
        "file_size":         len(content),
        "sha256":            file_sha256,
        "upload_timestamp":  upload_ts,
        "status":            job["status"],
    }, status_code=202)


@router.post("/demo")
async def start_demo_analysis() -> JSONResponse:
    """
    Start a demo analysis job using synthetic data.
    Clearly labeled as simulated data — no real PCAP required.
    """
    job = _new_job("demo_capture.pcap", 0, is_demo=True)
    asyncio.create_task(_run_demo_async(job["job_id"]))
    return JSONResponse({
        "job_id":    job["job_id"],
        "filename":  "demo_capture.pcap",
        "file_size": 0,
        "status":    "queued",
        "is_demo":   True,
        "demo_label": "⚠ DEMO — Synthetic data. Not real network traffic.",
    }, status_code=202)


@router.get("/{job_id}/status")
async def get_job_status(job_id: str) -> JSONResponse:
    """Poll processing status for a historical job."""
    job = _JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    return JSONResponse({
        "job_id":            job["job_id"],
        "filename":          job["filename"],
        "is_demo":           job["is_demo"],
        "sha256":            job.get("sha256"),
        "upload_timestamp":  job.get("upload_timestamp"),
        "processing_start":  job.get("processing_start"),
        "status":            job["status"],
        "progress":          job["progress"],
        "packets_processed": job["packets_processed"],
        "flows_detected":    job["flows_detected"],
        "current_stage":     job["current_stage"],
        "error":             job["error"],
        "created_at":        job["created_at"],
        "completed_at":      job["completed_at"],
    })


@router.get("/{job_id}/result")
async def get_job_result(job_id: str) -> JSONResponse:
    """Return the full analysis result. Only available when status is 'completed'."""
    job = _JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    if job["status"] == "failed":
        raise HTTPException(
            status_code=422,
            detail=f"Analysis failed: {job.get('error', 'Unknown error')}",
        )

    if job["status"] != "completed":
        raise HTTPException(
            status_code=409,
            detail=f"Analysis not yet complete. Current status: {job['status']} ({job['progress']:.0f}%)",
        )

    result = job["result"]
    if not result:
        raise HTTPException(status_code=500, detail="Result is missing despite completed status.")

    return JSONResponse({
        "job_id":             job["job_id"],
        "filename":           job["filename"],
        "file_size":          job["file_size"],
        "is_demo":            job["is_demo"],
        "sha256":             job.get("sha256"),
        "upload_timestamp":   job.get("upload_timestamp"),
        "processing_start":   job.get("processing_start"),
        "completed_at":       job.get("completed_at"),
        "status":             job["status"],
        "result":             result,
    })


@router.get("/")
async def list_jobs() -> JSONResponse:
    """List all historical jobs (job metadata only, no full results)."""
    jobs_list = [
        {
            "job_id":   j["job_id"],
            "filename": j["filename"],
            "is_demo":  j["is_demo"],
            "status":   j["status"],
            "progress": j["progress"],
        }
        for j in _JOBS.values()
    ]
    return JSONResponse({"jobs": jobs_list})
