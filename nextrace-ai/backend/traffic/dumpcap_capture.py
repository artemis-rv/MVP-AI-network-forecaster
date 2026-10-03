"""
NEXTRACE AI — Dumpcap High-Throughput Live Capture Process & Self-Test Manager
=============================================================================
Spawns and manages native dumpcap subprocesses writing rotating PCAPNG chunks.
Decouples kernel packet capture from downstream Python decoding and forecasting.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Optional

from backend.traffic.discovery import find_dumpcap_executable, discover_network_interfaces

logger = logging.getLogger(__name__)


def run_dumpcap_self_test(
    interface_id: str,
    duration_seconds: int = 5,
    bpf_filter: str = "",
) -> dict[str, Any]:
    """
    Perform an automated live capture self-test on the target interface.
    Captures raw packets to a temporary PCAPNG file for `duration_seconds`,
    inspects the file, and returns structured diagnostics.
    """
    dumpcap_bin = find_dumpcap_executable()
    if not dumpcap_bin:
        return {
            "healthy": False,
            "interface_id": str(interface_id),
            "interface_name": "unknown",
            "packets": 0,
            "bytes": 0,
            "duration_seconds": duration_seconds,
            "packets_per_second": 0.0,
            "mbps": 0.0,
            "capture_drops": 0,
            "stderr": "dumpcap.exe not found on system. Please ensure Wireshark/Npcap is installed.",
            "error": "dumpcap_not_found",
        }

    # Resolve interface name
    interfaces = discover_network_interfaces()
    iface_obj = next(
        (i for i in interfaces if str(i["index"]) == str(interface_id) or i["id"] == str(interface_id)),
        None,
    )
    iface_name = iface_obj["name"] if iface_obj else str(interface_id)
    target_param = iface_obj["id"] if (iface_obj and "\\" in iface_obj["id"]) else str(interface_id)

    temp_dir = tempfile.mkdtemp(prefix="nextrace_selftest_")
    test_pcap = os.path.join(temp_dir, "selftest.pcapng")

    cmd = [
        dumpcap_bin,
        "-i", target_param,
        "-a", f"duration:{max(2, min(duration_seconds, 15))}",
        "-w", test_pcap,
        "-s", "0",
        "-B", "64",
        "-q",
    ]
    if bpf_filter.strip():
        cmd.extend(["-f", bpf_filter.strip()])

    t_start = time.time()
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=duration_seconds + 5,
            check=False,
        )
        t_elapsed = max(0.1, time.time() - t_start)
        stderr_text = proc.stderr or proc.stdout or ""

        # Parse packets and drops from dumpcap output
        # Format: Packets captured: 917
        # Packets received/dropped on interface 'Wi-Fi': 917/0
        packets_captured = 0
        drops_count = 0

        m_cap = re.search(r"Packets captured:\s+(\d+)", stderr_text)
        if m_cap:
            packets_captured = int(m_cap.group(1))

        m_drop = re.search(r"dropped\s+on\s+interface[^:]*:\s*\d+/(\d+)", stderr_text)
        if m_drop:
            drops_count = int(m_drop.group(1))

        file_bytes = os.path.getsize(test_pcap) if os.path.exists(test_pcap) else 0

        # If file exists, verify packet count by reading header/blocks if possible
        if os.path.exists(test_pcap) and file_bytes > 0 and packets_captured == 0:
            try:
                from scapy.utils import PcapNgReader
                reader = PcapNgReader(test_pcap)
                cnt = sum(1 for _ in reader)
                if cnt > 0:
                    packets_captured = cnt
            except Exception:
                pass

        pps = round(packets_captured / t_elapsed, 2)
        mbps = round((file_bytes * 8.0) / (t_elapsed * 1_000_000.0), 3)
        healthy = (proc.returncode == 0) and (packets_captured > 0)

        return {
            "healthy": healthy,
            "interface_id": str(interface_id),
            "interface_name": iface_name,
            "packets": packets_captured,
            "bytes": file_bytes,
            "duration_seconds": round(t_elapsed, 2),
            "packets_per_second": pps,
            "mbps": mbps,
            "capture_drops": drops_count,
            "stderr": stderr_text.strip(),
            "error": None if healthy else ("zero_packets_captured" if proc.returncode == 0 else f"dumpcap_exit_{proc.returncode}"),
        }
    except Exception as exc:
        return {
            "healthy": False,
            "interface_id": str(interface_id),
            "interface_name": iface_name,
            "packets": 0,
            "bytes": 0,
            "duration_seconds": round(time.time() - t_start, 2),
            "packets_per_second": 0.0,
            "mbps": 0.0,
            "capture_drops": 0,
            "stderr": str(exc),
            "error": f"exception: {exc}",
        }
    finally:
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass


class DumpcapCaptureProcess:
    """
    Spawns and monitors a native dumpcap capture process producing rotating PCAPNG chunks.
    """

    def __init__(
        self,
        interface: str,
        session_id: str,
        base_dir: str = "captures/live",
        chunk_duration_seconds: int = 3,
        buffer_size_mb: int = 64,
        bpf_filter: str = "",
    ) -> None:
        self.interface = interface
        self.session_id = session_id
        self.base_dir = os.path.abspath(os.path.join(base_dir, session_id))
        self.chunk_duration_seconds = max(1, min(chunk_duration_seconds, 60))
        self.buffer_size_mb = max(16, buffer_size_mb)
        self.bpf_filter = bpf_filter.strip()

        self._proc: Optional[subprocess.Popen] = None
        self._running = False
        self._start_time: Optional[float] = None
        self._dumpcap_bin = find_dumpcap_executable()

        # Target file template for dumpcap ring buffer
        # -b duration:X creates files like live_session_<session_id>_YYYYMMDDHHMMSS.pcapng
        self._file_prefix = f"live_session_{session_id}_"

    def start(self) -> None:
        """Launch background dumpcap subprocess."""
        if self._running:
            return

        if not self._dumpcap_bin:
            raise RuntimeError("dumpcap.exe not found on system PATH or Wireshark directory.")

        os.makedirs(self.base_dir, exist_ok=True)

        # Resolve target parameter
        interfaces = discover_network_interfaces()
        iface_obj = next(
            (i for i in interfaces if str(i["index"]) == str(self.interface) or i["id"] == str(self.interface)),
            None,
        )
        target_param = iface_obj["id"] if (iface_obj and "\\" in iface_obj["id"]) else str(self.interface)

        chunk_file_pattern = os.path.join(self.base_dir, f"{self._file_prefix}.pcapng")

        cmd = [
            self._dumpcap_bin,
            "-i", target_param,
            "-b", f"duration:{self.chunk_duration_seconds}",
            "-b", "files:100",  # retain up to 100 rolling chunks
            "-w", chunk_file_pattern,
            "-s", "0",
            "-B", str(self.buffer_size_mb),
            "-q",
        ]
        if self.bpf_filter:
            cmd.extend(["-f", self.bpf_filter])

        logger.info("Starting Dumpcap live capture process: %s", " ".join(cmd))
        self._proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        self._running = True
        self._start_time = time.time()

    def is_alive(self) -> bool:
        """Check if dumpcap process is currently running."""
        if not self._proc:
            return False
        return self._proc.poll() is None

    def stop(self) -> tuple[int, str]:
        """
        Gracefully terminate dumpcap process and return (exit_code, stderr).
        """
        self._running = False
        exit_code = 0
        stderr_output = ""

        if self._proc:
            try:
                self._proc.terminate()
                try:
                    stdout, stderr = self._proc.communicate(timeout=3)
                    exit_code = self._proc.returncode or 0
                    stderr_output = stderr or stdout or ""
                except subprocess.TimeoutExpired:
                    self._proc.kill()
                    stdout, stderr = self._proc.communicate(timeout=2)
                    exit_code = self._proc.returncode or -9
                    stderr_output = stderr or ""
            except Exception as exc:
                logger.error("Error stopping dumpcap process: %s", exc)
            self._proc = None

        return exit_code, stderr_output

    def get_chunk_files(self) -> list[str]:
        """Return sorted list of existing PCAPNG chunks in the session directory."""
        if not os.path.exists(self.base_dir):
            return []
        files = [
            os.path.join(self.base_dir, f)
            for f in os.listdir(self.base_dir)
            if f.startswith(self._file_prefix) and f.endswith(".pcapng")
        ]
        files.sort(key=lambda p: os.path.getmtime(p))
        return files


def compute_file_sha256(filepath: str) -> str:
    """Compute SHA-256 hash of a capture file for immutable ledger verification."""
    h = hashlib.sha256()
    with open(filepath, "rb") as fh:
        while chunk := fh.read(65536):
            h.update(chunk)
    return h.hexdigest()
