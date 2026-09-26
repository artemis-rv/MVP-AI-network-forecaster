<div align="center">

<!-- BANNER -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=2,11,20&height=180&section=header&text=NEXTRACE%20AI%20%F0%9F%9B%A1%EF%B8%8F&fontSize=42&fontColor=ffffff&animation=fadeIn&fontAlignY=36&desc=AI-Based%20Network%20Attack%20Forecasting%20%7C%20SIH26153&descSize=18&descAlignY=58" width="100%"/>

<!-- BADGES -->
<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi&logoColor=white"/>
  <img src="https://img.shields.io/badge/React%2019-Dashboard-646CFF?style=for-the-badge&logo=react&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-Frontend-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/100%25%20Offline-Air--Gapped%20Ready-000000?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/MITRE%20ATT%26CK-Stage%20Mapping-CC0000?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/SIH%202026-PS%2026153%20%C2%B7%20NTRO-FF6B35?style=for-the-badge"/>
</p>

<!-- LINKS -->
<p align="center">
  <a href="#">
    <img src="https://img.shields.io/badge/%E2%96%B6%EF%B8%8F%20Watch-Demo%20Video-red?style=for-the-badge&logo=youtube"/>
  </a>
</p>

</div>

---

> **SIH 2026 · Problem Statement SIH26153**  
> **Theme:** Blockchain & Cybersecurity  
> **Organization:** National Technical Research Organisation (NTRO)  
> *"Design and develop a software prototype that learns the evolving state of a computer network from traffic telemetry and predicts the likelihood and progression of malicious activity **before compromise is completed**... The core deliverable is a learned model of network state transition dynamics — **not a static classifier**."*

## Overview

**NEXTRACE AI** (*MVP AI Network Forecaster*) is a prototype web application and analytical backend designed for real-time network traffic monitoring, early-stage attack forecasting, historical PCAP forensic analysis, attack scenario simulation, automated security reporting, and alert management.

Designed for **government defense and intelligence operations**, NEXTRACE AI guarantees a **100% Offline / Air-Gapped** execution environment, ensuring all processing and inference happen locally without external dependencies. This architecture guarantees **Zero Data Leakage** and **Complete Data Sovereignty**.

**Traditional IDS:** “Is this individual flow malicious?”  
**NEXTRACE AI:** “Given the current network state, what is the probability $P(S_{t+1} \mid S_t)$ of transitioning into an attack stage in the next temporal window?”

NEXTRACE AI aggregates network packet streams into sliding temporal windows, computing **Delta & Trend Features** over historical context. It detects suspicious activity and forecasts upcoming attack stages before breach escalation occurs (e.g., predicting *Lateral Movement* or *Data Exfiltration* during early *Reconnaissance*), giving SOC Analysts, Incident Responders, and System Administrators proactive lead time.

---


## Core Deliverables

To fulfill the requirements of the NTRO for SIH26153 and stand out with "Extra Mile" implementations, this repository delivers:
1. **AI Network State Forecasting Engine:** A model that learns network state transition dynamics rather than acting as a static classifier.
2. **Dual Dashboards for Distinct Personas:**
   - **SOC Command Center:** A streamlined operational view for security analysts to monitor live alerts and forecasts.
   - **Data Scientist View:** A deep-dive interface for inspecting model feature weights, temporal trends, and tuning rules.
3. **Multi-Horizon Forecasting:** Forecasting network states multiple steps into the future concurrently ($t+1$, $t+2$, $t+3$) for extended lead time.
4. **Immutable Audit Ledger:** Incorporating SHA-256 cryptographic hashing for alerts and PCAP forensics to ensure tamper-proof logs, directly addressing the "Blockchain & Cybersecurity" theme.
5. **Autoregressive Attack Trajectory Simulator:** An engine that feeds predicted states back into the model to simulate complete, multi-step attacker campaigns.
6. **Explainable AI (XAI):** Utilizing feature weight visibility and planned SHAP/gradient attribution to explain visually *why* specific predictions are made.
7. **Strict Data Privacy:** Full support for air-gapped deployments ensures that highly sensitive network data never leaves the host machine.

---

## Core Idea & Workflow

Instead of evaluating packets in isolation, NEXTRACE AI models the network as a dynamic system. 

```text
Flow / PCAP Capture
        ↓
Feature Extraction (Delta & Trend Features, connection_rate, distinct IPs/ports)
        ↓
Temporal Network-State Windows (Sₜ)
        ↓
State Transition / Forecasting Engine
        ├── Predicts Next Stage: P(S_{t+1} | S_t)
        ├── Attributes Feature Weights (Explainable AI)
        └── Maps to MITRE ATT&CK
        ↓
Dual Dashboards (SOC Command Center & Data Scientist View)
```

