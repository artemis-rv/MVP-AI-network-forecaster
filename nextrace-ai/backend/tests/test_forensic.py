"""
Unit tests for Step 6: Forensic Reasoning, Anti-Forensic Analysis & Evidence Integrity.
Validates:
- Evidence hashing and SHA256 integrity checks
- Anti-forensic indicator analysis
- Hypothesis generation and timeline reconstruction
- Forensic API endpoints
"""
import unittest
from fastapi.testclient import TestClient

from backend.main import app
from backend.forensic.integrity import build_integrity
from backend.forensic.anti_forensic import detect_anti_forensic_indicators
from backend.forensic.hypotheses import generate_hypotheses
from backend.forensic.analyzer import run_forensic_analysis


class TestForensicSuite(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_integrity_and_anti_forensic_detection(self):
        mock_job = {
            "job_id": "JOB-1234",
            "is_demo": False,
            "sha256": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            "filename": "sample.pcap",
            "file_size": 1024,
            "created_at": 1700000000.0,
        }
        mock_hist_result = {
            "total_packets": 100,
            "duration_seconds": 30.0,
            "start_timestamp": 1700000000.0,
            "end_timestamp": 1700000030.0,
            "suspicious_events": [
                {
                    "type": "port_scan_indicator",
                    "timestamp": 1700000005.0,
                    "reason": "High volume SYN scan observed",
                    "severity": "high",
                    "src_ip": "198.51.100.20",
                    "dst_ip": "10.10.1.10",
                }
            ],
            "temporal_windows": [],
            "entity_relationships": [
                {"src_ip": "198.51.100.20", "dst_ip": "10.10.1.10", "is_suspicious": True}
            ],
            "protocol_distribution": [{"protocol": "TCP", "count": 100}],
            "top_src_ips": [{"ip": "198.51.100.20", "count": 100}],
            "top_dst_ips": [{"ip": "10.10.1.10", "count": 100}],
            "top_dst_ports": [{"port": 80, "count": 50}],
        }

        # Integrity
        integ = build_integrity(mock_job, mock_hist_result)
        self.assertEqual(integ["status"], "VERIFIED")
        self.assertIn("Hash verifies", integ["disclaimer"])

        # Anti-forensic indicators
        af = detect_anti_forensic_indicators(mock_hist_result, is_demo=False)
        self.assertIsInstance(af, list)

        # Hypotheses
        hyps = generate_hypotheses(mock_hist_result)
        self.assertIsInstance(hyps, list)
        self.assertGreater(len(hyps), 0)

        # Full analysis orchestrator
        fa = run_forensic_analysis(mock_job, mock_hist_result)
        self.assertEqual(fa["status"], "completed")
        self.assertEqual(fa["historical_job_id"], "JOB-1234")
        self.assertIn("final_assessment", fa)

    def test_forensic_api_workflow(self):
        from backend.api.historical import _JOBS as _HIST_JOBS
        # Register a completed mock historical job
        _HIST_JOBS["HIST-MOCK-1"] = {
            "job_id": "HIST-MOCK-1",
            "filename": "test.pcap",
            "file_size": 2048,
            "status": "completed",
            "progress": 100.0,
            "sha256": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            "is_demo": False,
            "created_at": 1700000000.0,
            "completed_at": 1700000030.0,
            "result": {
                "total_packets": 200,
                "duration_seconds": 30.0,
                "start_timestamp": 1700000000.0,
                "end_timestamp": 1700000030.0,
                "suspicious_events": [],
                "temporal_windows": [],
                "entity_relationships": [],
                "protocol_distribution": [],
                "top_src_ips": [],
                "top_dst_ips": [],
                "top_dst_ports": [],
            },
        }

        # Analyze
        res = self.client.post("/api/forensic/HIST-MOCK-1/analyze")
        self.assertIn(res.status_code, [200, 202])

        # Status
        res = self.client.get("/api/forensic/HIST-MOCK-1/status")
        self.assertEqual(res.status_code, 200)

        # Result
        res = self.client.get("/api/forensic/HIST-MOCK-1/result")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["historical_job_id"], "HIST-MOCK-1")


if __name__ == "__main__":
    unittest.main()
