// NEXTRACE AI — Whole Network Graph with Attack Path & K-Step Forward Forecast
// 5-node clean topology: Threat Actor → Firewall → Web Server → Admin Station → Database
// Only the CURRENT active step shows a red malicious path. Previous steps are dimmed.
// Forecasted K-Steps ahead show glowing purple dashed lines.

import { useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ShieldAlert, Server, Database, Lock, Laptop, Target,
} from 'lucide-react';
import type { SimEvent, ForecastSnapshot } from '@/types/simulator';

export interface TopologyNodeInfo {
  id: string;
  ip: string;
  name: string;
  role: string;
  category: 'external' | 'gateway' | 'server' | 'workstation' | 'database';
  zone: string;
  x: number;
  y: number;
  os: string;
  ports: string;
}

// ─── 5-Node Clean Enterprise Topology ──────────────────────────────────────
// Arranged left-to-right in a single horizontal lane for clarity.
// Attack path flows cleanly L→R. Legitimate traffic is shown as quiet baselines.

export const ENTERPRISE_TOPOLOGY: TopologyNodeInfo[] = [
  {
    id: 'ext-attacker',
    ip: '203.0.113.42',
    name: 'Threat Actor',
    role: 'Adversary Ingress',
    category: 'external',
    zone: 'External WAN',
    x: 80,
    y: 120,
    os: 'Kali Linux / Automated C2',
    ports: 'Dynamic / Ephemeral',
  },
  {
    id: 'fw-edge',
    ip: '192.168.1.1',
    name: 'Edge Firewall',
    role: 'Perimeter Gateway',
    category: 'gateway',
    zone: 'DMZ Perimeter',
    x: 380,
    y: 120,
    os: 'FortiGate NGFW',
    ports: '80, 443, 22, 1194',
  },
  {
    id: 'srv-web',
    ip: '192.168.1.25',
    name: 'Web App Server',
    role: 'Public-Facing App',
    category: 'server',
    zone: 'DMZ Subnet',
    x: 380,
    y: 350,
    os: 'Ubuntu 22.04 (Nginx)',
    ports: '80, 443, 22',
  },
  {
    id: 'ws-admin',
    ip: '192.168.1.20',
    name: 'Admin Workstation',
    role: 'Privileged Endpoint',
    category: 'workstation',
    zone: 'Admin Subnet',
    x: 720,
    y: 120,
    os: 'Windows 11 Pro (RSAT)',
    ports: '22, 445, 5985',
  },
  {
    id: 'srv-db',
    ip: '192.168.1.50',
    name: 'Crown Jewel DB',
    role: 'Sensitive Database',
    category: 'database',
    zone: 'Isolated Data Tier',
    x: 720,
    y: 350,
    os: 'RHEL 9 (PostgreSQL/MSSQL)',
    ports: '5432, 1433',
  },
];

// Baseline network flows — shown as subtle grey lines when no attack is active
const BASELINE_CONNECTIONS = [
  { from: 'ext-attacker', to: 'fw-edge',   label: 'WAN' },
  { from: 'fw-edge',      to: 'srv-web',   label: 'HTTP/S' },
  { from: 'srv-web',      to: 'ws-admin',  label: 'Admin API' },
  { from: 'ws-admin',     to: 'srv-db',    label: 'DB Query' },
];

// Stage → which edge lights up (only current active step goes red)
export interface StagePathDefinition {
  stage: string;
  sourceId: string;
  targetId: string;
  protocol: string;
  technique: string;
  description: string;
  risk: number;
}