NEXTRACE AI solves industry challenges through a unified workflow:
- **Live Demo Monitoring & Real-Time Forecasting**: Streams synthetic network events via WebSockets, aggregates traffic into temporal sliding windows, and forecasts current and upcoming attack stages.
- **Historical & Forensic Intelligence**: Uploads `.pcap`/`.pcapng` files, builds bidirectional network flows, logs evidence to an **Immutable Audit Ledger**, and tests forensic hypotheses.
- **Autoregressive Attack Trajectory Simulator**: Provides an in-memory simulation engine for running step-by-step synthetic attack scenarios and rolling them forward autoregressively.
- **Automated Report Builder**: Converts completed analysis into structured security reports with severity breakdowns and legal disclaimers.

---

## Key Features

### Implemented Features
- **Live Monitoring Dashboard**: Real-time packet event log table, active entity tracker, protocol distribution visualization, and session mode controls.
- **Attack Stage Forecasting**: Deterministic stage progression model (*Reconnaissance* → *Initial Access* → *Lateral Movement* → *Data Exfiltration*) with feature attribution.
- **WebSocket Feed (`/ws/live`)**: Asynchronous WebSocket streaming broadcasting packet events and forecast updates.
- **Historical PCAP Analysis & Immutable Ledger**: Background file parsing, flow extraction, **SHA-256 evidence hashing (Immutable Audit Ledger)**, and heuristic detection.
- **Forensic Reasoning Engine**: Automated analysis pipeline evaluating evidence integrity and anti-forensic indicators.
- **Autoregressive Attack Trajectory Simulator**: In-memory simulation runner supporting scenarios like `ransomware_exfil`, `apt_stealth_recon`, feeding predictions back into the state to model campaigns.
- **Automated Reporting & Alerts**: Generates multi-section reports and maintains a filterable security alerts system.
- **100% Offline / Air-Gapped Ready**: Operates fully offline with zero external API dependencies for maximum security in defense environments.

### Future / Planned Features (Roadmap)
- **Trained Deep Learning Sequence Model (LSTM / GNN)**: Upgrading the rule-based MVP engine to a supervised neural network trained on the **CSE-CIC-IDS2018** dataset.
- **Explainable AI (XAI) using SHAP**: Providing granular visual explanations for why the deep learning model made specific predictions to increase SOC analyst trust.
- **Persistent Database Storage**: Migrating from in-memory stores to PostgreSQL.
- **Live Interface Adapter Capture**: Capturing packets directly from physical network interfaces via PyPcap.

---

## Technology Stack

| Layer | Technology | Purpose |
|------|------------|---------|
| **Frontend Framework** | React 19 (TypeScript) | User interface component construction |
| **State & Routing** | Zustand 5 & React Router v7 | Global state management and client-side routing |
| **Visualization** | Recharts 3 & `@xyflow/react` | Metric charts and interactive network entity graphs |
| **Backend Framework** | FastAPI & Uvicorn | Asynchronous REST API and WebSocket server |
| **Packet Capture** | Scapy 2.5+ | In-memory packet construction and PCAP binary decoding |
| **Data Processing** | Pandas & NumPy | Data structures, array operations, and feature calculations |

---

## Project Structure

```text
MVP-AI-network-forecaster/
├── nextrace-ai/         # React 19 / Vite Frontend App
├── backend/             # Python FastAPI Backend & Core Engine
├── models/              # Saved AI/ML Models & Rulesets (Future)
└── docs/                # Architecture diagrams & Screenshots
```

---

## Setup & Running Locally

This section provides comprehensive setup instructions to deploy NEXTRACE AI on your local environment.

### Prerequisites
Ensure your system has the following installed:
- **Node.js** (v18.x or higher) and **npm**
- **Python** (3.10 or higher)
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/MVP-AI-network-forecaster.git
cd MVP-AI-network-forecaster/nextrace-ai
```

### 2. Backend Setup (FastAPI)
The backend is powered by Python and FastAPI. We recommend using a virtual environment to manage dependencies.

```bash
cd backend
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python main.py
```
*The backend API will run at `http://127.0.0.1:8000`. NEXTRACE AI provides interactive API documentation out-of-the-box. Access the Swagger UI at `http://127.0.0.1:8000/docs` to test endpoints directly.*

### 3. Frontend Setup (React/Vite)
Open a new terminal window, navigate to the frontend directory, and start the development server.

```bash
# From the root of the cloned repository navigate to the frontend folder
cd nextrace-ai

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```
*The React application will launch at `http://localhost:5173`. Open this URL in your browser to view the dashboards.*

### 4. Running Offline (Air-Gapped Environment)
To run the application in an air-gapped environment, ensure that all `npm` and `pip` dependencies are downloaded and cached locally on a machine with internet access. You can then transfer the project folder (including `node_modules` and the python `venv`) to your offline machine. Once installed, NEXTRACE AI requires no internet connection to operate fully.

---

## License & Acknowledgements

- **License:** This project is licensed under the MIT License - see the LICENSE file for details.
- **Acknowledgements:** Built for the Smart India Hackathon (SIH 2026), Problem Statement 26153 (National Technical Research Organisation).
