"""
NEXTRACE AI — Automated Windows Network Capture Environment Discovery
======================================================================
Discovers Npcap, dumpcap/tshark executables, and network interfaces on Windows/Linux host.
Dynamically detects active physical adapters (Wi-Fi/Ethernet) without hardcoding indices.
"""
from __future__ import annotations

import logging
import os
import platform
import re
import shutil
import subprocess
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Standard binary paths for Wireshark suite on Windows
_DUMPCAP_PATHS = [
    r"C:\Program Files\Wireshark\dumpcap.exe",
    r"C:\Program Files (x86)\Wireshark\dumpcap.exe",
]

_TSHARK_PATHS = [
    r"C:\Program Files\Wireshark\tshark.exe",
    r"C:\Program Files (x86)\Wireshark\tshark.exe",
]

_NPCAP_PATHS = [
    r"C:\Program Files\Npcap",
    r"C:\Windows\System32\Npcap",
    r"C:\Windows\SysWOW64\Npcap",
]


def find_dumpcap_executable() -> Optional[str]:
    """Locate dumpcap executable on system PATH or standard install directories."""
    which_path = shutil.which("dumpcap")
    if which_path and os.path.isfile(which_path):
        return which_path
    for p in _DUMPCAP_PATHS:
        if os.path.isfile(p):
            return p
    return None


def find_tshark_executable() -> Optional[str]:
    """Locate tshark executable on system PATH or standard install directories."""
    which_path = shutil.which("tshark")
    if which_path and os.path.isfile(which_path):
        return which_path
    for p in _TSHARK_PATHS:
        if os.path.isfile(p):
            return p
    return None


def is_npcap_available() -> bool:
    """Check if Npcap driver/library is present on Windows."""
    if platform.system().lower() != "windows":
        return True  # Linux uses libpcap
    for p in _NPCAP_PATHS:
        if os.path.exists(p):
            return True
    # Test if dumpcap -D runs without driver error
    dumpcap_bin = find_dumpcap_executable()
    if dumpcap_bin:
        try:
            res = subprocess.run([dumpcap_bin, "-D"], capture_output=True, text=True, timeout=3)
            return res.returncode == 0
        except Exception:
            pass
    return False


def get_active_windows_adapters() -> dict[str, dict[str, Any]]:
    """
    Query Windows PowerShell Get-NetAdapter to identify adapter names with Status == 'Up'.
    Returns mapping from lower-cased adapter name -> adapter metadata.
    """
    active_map: dict[str, dict[str, Any]] = {}
    if platform.system().lower() != "windows":
        return active_map

    try:
        cmd = [
            "powershell.exe",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-NetAdapter | Select-Object Name, InterfaceDescription, Status, LinkSpeed | ConvertTo-Json -Compress",
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=4, check=False)
        if res.returncode == 0 and res.stdout.strip():
            import json
            data = json.loads(res.stdout.strip())
            if isinstance(data, dict):
                data = [data]
            for item in data:
                name = str(item.get("Name", "")).strip()
                status = str(item.get("Status", "")).strip().lower()
                desc = str(item.get("InterfaceDescription", "")).strip()
                speed = str(item.get("LinkSpeed", "")).strip()
                is_up = status == "up"
                active_map[name.lower()] = {
                    "name": name,
                    "status": status,
                    "description": desc,
                    "speed": speed,
                    "is_up": is_up,
                }
    except Exception as exc:
        logger.debug("PowerShell Get-NetAdapter query failed: %s", exc)

    return active_map