const STAGE_PATH_MAP: Record<string, StagePathDefinition> = {
  'Reconnaissance': {
    stage: 'Reconnaissance',
    sourceId: 'ext-attacker',
    targetId: 'fw-edge',
    protocol: 'TCP SYN Scan (80/443)',
    technique: 'T1046: Network Service Scanning',
    description: 'External threat actor scanning the perimeter firewall for open ports and services.',
    risk: 35,
  },
  'Initial Access': {
    stage: 'Initial Access',
    sourceId: 'ext-attacker',
    targetId: 'srv-web',
    protocol: 'TCP SSH (22)',
    technique: 'T1190: Exploit Public-Facing Application',
    description: 'Exploiting a web vulnerability to gain foothold on the Web App Server.',
    risk: 65,
  },
  'Internal Discovery': {
    stage: 'Internal Discovery',
    sourceId: 'srv-web',
    targetId: 'ws-admin',
    protocol: 'SMB / LDAP (389)',
    technique: 'T1087: Account & Domain Enumeration',
    description: 'Compromised web server probing internal hosts to locate privileged workstations.',
    risk: 75,
  },
  'Lateral Movement': {
    stage: 'Lateral Movement',
    sourceId: 'srv-web',
    targetId: 'ws-admin',
    protocol: 'WinRM (5985)',
    technique: 'T1021.002: Windows Admin Shares',
    description: 'Pivoting from web server into the privileged Admin Workstation.',
    risk: 88,
  },
  'Command & Control': {
    stage: 'Command & Control',
    sourceId: 'ws-admin',
    targetId: 'srv-db',
    protocol: 'HTTPS (443) Beacon',
    technique: 'T1071.001: Web Protocols — C2 Beaconing',
    description: 'Compromised admin station establishing C2 channel through DB egress route.',
    risk: 92,
  },
  'Data Exfiltration': {
    stage: 'Data Exfiltration',
    sourceId: 'srv-db',
    targetId: 'ext-attacker',
    protocol: 'TCP Encrypted (443)',
    technique: 'T1048.002: Exfiltration to Cloud Storage',
    description: 'Mass export of database records exfiltrated out to adversary external endpoint.',
    risk: 98,
  },
  'Persistence': {
    stage: 'Persistence',
    sourceId: 'ws-admin',
    targetId: 'srv-web',
    protocol: 'TCP Reverse Shell (4444)',
    technique: 'T1053: Scheduled Task / Persistence Hook',
    description: 'Secondary persistence backdoor planted on web server for resilience.',
    risk: 90,
  },
  'Impact': {
    stage: 'Impact',
    sourceId: 'ext-attacker',
    targetId: 'srv-db',
    protocol: 'Multi-stream Crypto',
    technique: 'T1486: Data Encrypted for Impact',
    description: 'Ransomware payload deploying across database and network shares.',
    risk: 100,
  },
};

// ─── Custom Node Component ─────────────────────────────────────────────────

function EnterpriseNodeComponent({ data }: NodeProps) {
  const node = data.node as TopologyNodeInfo;
  const status = data.threatStatus as 'active' | 'traversed' | 'projected' | 'benign';
  const isSelected = !!data.isSelected;

  const getTheme = () => {
    switch (status) {
      case 'active':
        return {
          bg: '#fee2e2',
          border: '#ef4444',
          text: '#991b1b',
          glow: '0 0 18px rgba(239,68,68,0.5)',
          badgeBg: '#dc2626',
          badgeText: '#fff',
          badgeLabel: '⚡ ACTIVE TARGET',
        };
      case 'traversed':
        // Dimmed pink — previously compromised, NOT bright red
        return {
          bg: 'var(--bg-card)',
          border: '#fca5a5',
          text: 'var(--text-primary)',
          glow: '0 0 4px rgba(252,165,165,0.2)',
          badgeBg: '#fca5a5',
          badgeText: '#7f1d1d',
          badgeLabel: '✓ Compromised',
        };
      case 'projected':
        return {
          bg: '#f5f3ff',
          border: '#8b5cf6',
          text: '#6d28d9',
          glow: '0 0 14px rgba(139,92,246,0.3)',
          badgeBg: '#8b5cf6',
          badgeText: '#fff',
          badgeLabel: data.forecastTag ? String(data.forecastTag) : 'FORECASTED',
        };
      default:
        return {
          bg: 'var(--bg-card)',
          border: 'var(--border-default)',
          text: 'var(--text-primary)',
          glow: '0 2px 8px rgba(0,0,0,0.06)',
          badgeBg: 'var(--bg-workspace)',
          badgeText: 'var(--text-muted)',
          badgeLabel: node.role,
        };
    }
  };

  const theme = getTheme();

  const getIcon = () => {
    switch (node.category) {
      case 'external': return <ShieldAlert size={17} color={status === 'active' ? '#ef4444' : '#94a3b8'} />;
      case 'gateway':  return <Lock size={17} color={status === 'active' ? '#ef4444' : 'var(--primary)'} />;
      case 'database': return <Database size={17} color={status === 'active' ? '#ef4444' : '#a855f7'} />;
      case 'server':   return <Server size={17} color={status === 'active' ? '#ef4444' : '#3b82f6'} />;
      case 'workstation':
      default: return <Laptop size={17} color={status === 'active' ? '#ef4444' : '#10b981'} />;
    }
  };

  return (
    <div style={{
      background: theme.bg,
      border: `2px solid ${isSelected ? 'var(--primary)' : theme.border}`,
      borderRadius: 12,
      padding: '10px 14px',
      minWidth: 140,
      maxWidth: 165,
      boxShadow: isSelected ? `0 0 0 3px rgba(99,102,241,0.25), ${theme.glow}` : theme.glow,
      transition: 'all 0.25s ease',
      cursor: 'pointer',
      textAlign: 'center',
      position: 'relative',
    }}>
      {/* Pulse ring for active node */}
      {status === 'active' && (
        <div style={{
          position: 'absolute', inset: -6, borderRadius: 16,
          border: '2.5px solid rgba(239,68,68,0.35)',
          animation: 'pulse 1.8s cubic-bezier(0.4,0,0.6,1) infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Status badge */}
      <div style={{
        fontSize: 8, fontWeight: 800, letterSpacing: '0.4px',
        color: theme.badgeText, background: theme.badgeBg,
        borderRadius: 999, padding: '2px 8px',
        display: 'inline-block', marginBottom: 6,
        textTransform: 'uppercase',
        opacity: status === 'benign' ? 0.5 : 1,
      }}>
        {theme.badgeLabel}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 3 }}>
        {getIcon()}
        <span style={{ fontSize: 11, fontWeight: 700, color: theme.text }}>{node.name}</span>
      </div>

      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 600 }}>
        {node.ip}
      </div>

      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>
        {node.zone}
      </div>

      <Handle type="target" position={Position.Left}  style={{ background: theme.border, width: 6, height: 6, border: '2px solid white' }} />
      <Handle type="source" position={Position.Right} style={{ background: theme.border, width: 6, height: 6, border: '2px solid white' }} />
    </div>
  );
}

