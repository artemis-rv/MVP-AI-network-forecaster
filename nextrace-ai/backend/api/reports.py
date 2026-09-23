"""
NEXTRACE AI — Reports API Router (Step 8)

Endpoints:
  GET  /api/reports/list
  GET  /api/reports/historical/{job_id}/findings
  GET  /api/reports/simulation/{simulation_id}/findings
  POST /api/reports/historical/{job_id}/generate
  POST /api/reports/simulation/{simulation_id}/generate
  GET  /api/reports/{report_id}

ISOLATION:
  - Historical endpoints read _HIST_JOBS + _FORENSIC_JOBS only.
  - Simulation endpoints read simulator engine only.
  - NEVER touches live session, forecast, or investigation state.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from backend.reports.report_builder import (
    build_historical_report,
    build_simulation_report,
    get_report,
    list_reports,
)
from backend.reports.findings import (
    build_historical_findings,
    build_simulation_findings,
)

router = APIRouter(prefix="/reports", tags=["Reports"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_completed_hist_and_forensic(job_id: str):
    """
    Return (hist_job, forensic_result) or raise appropriate HTTP errors.
    Both historical and forensic jobs must be completed.
    """
    from backend.api.historical import _JOBS as _HIST_JOBS
    from backend.api.forensic import _FORENSIC_JOBS

    hist_job = _HIST_JOBS.get(job_id)
    if not hist_job:
        raise HTTPException(status_code=404, detail=f"Historical job '{job_id}' not found.")
    if hist_job.get("status") != "completed":
        raise HTTPException(
            status_code=409,
            detail=(
                f"Historical job '{job_id}' is not completed "
                f"(status: {hist_job.get('status')}). "
                f"Report cannot be generated from an incomplete analysis."
            ),
        )

    forensic_job = _FORENSIC_JOBS.get(job_id)
    if not forensic_job:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No forensic analysis found for job '{job_id}'. "
                f"Run POST /api/forensic/{job_id}/analyze first."
            ),
        )
    if forensic_job.get("status") != "completed":
        raise HTTPException(
            status_code=409,
            detail=(
                f"Forensic analysis for job '{job_id}' is not completed "
                f"(status: {forensic_job.get('status')}). "
                f"Wait for forensic analysis to complete before generating a report."
            ),
        )

    forensic_result = forensic_job.get("result", {}) or {}
    return hist_job, forensic_result


def _get_completed_simulation(simulation_id: str):
    """Return sim_result or raise appropriate HTTP errors."""
    from backend.simulator import engine

    try:
        state = engine.get_state(simulation_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Simulation '{simulation_id}' not found.")

    if state.status in ("idle", "running", "paused"):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Simulation '{simulation_id}' is not completed "
                f"(status: {state.status}). "
                f"Wait for the simulation to complete before generating a report."
            ),
        )

    return engine.get_result(simulation_id)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/list")
async def list_all_reports() -> JSONResponse:
    """List all generated reports (summaries only)."""
    return JSONResponse({"reports": list_reports()})


@router.get("/historical/{job_id}/findings")
async def get_historical_findings(job_id: str) -> JSONResponse:
    """
    Preview findings for a completed historical + forensic job.
    Does NOT store a report — read-only preview.
    """
    hist_job, forensic_result = _get_completed_hist_and_forensic(job_id)
    findings = build_historical_findings(hist_job, forensic_result)
    return JSONResponse({
        "job_id":        job_id,
        "finding_count": len(findings),
        "findings":      findings,
    })


@router.get("/simulation/{simulation_id}/findings")
async def get_simulation_findings(simulation_id: str) -> JSONResponse:
    """
    Preview findings for a completed simulation.
    Does NOT store a report — read-only preview.
    """
    sim_result = _get_completed_simulation(simulation_id)
    findings = build_simulation_findings(sim_result)
    return JSONResponse({
        "simulation_id": simulation_id,
        "finding_count": len(findings),
        "findings":      findings,
    })


@router.post("/historical/{job_id}/generate")
async def generate_historical_report(job_id: str) -> JSONResponse:
    """
    Generate and store a historical forensic report.
    Requires: historical job completed AND forensic analysis completed.
    """
    # Validate first (raises HTTP errors if not ready)
    _get_completed_hist_and_forensic(job_id)

    try:
        report = build_historical_report(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {exc}")

    return JSONResponse({
        "report_id":    report["report_id"],
        "report_type":  report["report_type"],
        "source_id":    report["source_id"],
        "title":        report["title"],
        "generated_at": report["generated_at"],
        "status":       report["status"],
        "finding_count":len(report["findings"]),
        "section_count":len(report["sections"]),
    }, status_code=201)


@router.post("/simulation/{simulation_id}/generate")
async def generate_simulation_report(simulation_id: str) -> JSONResponse:
    """
    Generate and store a simulation report.
    Requires: simulation status completed or stopped.
    """
    # Validate first
    _get_completed_simulation(simulation_id)

    try:
        report = build_simulation_report(simulation_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {exc}")

    return JSONResponse({
        "report_id":    report["report_id"],
        "report_type":  report["report_type"],
        "source_id":    report["source_id"],
        "title":        report["title"],
        "generated_at": report["generated_at"],
        "status":       report["status"],
        "finding_count":len(report["findings"]),
        "section_count":len(report["sections"]),
    }, status_code=201)


@router.get("/{report_id}")
async def get_report_by_id(report_id: str) -> JSONResponse:
    """Retrieve a stored report by its report_id."""
    report = get_report(report_id)
    if not report:
        raise HTTPException(
            status_code=404,
            detail=f"Report '{report_id}' not found. Generate a report first.",
        )
    return JSONResponse(report)
