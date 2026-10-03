# NEXTRACE AI — Real Live Traffic Capture Setup & Operator Guide

**Document Version:** 1.0.0  
**Target Environment:** Windows 11 / 10 / Server (Air-Gapped & Standard Workstations)

---

## 1. Prerequisites

1. **Python 3.10+** (with virtual environment or host interpreter).
2. **Wireshark Suite & Npcap:**
   - Install **Npcap** (version 1.70+ or 1.88+ recommended) with standard WinPcap compatibility mode.
   - Install **Wireshark** (includes `dumpcap.exe` at `C:\Program Files\Wireshark\dumpcap.exe`).
3. **Node.js (v18+) & npm** for the React 19 frontend dashboard.

---

## 2. Automatic Windows Environment Discovery

The NexTrace AI platform automatically discovers the local capture environment on startup:
- Detects OS version and Npcap driver availability.
- Locates `dumpcap.exe` on system PATH or default program directory.
- Runs `dumpcap -D` and cross-references active Windows network adapters (`Get-NetAdapter`).
- Identifies active Wi-Fi and Ethernet adapters with active link status and flags them as **★ Active Recommended**.

**No manual interface numbering or index configuration is required from the developer.**

---

## 3. Launching the Services

### Backend (FastAPI + Decoupled Dumpcap Service):
```powershell
cd nextrace-ai
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend (React 19 Dashboard):
```powershell
cd nextrace-ai
npm run dev
```

---

## 4. Operational Workflow: Automated Capture Self-Test

1. Navigate to **Live Monitoring** (`http://localhost:5173/live`).
2. Switch Ingestion Source to **Real Npcap / Dumpcap**.
3. The platform automatically selects the active recommended physical interface (e.g. `Wi-Fi`).
4. Click the **TEST CAPTURE** button.
5. The backend initiates a 5-second raw packet capture verification on the selected interface.
6. The UI displays the diagnostic result:
   - **PASS**: Shows captured packet count, bytes, throughput (Mbps), packet rate (pps), and zero drops.
   - **FAIL**: Shows the exact diagnostic error message or zero-packet warning.
7. Click **Start Live Capture** to begin continuous decoupled ingestion and attack forecasting.
