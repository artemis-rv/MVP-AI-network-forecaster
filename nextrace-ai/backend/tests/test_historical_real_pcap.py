"""
NEXTRACE AI — Real PCAP Analysis & Forensic Extraction Test Suite
Tests parser, flow extraction, feature engineering, heuristics, and graph relationships
on dynamically generated realistic PCAP capture streams.
"""
import os
import tempfile
import pytest
from scapy.all import Ether, IP, IPv6, TCP, UDP, ICMP, ARP, wrpcap

from backend.historical.parser import parse_pcap
from backend.historical.analyzer import run_analysis
from backend.forensic.analyzer import run_forensic_analysis


@pytest.fixture
def sample_real_pcap():
    """Generates a realistic multi-host PCAP with benign and attack traffic."""
    fd, path = tempfile.mkstemp(suffix=".pcap", prefix="test_real_capture_")
    os.close(fd)

    pkts = []
    base_time = 1710000000.0

    # 1. ARP discovery
    pkts.append(Ether(src="00:11:22:33:44:55", dst="ff:ff:ff:ff:ff:ff") /
                ARP(op=1, psrc="192.168.1.10", pdst="192.168.1.1"))

    # 2. Benign DNS request & response
    pkts.append(Ether(src="00:11:22:33:44:55", dst="00:11:22:33:44:01") /
                IP(src="192.168.1.10", dst="192.168.1.1") /
                UDP(sport=54321, dport=53))
    pkts.append(Ether(src="00:11:22:33:44:01", dst="00:11:22:33:44:55") /
                IP(src="192.168.1.1", dst="192.168.1.10") /
                UDP(sport=53, dport=54321))

    # 3. Vertical Port Scan from attacker (10.0.0.99) targeting victim (192.168.1.50)
    for p in [21, 22, 23, 25, 80, 110, 139, 443, 445, 1433, 3306, 3389, 8080]:
        pkts.append(Ether(src="aa:bb:cc:dd:ee:99", dst="00:11:22:33:44:50") /
                    IP(src="10.0.0.99", dst="192.168.1.50") /
                    TCP(sport=40000 + p, dport=p, flags="S"))

    # 4. Brute Force attack on SSH port 22
    for attempt in range(8):
        sport = 50000 + attempt
        pkts.append(Ether(src="aa:bb:cc:dd:ee:99", dst="00:11:22:33:44:50") /
                    IP(src="10.0.0.99", dst="192.168.1.50") /
                    TCP(sport=sport, dport=22, flags="S"))
        pkts.append(Ether(src="00:11:22:33:44:50", dst="aa:bb:cc:dd:ee:99") /
                    IP(src="192.168.1.50", dst="10.0.0.99") /
                    TCP(sport=22, dport=sport, flags="SA"))
        pkts.append(Ether(src="aa:bb:cc:dd:ee:99", dst="00:11:22:33:44:50") /
                    IP(src="10.0.0.99", dst="192.168.1.50") /
                    TCP(sport=sport, dport=22, flags="R"))

    # 5. C2 Communication on port 4444 (Metasploit handler)
    for _ in range(5):
        pkts.append(Ether(src="00:11:22:33:44:50", dst="ee:ee:ee:ee:ee:ee") /
                    IP(src="192.168.1.50", dst="198.51.100.77") /
                    TCP(sport=49155, dport=4444, flags="PA"))

    # 6. IPv6 Web Traffic
    pkts.append(Ether(src="00:11:22:33:44:55", dst="00:11:22:33:44:01") /
                IPv6(src="2001:db8::10", dst="2001:db8::1") /
                TCP(sport=55555, dport=80, flags="PA"))

    # Set increasing timestamps
    for i, pkt in enumerate(pkts):
        pkt.time = base_time + (i * 0.5)

    wrpcap(path, pkts)
    yield path

    if os.path.exists(path):
        os.unlink(path)


def test_parse_real_pcap(sample_real_pcap):
    """Test packet parsing and field extraction from real pcap file."""
    records = parse_pcap(sample_real_pcap)
    assert len(records) > 0
    # Check that diverse protocols were parsed
    protocols = {r["protocol"] for r in records}
    assert "TCP" in protocols
    assert "UDP" in protocols
    assert any(r["src_ip"] == "10.0.0.99" for r in records)
    assert any(r["dst_port"] == 4444 for r in records)


def test_historical_analysis_pipeline(sample_real_pcap):
    """Test the complete historical analysis pipeline on real capture."""
    result = run_analysis(sample_real_pcap)
    assert result["packet_count"] > 0
    assert result["flow_count"] > 0
    assert result["duration_seconds"] > 0
    assert len(result["protocol_distribution"]) >= 2
    assert len(result["temporal_windows"]) >= 1

    # Check that heuristic detections identified attack patterns
    events = result["suspicious_events"]
    assert len(events) >= 1

    event_types = {e["type"] for e in events}
    # Port scan, brute force, or backdoor should be detected
    assert "port_scan_indicator" in event_types or "brute_force_indicator" in event_types or "backdoor_c2_indicator" in event_types

    # Check entity relationships graph mapping
    rels = result["entity_relationships"]
    assert len(rels) >= 1

    # Check that the attacker -> victim edge is marked suspicious
    attacker_victim_rels = [r for r in rels if r["src_ip"] == "10.0.0.99" and r["dst_ip"] == "192.168.1.50"]
    assert len(attacker_victim_rels) == 1
    assert attacker_victim_rels[0]["is_suspicious"] is True
    assert 22 in attacker_victim_rels[0]["ports"]


def test_forensic_pipeline_on_real_pcap_result(sample_real_pcap):
    """Test that forensic analysis runs seamlessly on real PCAP historical result."""
    hist_result = run_analysis(sample_real_pcap)
    fake_job = {
        "job_id": "TEST-HIST-01",
        "filename": "real_network.pcap",
        "file_size": 1024,
        "is_demo": False,
        "sha256": "abcdef0123456789",
        "upload_timestamp": 1710000000.0,
        "status": "completed",
    }
    forensic = run_forensic_analysis(fake_job, hist_result)
    assert forensic["forensic_id"] is not None
    assert "evidence_summary" in forensic
    assert "anti_forensic_indicators" in forensic
    assert "hypotheses" in forensic
    assert "final_assessment" in forensic
    assert "overall_confidence" in forensic["final_assessment"]
    assert "assessment_text" in forensic["final_assessment"]

    # Register in registries and test report builder
    from backend.api.historical import _JOBS as _HIST_JOBS
    from backend.api.forensic import _FORENSIC_JOBS
    from backend.reports.report_builder import build_historical_report

    fake_job["result"] = hist_result
    _HIST_JOBS["TEST-HIST-01"] = fake_job
    _FORENSIC_JOBS["TEST-HIST-01"] = forensic

    rpt = build_historical_report("TEST-HIST-01")
    assert rpt is not None
    net_sec = next(s for s in rpt["sections"] if s["title"] == "Network Activity")["content"]
    assert net_sec["packet_count"] > 0
    assert net_sec["flow_count"] > 0
    assert len(net_sec["top_src_ips"]) > 0
    assert len(net_sec["top_dst_ips"]) > 0
