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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ShieldAlert, Server, Laptop, Target } from 'lucide-react';
import { useSimplifiedSimulatorStore, TopologyNode } from '@/store/simplifiedSimulatorStore';

function EnterpriseNodeComponent({ data }: NodeProps) {
  const node = data.node as TopologyNode;
  const status = data.status as 'compromised' | 'target' | 'normal' | 'candidate';

  const getTheme = () => {
    switch (status) {
      case 'compromised':
        return { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', badgeBg: '#dc2626', badgeText: '#fff', badgeLabel: 'Compromised', glow: '0 0 15px rgba(239,68,68,0.5)' };
      case 'candidate':
        return { bg: '#f5f3ff', border: '#8b5cf6', text: '#6d28d9', badgeBg: '#8b5cf6', badgeText: '#fff', badgeLabel: 'Candidate', glow: '0 0 10px rgba(139,92,246,0.3)' };
      case 'target':
        return { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', badgeBg: '#dc2626', badgeText: '#fff', badgeLabel: 'Active Target', glow: '0 0 15px rgba(239,68,68,0.5)' };
      default:
        return { bg: 'var(--bg-card)', border: 'var(--border-default)', text: 'var(--text-primary)', badgeBg: 'var(--bg-workspace)', badgeText: 'var(--text-muted)', badgeLabel: node.role, glow: '0 2px 8px rgba(0,0,0,0.06)' };
    }
  };

  const theme = getTheme();

  const getIcon = () => {
    switch (node.category) {
      case 'external': return <ShieldAlert size={17} color={theme.text} />;
      case 'server':
      case 'database': return <Server size={17} color={theme.text} />;
      case 'gateway': return <Target size={17} color={theme.text} />;
      default: return <Laptop size={17} color={theme.text} />;
    }
  };

  return (
    <div
      onClick={() => (data.onClick as Function)?.(node)}
      style={{
        background: theme.bg,
        border: `2px solid ${theme.border}`,
        borderRadius: 12,
        padding: '12px 16px',
        minWidth: 160,
        boxShadow: theme.glow,
        color: theme.text,
        transition: 'all 0.3s ease',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {getIcon()}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: '-0.3px', lineHeight: 1.1 }}>
            {node.name}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.8, marginTop: 2 }}>
            {node.ip}
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
          background: theme.badgeBg, color: theme.badgeText,
          textTransform: 'uppercase', letterSpacing: '0.4px',
        }}>
          {theme.badgeLabel}
        </span>
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { enterprise: EnterpriseNodeComponent };

export function SimplifiedWholeNetworkGraph({ onNodeClick }: { onNodeClick: (node: TopologyNode) => void }) {
  const { compromisedNodes, attackChain, candidateEdges, snapshotNodes, snapshotEdges } = useSimplifiedSimulatorStore();

  const activeTargetId = attackChain.length > 0 ? attackChain[attackChain.length - 1].targetId : null;

  const nodes: Node[] = useMemo(() => {
    // Dynamic layout based on category
    const columns: Record<string, number> = {
      'suspicious': 0,
      'external': 1,
      'gateway': 2,
      'server': 3,
      'workstation': 3,
      'database': 4,
      'internal': 4
    };
    
    const counts = [0, 0, 0, 0, 0, 0];
    
    return snapshotNodes.map(node => {
      let status = 'normal';
      if (node.id === activeTargetId) {
        status = 'target';
      } else if (compromisedNodes.has(node.id)) {
        status = 'compromised';
      } else if (candidateEdges.some(c => c.target === node.id)) {
        status = 'candidate';
      }

      const colIdx = columns[node.category] ?? 5;
      const x = colIdx * 300;
      const y = counts[colIdx] * 120 + 50;
      counts[colIdx]++;

      return {
        id: node.id,
        type: 'enterprise',
        position: { x, y },
        data: { node, status, onClick: onNodeClick },
      };
    });
  }, [snapshotNodes, compromisedNodes, activeTargetId, candidateEdges, onNodeClick]);

  const edges: Edge[] = useMemo(() => {
    return snapshotEdges.map(edge => {
      // Is this edge part of the confirmed attack chain?
      const isConfirmed = attackChain.some(step => step.sourceId === edge.source && step.targetId === edge.target);
      // Is this edge a candidate?
      const candidateInfo = candidateEdges.find(c => c.source === edge.source && c.target === edge.target);
      const isCandidate = !!candidateInfo;

      let color = 'var(--border-default)';
      let width = 1.5;
      let strokeDasharray = 'none';
      let animated = false;

      if (isConfirmed) {
        color = '#ef4444'; // Red for confirmed
        width = 3;
      } else if (isCandidate) {
        color = '#f59e0b'; // Amber/Orange for candidate
        width = 2;
        strokeDasharray = '5 5';
        animated = true;
      } else if (edge.isObservedAttack) {
        color = '#ef4444'; // Red for observed attack
        width = 3;
      }

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated,
        style: { stroke: color, strokeWidth: width, strokeDasharray },
        label: isCandidate ? `Priority: ${candidateInfo.priority}` : edge.protocol,
        labelStyle: { fill: color, fontWeight: 700, fontSize: 10 },
        labelBgStyle: { fill: 'var(--bg-card)', fillOpacity: 0.8 },
      };
    });
  }, [snapshotEdges, attackChain, candidateEdges]);

  return (
    <div style={{ width: '100%', height: 500, background: 'var(--bg-workspace)', borderRadius: 12, border: '1px solid var(--border-default)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background gap={16} size={1} color="var(--border-default)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
