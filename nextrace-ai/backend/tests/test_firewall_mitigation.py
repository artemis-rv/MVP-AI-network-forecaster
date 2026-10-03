import sys
from pathlib import Path
import pytest
from pydantic import ValidationError

backend_dir = str(Path(__file__).resolve().parent.parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from backend.alerts.firewall import (
    MitigationRequest,
    MitigationResult,
    execute_mitigation,
    get_mitigation_audit_log,
)


def test_dry_run_mitigation_success():
    """Verify dry run simulation executes safely without OS modification."""
    req = MitigationRequest(
        action="BLOCK_REMOTE_IP",
        target_host="LAB-HOST-01",
        remote_ip="192.168.1.150",
        direction="inbound",
        analyst_id="ANALYST-SEC-01",
        reason="Port scan detected from lab host",
        dry_run=True,
    )

    result = execute_mitigation(req)
    assert result.status == "DRY_RUN_SUCCESS"
    assert result.action == "BLOCK_REMOTE_IP"
    assert result.remote_ip == "192.168.1.150"
    assert "[SIMULATED]" in result.command_executed
    assert result.audit_hash != ""
    assert len(result.audit_hash) == 64


def test_unauthorized_ip_rejected():
    """Verify that IPs outside authorized lab/test RFC 1918 subnets are rejected by validation."""
    with pytest.raises(ValidationError) as exc_info:
        MitigationRequest(
            action="BLOCK_REMOTE_IP",
            target_host="LAB-HOST-01",
            remote_ip="8.8.8.8",  # Public Google DNS — outside lab scope
            analyst_id="ANALYST-SEC-01",
            reason="Testing unauthorized IP block",
            dry_run=True,
        )
    assert "outside authorized test scope" in str(exc_info.value)


def test_invalid_ip_format_rejected():
    """Verify malformed IP strings are rejected."""
    with pytest.raises(ValidationError):
        MitigationRequest(
            action="BLOCK_REMOTE_IP",
            target_host="LAB-HOST-01",
            remote_ip="192.168.1.999",  # Invalid octet
            analyst_id="ANALYST-SEC-01",
            reason="Invalid IP",
            dry_run=True,
        )


def test_audit_ledger_integrity():
    """Verify that every mitigation request is appended to the audit ledger."""
    initial_count = len(get_mitigation_audit_log())
    req = MitigationRequest(
        action="UNBLOCK_REMOTE_IP",
        target_host="LAB-HOST-01",
        remote_ip="10.0.5.20",
        analyst_id="ANALYST-SEC-02",
        reason="False positive review completed",
        dry_run=True,
    )
    result = execute_mitigation(req)
    ledger = get_mitigation_audit_log()

    assert len(ledger) == initial_count + 1
    last_entry = ledger[-1]
    assert last_entry["action_id"] == result.action_id
    assert last_entry["remote_ip"] == "10.0.5.20"
    assert last_entry["analyst_id"] == "ANALYST-SEC-02"
    assert last_entry["audit_hash"] == result.audit_hash
