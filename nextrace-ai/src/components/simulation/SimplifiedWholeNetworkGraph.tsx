import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ShieldAlert, Server, Laptop, Database, Lock, ShieldCheck } from 'lucide-react';
import { useSimplifiedSimulatorStore, TopologyNode } from '@/store/simplifiedSimulatorStore';

function EnterpriseNodeComponent({ data }: NodeProps) {
  const node = data.node as TopologyNode;
  const status = data.status as 'compromised' | 'target' | 'candidate' | 'projected' | 'normal';
  const isSelected = !!data.isSelected;

  const getTheme = () => {
    switch (status) {
      case 'target':
        return {
          bg: '#fee2e2',
          border: '#dc2626',
          text: '#991b1b',
          badgeBg: '#dc2626',
          badgeText: '#fff',
          badgeLabel: '⚡ ACTIVE TARGET',
          glow: '0 0 20px rgba(220,38,38,0.5)',
        };
      case 'compromised':
        return {
          bg: 'var(--bg-card)',
          border: '#ef4444',
          text: 'var(--text-primary)',
          badgeBg: '#fee2e2',
          badgeText: '#b91c1c',
          badgeLabel: node.category === 'suspicious' ? '⚠️ SUSPICIOUS' : '💥 COMPROMISED',
          glow: '0 0 8px rgba(239,68,68,0.25)',
        };
      case 'candidate':
        return {
          bg: '#fffbeb',
          border: '#f59e0b',
          text: '#92400e',
          badgeBg: '#f59e0b',
          badgeText: '#fff',
          badgeLabel: '🔮 PREDICTED NEXT',
          glow: '0 0 16px rgba(245,158,11,0.4)',
        };
      case 'projected':
        return {
          bg: '#f5f3ff',
          border: '#8b5cf6',
          text: '#6d28d9',
          badgeBg: '#8b5cf6',
          badgeText: '#fff',
          badgeLabel: data.projectedTag ? String(data.projectedTag) : '⏳ PROJECTED',
          glow: '0 0 10px rgba(139,92,246,0.25)',
        };
      default:
        return {
          bg: 'var(--bg-card)',
          border: 'var(--border-default)',
          text: 'var(--text-primary)',
          badgeBg: 'var(--bg-workspace)',
          badgeText: 'var(--text-muted)',
          badgeLabel: node.criticality ? `${node.criticality} Priority` : node.role,
          glow: '0 2px 8px rgba(0,0,0,0.04)',
        };
    }
  };

  const theme = getTheme();

  const getIcon = () => {
    if (node.category === 'suspicious') return <ShieldAlert size={17} color={theme.text} />;
    if (node.category === 'gateway') return <ShieldCheck size={17} color={theme.text} />;
    if (node.category === 'database') return <Database size={17} color={theme.text} />;
    if (node.role.includes('Domain Controller') || node.ports.includes('88')) return <Lock size={17} color={theme.text} />;
    if (node.category === 'server') return <Server size={17} color={theme.text} />;
    return <Laptop size={17} color={theme.text} />;
  };

  return (
    <div
      onClick={() => (data.onClick as Function)?.(node)}
      style={{
        background: theme.bg,
        border: `2px solid ${isSelected ? 'var(--primary)' : theme.border}`,
        borderRadius: 12,
        padding: '10px 14px',
        minWidth: 170,
        maxWidth: 200,
        boxShadow: isSelected ? `0 0 0 3px rgba(99,102,241,0.3), ${theme.glow}` : theme.glow,
        color: theme.text,
        transition: 'all 0.25s ease',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />

      {/* Pulse ring for active target */}
      {status === 'target' && (
        <div style={{
          position: 'absolute', inset: -5, borderRadius: 16,
          border: '2px solid rgba(220,38,38,0.6)',
          animation: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Top Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{
          fontSize: 8, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
          background: theme.badgeBg, color: theme.badgeText,
          textTransform: 'uppercase', letterSpacing: '0.4px',
        }}>
          {theme.badgeLabel}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>
          {node.zone.split(' ')[0]}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          border: '1px solid rgba(0,0,0,0.06)'
        }}>
          {getIcon()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: '-0.3px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {node.name}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
            {node.ip}
          </div>
        </div>
      </div>

      {/* Vulnerabilities snippet */}
      {node.vulnerabilities.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid rgba(0,0,0,0.05)', fontSize: 9, color: '#dc2626', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          ⚠️ {node.vulnerabilities[0]}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { enterprise: EnterpriseNodeComponent };

export function SimplifiedWholeNetworkGraph({ onNodeClick }: { onNodeClick: (node: TopologyNode) => void }) {
  const {
    compromisedNodes,
    attackChain,
    candidateEdges,
    projectedPlan,
    snapshotNodes,
    snapshotEdges,
    currentStep
  } = useSimplifiedSimulatorStore();

  const activeTargetId = attackChain.length > 0 ? attackChain[attackChain.length - 1].targetId : null;
  const bestCandidateTarget = candidateEdges.length > 0 ? candidateEdges[0].target : null;

  const nodes: Node[] = useMemo(() => {
    // Explicit fixed column placements for clean deterministic network topology
    // Col 0: Attacker (x: 40)
    // Col 1: Gateway / Perimeter (x: 280)
    // Col 2: DMZ Web Server (x: 520)
    // Col 3: App Server & Workstations (x: 770)
    // Col 4: DC & Crown Jewel DB (x: 1030)
    const positionsByIp: Record<string, { x: number; y: number }> = {
      '198.51.100.44': { x: 40, y: 150 },   // Attacker
      '10.0.0.1':      { x: 270, y: 150 },  // Gateway
      '10.0.1.10':     { x: 500, y: 100 },  // DMZ Web App
      '10.0.2.15':     { x: 740, y: 50 },   // App Core Server
      '10.0.2.55':     { x: 740, y: 190 },  // Admin Workstation
      '10.0.2.60':     { x: 740, y: 320 },  // HR Workstation
      '10.0.3.5':      { x: 990, y: 80 },   // Domain Controller
      '10.0.3.20':     { x: 990, y: 250 },  // Production SQL Database
    };

    const dynamicColCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    return snapshotNodes.map((node) => {
      let status: 'compromised' | 'target' | 'candidate' | 'projected' | 'normal' = 'normal';
      let projectedTag = '';

      if (node.id === activeTargetId && currentStep > 0) {
        status = 'target';
      } else if (compromisedNodes.has(node.id)) {
        status = 'compromised';
      } else if (node.id === bestCandidateTarget) {
        status = 'candidate';
      } else {
        // Check if node is part of future projected plan
        const futureStep = projectedPlan.find(p => p.targetId === node.id && p.status === 'projected');
        if (futureStep) {
          status = 'projected';
          projectedTag = `K+${futureStep.step}`;
        }
      }

      let pos = positionsByIp[node.ip] || positionsByIp[node.id];
      if (!pos) {
        const colMap: Record<string, number> = {
          'suspicious': 0, 'gateway': 1, 'server': 2, 'workstation': 3, 'database': 4
        };
        const col = colMap[node.category] ?? 3;
        const count = dynamicColCounts[col] || 0;
        dynamicColCounts[col] = count + 1;
        pos = { x: 40 + col * 240, y: 70 + count * 140 };
      }

      return {
        id: node.id,
        type: 'enterprise',
        position: pos,
        data: {
          node,
          status,
          projectedTag,
          onClick: onNodeClick
        },
      };
    });
  }, [snapshotNodes, compromisedNodes, activeTargetId, bestCandidateTarget, projectedPlan, currentStep, onNodeClick]);

  const edges: Edge[] = useMemo(() => {
    return snapshotEdges.map(edge => {
      const isConfirmed = attackChain.some(
        step => (step.sourceId === edge.source && step.targetId === edge.target) ||
                (step.sourceId === edge.target && step.targetId === edge.source)
      );

      const candidateInfo = candidateEdges.find(
        c => (c.source === edge.source && c.target === edge.target) ||
             (c.source === edge.target && c.target === edge.source)
      );
      const isCandidate = !!candidateInfo;

      const isFutureProjected = !isConfirmed && !isCandidate && projectedPlan.some(
        p => p.status === 'projected' &&
             ((p.sourceId === edge.source && p.targetId === edge.target) ||
              (p.sourceId === edge.target && p.targetId === edge.source))
      );

      let color = 'var(--border-default)';
      let width = 1.5;
      let strokeDasharray = 'none';
      let animated = false;
      let label = edge.protocol;
      let labelFill = 'var(--text-muted)';
      let labelBg = 'var(--bg-card)';
      let markerEnd: any = undefined;

      if (isConfirmed) {
        color = '#ef4444';
        width = 3.5;
        animated = true;
        label = `💥 Compromised (${edge.protocol})`;
        labelFill = '#ef4444';
        labelBg = '#fee2e2';
        markerEnd = { type: MarkerType.ArrowClosed, color: '#ef4444', width: 20, height: 20 };
      } else if (isCandidate) {
        color = '#f59e0b';
        width = 2.5;
        strokeDasharray = '6 4';
        animated = true;
        label = `⚡ Next Step: ${candidateInfo.techniqueId} (${candidateInfo.priority}% Risk)`;
        labelFill = '#b45309';
        labelBg = '#fef3c7';
        markerEnd = { type: MarkerType.ArrowClosed, color: '#f59e0b', width: 18, height: 18 };
      } else if (isFutureProjected) {
        color = '#8b5cf6';
        width = 2;
        strokeDasharray = '4 4';
        animated = true;
        label = `⏳ Projected Vector`;
        labelFill = '#6d28d9';
        labelBg = '#ede9fe';
      }

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated,
        style: { stroke: color, strokeWidth: width, strokeDasharray },
        markerEnd,
        label,
        labelStyle: { fill: labelFill, fontWeight: 700, fontSize: 9 },
        labelBgStyle: { fill: labelBg, fillOpacity: 0.95, rx: 4, ry: 4 },
      };
    });
  }, [snapshotEdges, attackChain, candidateEdges, projectedPlan]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 500, background: 'var(--bg-workspace)', borderRadius: 12, border: '1px solid var(--border-default)', overflow: 'hidden' }}>
      {/* Topology Header Legend */}
      <div style={{
        position: 'absolute', top: 12, left: 16, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
        padding: '6px 14px', borderRadius: 999, border: '1px solid var(--border-subtle)',
        fontSize: 11, fontWeight: 700, boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} /> Confirmed Attack
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} /> Candidate (Next Step)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8b5cf6' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6' }} /> Future Projected Horizon
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--border-default)' }} /> Monitored Baseline
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        elementsSelectable={true}
      >
        <Background gap={18} size={1} color="var(--border-default)" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