def discover_network_interfaces() -> list[dict[str, Any]]:
    """
    Discover all network capture interfaces on host using dumpcap -D (or tshark -D / Scapy fallback).
    Cross-references active adapter status to mark physically active interfaces.
    """
    interfaces: list[dict[str, Any]] = []
    dumpcap_bin = find_dumpcap_executable()
    tshark_bin = find_tshark_executable() if not dumpcap_bin else None
    cli_bin = dumpcap_bin or tshark_bin

    active_adapters = get_active_windows_adapters()

    if cli_bin:
        try:
            res = subprocess.run(
                [cli_bin, "-D"],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            if res.returncode == 0:
                for line in res.stdout.strip().splitlines():
                    # Format: 1. \Device\NPF_{GUID} (Friendly Name)
                    m = re.match(r"^(\d+)\.\s+(\S+)(?:\s+\((.*)\))?$", line.strip())
                    if m:
                        idx_str, dev_id, friendly = m.groups()
                        friendly_name = (friendly or dev_id).strip()
                        lower_name = friendly_name.lower()

                        iface_type = "unknown"
                        if "wi-fi" in lower_name or "wifi" in lower_name or "wireless" in lower_name:
                            iface_type = "wifi"
                        elif "ethernet" in lower_name:
                            iface_type = "ethernet"
                        elif "loopback" in lower_name or "npf_loopback" in dev_id.lower():
                            iface_type = "loopback"
                        elif "bluetooth" in lower_name:
                            iface_type = "bluetooth"
                        elif "local area connection" in lower_name or "vEthernet" in lower_name:
                            iface_type = "virtual"

                        is_loopback = iface_type == "loopback"
                        
                        # Cross-reference with PowerShell adapter state
                        adapter_info = active_adapters.get(lower_name, {})
                        is_active_up = adapter_info.get("is_up", False)
                        adapter_desc = adapter_info.get("description", "")

                        # Recommend physical wifi/ethernet that is UP, or wifi/ethernet if status unknown
                        is_recommended = False
                        if is_active_up and iface_type in ("wifi", "ethernet"):
                            is_recommended = True
                        elif not active_adapters and iface_type in ("wifi", "ethernet"):
                            is_recommended = True

                        interfaces.append({
                            "index": int(idx_str),
                            "id": dev_id,
                            "name": friendly_name,
                            "description": adapter_desc or friendly_name,
                            "type": iface_type,
                            "is_loopback": is_loopback,
                            "is_active_up": is_active_up,
                            "is_recommended": is_recommended,
                            "status": "up" if is_active_up else "ready",
                        })
        except Exception as exc:
            logger.warning("Interface discovery CLI failed: %s", exc)

    # Scapy fallback if CLI did not find anything
    if not interfaces:
        try:
            from scapy.all import get_if_list
            for idx, iface in enumerate(get_if_list(), start=1):
                name = str(iface)
                interfaces.append({
                    "index": idx,
                    "id": name,
                    "name": name,
                    "description": name,
                    "type": "scapy_interface",
                    "is_loopback": "loopback" in name.lower(),
                    "is_active_up": True,
                    "is_recommended": idx == 1,
                    "status": "ready",
                })
        except Exception as exc:
            logger.warning("Scapy interface fallback failed: %s", exc)

    # Prioritize recommended interface at top of recommendation
    return interfaces


def get_recommended_interface(interfaces: list[dict[str, Any]]) -> str:
    """Determine the single best interface identifier (index or device ID)."""
    if not interfaces:
        return "1"

    # 1. First priority: active physical Wi-Fi or Ethernet marked UP
    for iface in interfaces:
        if iface.get("is_recommended") and iface.get("is_active_up"):
            return str(iface["index"])

    # 2. Second priority: any recommended Wi-Fi or Ethernet
    for iface in interfaces:
        if iface.get("is_recommended") and not iface.get("is_loopback"):
            return str(iface["index"])

    # 3. Third priority: non-loopback
    for iface in interfaces:
        if not iface.get("is_loopback"):
            return str(iface["index"])

    return str(interfaces[0]["index"])


def get_environment_info() -> dict[str, Any]:
    """Return comprehensive system capture environment metadata."""
    dumpcap_bin = find_dumpcap_executable()
    tshark_bin = find_tshark_executable()
    npcap_ok = is_npcap_available()
    ifaces = discover_network_interfaces()
    rec_iface = get_recommended_interface(ifaces)

    return {
        "os": platform.system(),
        "os_release": platform.release(),
        "npcap_available": npcap_ok,
        "dumpcap_available": dumpcap_bin is not None,
        "dumpcap_path": dumpcap_bin,
        "tshark_available": tshark_bin is not None,
        "tshark_path": tshark_bin,
        "interfaces": ifaces,
        "interface_count": len(ifaces),
        "recommended_interface": rec_iface,
    }
