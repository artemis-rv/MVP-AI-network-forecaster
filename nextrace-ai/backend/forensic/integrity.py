"""
NEXTRACE AI — Evidence Integrity Module
Builds cryptographic provenance metadata for a historical analysis job.

IMPORTANT DISCLAIMERS:
- This is PROTOTYPE evidence integrity metadata only.
- VERIFIED status means the uploaded byte stream was successfully hashed.
- This does NOT imply legal admissibility or courtroom chain-of-custody compliance.
- The hash verifies the analyzed uploaded byte stream only.
- Demo/simulated captures are clearly labeled as SIMULATED EVIDENCE.
"""
from __future__ import annotations

import time
from typing import Any


# ── Constants ──────────────────────────────────────────────────────────────────

_PROTOTYPE_DISCLAIMER = (
    "Prototype evidence integrity metadata. "
    "Hash verifies the analyzed uploaded byte stream only. "
    "Not legally admissible. Not court chain-of-custody compliant."
)

_SIMULATED_DISCLAIMER = (
    "SIMULATED EVIDENCE — This is synthetic demo data. "
    "No real PCAP file was uploaded. "
    "The hash is a placeholder and does not correspond to any real capture."
)


def build_integrity(job: dict[str, Any], hist_result: dict[str, Any]) -> dict[str, Any]:
    """
    Construct an EvidenceIntegrity object from a completed historical job record.

    Args:
        job: The in-memory job dict from _JOBS (historical API).
        hist_result: The HistoricalResult dict stored in job["result"].

    Returns:
        EvidenceIntegrity dict.
    """
    is_demo: bool = job.get("is_demo", False)
    sha256: str | None = job.get("sha256")

    # Determine integrity status
    if is_demo:
        status = "SIMULATED"
    elif sha256 and not sha256.startswith("SIMULATED"):
        status = "VERIFIED"
    elif sha256:
        status = "SIMULATED"
    else:
        status = "UNAVAILABLE"

    # Build display hash — for SIMULATED we truncate to show it is not real
    if is_demo or (sha256 and sha256.startswith("SIMULATED:")):
        display_hash = sha256  # keep the SIMULATED: prefix visible
    else:
        display_hash = sha256

    upload_ts   = job.get("upload_timestamp")
    proc_start  = job.get("processing_start")
    completed   = job.get("completed_at")
    created     = job.get("created_at")

    return {
        "status":              status,               # VERIFIED | SIMULATED | UNAVAILABLE
        "is_demo":             is_demo,
        "sha256":              display_hash,
        "filename":            job.get("filename", "unknown"),
        "file_size":           job.get("file_size", 0),
        "historical_job_id":   job.get("job_id"),
        "upload_timestamp":    upload_ts or created,
        "processing_start":    proc_start,
        "processing_completed":completed,
        "packet_count":        hist_result.get("packet_count", 0),
        "flow_count":          hist_result.get("flow_count", 0),
        "analysis_status":     job.get("status", "completed"),
        "disclaimer":          _SIMULATED_DISCLAIMER if (is_demo or status == "SIMULATED")
                               else _PROTOTYPE_DISCLAIMER,
    }