// ─── Main WholeNetworkGraph Component ──────────────────────────────────────

interface WholeNetworkGraphProps {
  currentStage?: string | null;
  currentEvent?: SimEvent | null;
  stageSequence: string[];
  currentStep: number;
  totalSteps?: number;
  selectedStep: number | null;
  currentForecast?: ForecastSnapshot | null;
  previewStages?: string[];
  height?: number;
}

export function WholeNetworkGraph({
  currentStage: _currentStage,
  currentEvent: _currentEvent,
  stageSequence,
  currentStep,
  totalSteps: _totalSteps,
  selectedStep,
  currentForecast: _currentForecast,
  previewStages = [],
  height = 450,
}: WholeNetworkGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const activeStepIdx = selectedStep !== null ? selectedStep : currentStep;

  const { traversedStages, activeStageName, forecastedStages } = useMemo(() => {
    if (stageSequence.length === 0) {
      return { traversedStages: [], activeStageName: null, forecastedStages: previewStages };
    }
    if (activeStepIdx < 0) {
      return { traversedStages: [], activeStageName: null, forecastedStages: stageSequence };
    }
    const traversed = stageSequence.slice(0, activeStepIdx);
    const active = stageSequence[activeStepIdx] || null;
    const forecasted = stageSequence.slice(activeStepIdx + 1);
    return { traversedStages: traversed, activeStageName: active, forecastedStages: forecasted };
  }, [stageSequence, activeStepIdx, previewStages]);

  // Build nodes — only CURRENT active step makes nodes red, traversed are dimmed
  const nodes: Node[] = useMemo(() => {
    const activeSourceId = activeStageName ? STAGE_PATH_MAP[activeStageName]?.sourceId ?? '' : '';
    const activeTargetId = activeStageName ? STAGE_PATH_MAP[activeStageName]?.targetId ?? '' : '';

    const traversedNodeIds = new Set<string>();
    traversedStages.forEach(st => {
      const def = STAGE_PATH_MAP[st];
      if (def) {
        traversedNodeIds.add(def.sourceId);
        traversedNodeIds.add(def.targetId);
      }
    });

    const projectedNodeMap = new Map<string, string>();
    forecastedStages.forEach((st, idx) => {
      const def = STAGE_PATH_MAP[st];
      if (def && !projectedNodeMap.has(def.targetId)) {
        projectedNodeMap.set(def.targetId, `K+${idx + 1}: ${st}`);
      }
    });

    return ENTERPRISE_TOPOLOGY.map(n => {
      let threatStatus: 'active' | 'traversed' | 'projected' | 'benign' = 'benign';
      let forecastTag = '';

      if (n.id === activeTargetId || n.id === activeSourceId) {
        threatStatus = 'active';
      } else if (projectedNodeMap.has(n.id)) {
        threatStatus = 'projected';
        forecastTag = projectedNodeMap.get(n.id)!;
      } else if (traversedNodeIds.has(n.id)) {
        threatStatus = 'traversed';
      }

      return {
        id: n.id,
        type: 'enterpriseNode',
        position: { x: n.x, y: n.y },
        data: { node: n, threatStatus, forecastTag, isSelected: selectedNodeId === n.id },
      };
    });
  }, [traversedStages, activeStageName, forecastedStages, selectedNodeId]);

  // Build edges — ONLY the current active step edge is red, traversed are faded
  const edges: Edge[] = useMemo(() => {
    const edgeList: Edge[] = [];
    const highlightedLinks = new Set<string>();

    // 1. Current active step — bold glowing red (THE malicious path)
    if (activeStageName) {
      const def = STAGE_PATH_MAP[activeStageName];
      if (def) {
        const key = `${def.sourceId}-${def.targetId}`;
        highlightedLinks.add(key);
        edgeList.push({
          id: `active-${key}`,
          source: def.sourceId,
          target: def.targetId,
          animated: true,
          style: { stroke: '#dc2626', strokeWidth: 4, filter: 'drop-shadow(0 0 8px rgba(220,38,38,0.7))' },
          label: `⚡ ${activeStageName}`,
          labelStyle: { fontSize: 10, fontWeight: 800, fill: '#ffffff' },
          labelBgStyle: { fill: '#dc2626', fillOpacity: 1, rx: 6, ry: 6 },
        });
      }
    }

    // 2. Traversed steps — subtle faded pink (not distracting red)
    traversedStages.forEach((st, i) => {
      const def = STAGE_PATH_MAP[st];
      if (!def) return;
      const key = `${def.sourceId}-${def.targetId}`;
      if (!highlightedLinks.has(key)) {
        highlightedLinks.add(key);
        edgeList.push({
          id: `traversed-${i}-${key}`,
          source: def.sourceId,
          target: def.targetId,
          animated: false,
          style: { stroke: '#fca5a5', strokeWidth: 2, opacity: 0.8 },
          label: `✓ ${st}`,
          labelStyle: { fontSize: 8, fontWeight: 700, fill: '#9f1239' },
          labelBgStyle: { fill: '#fff1f2', fillOpacity: 0.85, rx: 4, ry: 4 },
        });
      }
    });

    // 3. Forecasted K-steps — glowing purple dashed
    forecastedStages.forEach((st, idx) => {
      const def = STAGE_PATH_MAP[st];
      if (!def) return;
      const key = `${def.sourceId}-${def.targetId}`;
      if (!highlightedLinks.has(key)) {
        highlightedLinks.add(key);
        edgeList.push({
          id: `forecast-${idx}-${key}`,
          source: def.sourceId,
          target: def.targetId,
          animated: true,
          style: { stroke: '#8b5cf6', strokeWidth: 2.5, strokeDasharray: '7,5', filter: 'drop-shadow(0 0 5px rgba(139,92,246,0.5))' },
          label: `🔮 K+${idx + 1}: ${st}`,
          labelStyle: { fontSize: 9, fontWeight: 700, fill: '#6d28d9' },
          labelBgStyle: { fill: '#f5f3ff', fillOpacity: 0.95, rx: 4, ry: 4 },
        });
      }
    });

    // 4. Baseline topology — quiet grey substrate flows
    BASELINE_CONNECTIONS.forEach((bc, idx) => {
      const key = `${bc.from}-${bc.to}`;
      if (!highlightedLinks.has(key)) {
        edgeList.push({
          id: `base-${idx}-${key}`,
          source: bc.from,
          target: bc.to,
          animated: false,
          style: { stroke: 'var(--border-default)', strokeWidth: 1.5, opacity: 0.45 },
          label: bc.label,
          labelStyle: { fontSize: 8, fill: 'var(--text-muted)' },
          labelBgStyle: { fill: 'var(--bg-card)', fillOpacity: 0.75, rx: 3, ry: 3 },
        });
      }
    });

    return edgeList;
  }, [traversedStages, activeStageName, forecastedStages]);

  const nodeTypes = useMemo(() => ({ enterpriseNode: EnterpriseNodeComponent }), []);

  const selectedNode = ENTERPRISE_TOPOLOGY.find(n => n.id === selectedNodeId);
  const activeDef = activeStageName ? STAGE_PATH_MAP[activeStageName] : null;

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border-default)', background: 'var(--bg-workspace)' }}>
      {/* Header Banner */}
      <div style={{
        padding: '10px 16px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Target size={14} color="var(--primary)" /> Enterprise Network · Attack Path Forecast
          </span>
          {activeStageName ? (
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>
              Step {activeStepIdx + 1} — {activeStageName}
            </span>
          ) : previewStages.length > 0 ? (
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }}>
              Preview: K={previewStages.length} Steps Forecasted
            </span>
          ) : null}
        </div>

        {/* Compact legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#dc2626' }}>
            <span style={{ width: 22, height: 3, background: '#dc2626', borderRadius: 2, display: 'inline-block' }} />
            Active Threat
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#fca5a5' }}>
            <span style={{ width: 22, height: 2, background: '#fca5a5', borderRadius: 2, display: 'inline-block' }} />
            Prior Steps
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#8b5cf6' }}>
            <span style={{ width: 22, height: 2, background: '#8b5cf6', borderRadius: 2, borderStyle: 'dashed', display: 'inline-block' }} />
            K-Step Forecast
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
            <span style={{ width: 22, height: 1.5, background: 'var(--border-default)', display: 'inline-block', opacity: 0.6 }} />
            Legitimate
          </div>
        </div>
      </div>

      {/* ReactFlow Canvas */}
      <div style={{ height, width: '100%', position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedNodeId(node.id === selectedNodeId ? null : node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          nodesDraggable
          panOnDrag
          zoomOnScroll={false}
        >
          <Background color="var(--border-subtle)" gap={24} />
          <Controls position="bottom-right" />
        </ReactFlow>

        {/* Node Details Overlay */}
        {selectedNode && (
          <div style={{
            position: 'absolute', bottom: 12, left: 12, zIndex: 30,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: '12px 16px',
            maxWidth: 300,
            boxShadow: 'var(--shadow-md)',
            fontSize: 11,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>{selectedNode.name}</span>
              <button onClick={() => setSelectedNodeId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '4px 8px', color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--text-muted)' }}>IP:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{selectedNode.ip}</span>
              <span style={{ color: 'var(--text-muted)' }}>Role:</span>
              <span>{selectedNode.role}</span>
              <span style={{ color: 'var(--text-muted)' }}>Zone:</span>
              <span>{selectedNode.zone}</span>
              <span style={{ color: 'var(--text-muted)' }}>OS:</span>
              <span>{selectedNode.os}</span>
              <span style={{ color: 'var(--text-muted)' }}>Ports:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{selectedNode.ports}</span>
            </div>
          </div>
        )}

        {/* Active Stage Detail Overlay — bottom right */}
        {activeDef && (
          <div style={{
            position: 'absolute', bottom: 12, right: 12, zIndex: 30,
            background: '#fee2e2',
            border: '1.5px solid #fca5a5',
            borderRadius: 10,
            padding: '10px 14px',
            maxWidth: 280,
            boxShadow: '0 4px 16px rgba(220,38,38,0.15)',
            fontSize: 11,
          }}>
            <div style={{ fontWeight: 800, fontSize: 12, color: '#b91c1c', marginBottom: 4 }}>
              ⚡ {activeDef.stage}
            </div>
            <div style={{ fontSize: 10, color: '#7f1d1d', marginBottom: 4 }}>
              {activeDef.technique}
            </div>
            <div style={{ fontSize: 10, color: '#991b1b', lineHeight: 1.5 }}>
              {activeDef.description}
            </div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, color: '#7f1d1d' }}>Risk:</span>
              <div style={{ flex: 1, background: '#fecaca', borderRadius: 999, height: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${activeDef.risk}%`, background: '#dc2626', borderRadius: 999 }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#b91c1c' }}>{activeDef.risk}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
