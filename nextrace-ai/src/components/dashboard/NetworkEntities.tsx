import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { networkNodes, networkEdges } from '@/data/mockData';
import { Info, AlertTriangle } from 'lucide-react';
import type { LiveNode, LiveEdge } from '@/types/live';

// Adapter: convert LiveNode to the internal node shape
function adaptLiveNodes(nodes: LiveNode[]) {
  return nodes.map(n => ({
    id: n.id,
    label: n.ip,
    type: n.type as 'internal' | 'suspicious' | 'server' | 'external',
    x: n.x,
    y: n.y,
    ip: n.ip,
    status: n.type === 'suspicious' ? 'Suspicious' : 'Active',
    connections: 1,
    riskScore: n.type === 'suspicious' ? 85 : 20,
  }));
}

function adaptLiveEdges(edges: LiveEdge[]) {
  return edges.map(e => ({
    from: e.from,
    to: e.to,
    label: e.label,
    suspicious: e.suspicious,
    strength: e.suspicious ? 'high' : 'medium',
  }));
}

type NodeType = 'internal' | 'suspicious' | 'server' | 'external';

const NODE_COLORS: Record<NodeType, { bg: string; border: string; text: string; shadow: string }> = {
  internal: { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8', shadow: 'rgba(59,130,246,0.2)' },
  suspicious: { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c', shadow: 'rgba(239,68,68,0.3)' },
  server: { bg: '#f0fdf4', border: '#10b981', text: '#065f46', shadow: 'rgba(16,185,129,0.2)' },
  external: { bg: '#f5f3ff', border: '#8b5cf6', text: '#6d28d9', shadow: 'rgba(139,92,246,0.2)' },
};


export function NetworkEntities({ nodes: propNodes, edges: propEdges }: { nodes?: LiveNode[]; edges?: LiveEdge[] } = {}) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const navigate = useNavigate();

  // Use live data if provided, else fall back to mock
  const nodes = propNodes ? adaptLiveNodes(propNodes) : networkNodes;
  const edges = propEdges ? adaptLiveEdges(propEdges) : networkEdges;
  const isLiveData = !!propNodes;

  const isEdgeHighlighted = useCallback((from: string, to: string) => {
    if (!hoveredNode && !selectedNode) return false;
    const active = hoveredNode || selectedNode;
    return from === active || to === active;
  }, [hoveredNode, selectedNode]);

  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {isLiveData ? 'Live Network Entities' : 'Global Network Entities'}
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {isLiveData ? `${nodes.length} entities discovered` : 'Click a node to inspect · Hover to highlight connections'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {(Object.entries(NODE_COLORS) as [NodeType, typeof NODE_COLORS[NodeType]][]).map(([type, c]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.border }} />
              <span style={{ textTransform: 'capitalize' }}>{type}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', height: 300, background: 'var(--bg-workspace)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        {/* SVG Graph */}
        <svg width="100%" height="100%" viewBox="-20 0 820 300" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0 }}>
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="var(--border-subtle)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Edges */}
          {edges.map((edge, i) => {
            const from = nodes.find(n => n.id === edge.from);
            const to   = nodes.find(n => n.id === edge.to);
            if (!from || !to) return null;
            const highlighted = isEdgeHighlighted(edge.from, edge.to);
            const isSuspicious = (from.type === 'suspicious' || to.type === 'suspicious') || !!(edge as {suspicious?: boolean}).suspicious;

            return (
              <g key={i}>
                <line
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke={highlighted ? (isSuspicious ? '#ef4444' : '#6366f1') : '#e2e8f0'}
                  strokeWidth={highlighted ? 2 : 1}
                  strokeDasharray={isSuspicious ? '5,3' : 'none'}
                  style={{ transition: 'all 0.2s' }}
                />
                {highlighted && (
                  <text
                    x={(from.x + to.x) / 2}
                    y={(from.y + to.y) / 2 - 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill={isSuspicious ? '#ef4444' : '#6366f1'}
                    fontWeight={600}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const c = NODE_COLORS[node.type as NodeType];
            const isHovered = hoveredNode === node.id;
            const isSelected = selectedNode === node.id;
            const active = isHovered || isSelected;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => {
                  setSelectedNode(selectedNode === node.id ? null : node.id);
                }}
              >
                {/* Glow ring */}
                {active && (
                  <circle r={28} fill="none" stroke={c.border} strokeWidth={1.5} opacity={0.4} />
                )}
                {/* Node circle */}
                <circle
                  r={active ? 24 : 20}
                  fill={c.bg}
                  stroke={c.border}
                  strokeWidth={active ? 2.5 : 1.5}
                  filter={active ? `drop-shadow(0 0 8px ${c.shadow})` : 'none'}
                  style={{ transition: 'all 0.2s' }}
                />
                {/* IP label */}
                <text textAnchor="middle" y={-30} fontSize={9} fill={c.text} fontWeight={700}>
                  {node.ip}
                </text>
                {/* Type label */}
                <text textAnchor="middle" y={32} fontSize={9} fill="var(--text-muted)" fontWeight={500}>
                  {node.label}
                </text>
                {/* Icon shape */}
                {node.type === 'suspicious' ? (
                  <g transform="translate(0, 0)">
                    <path d="M 0 -6 L 6 5 L -6 5 Z" fill={c.border} />
                    <line x1="0" y1="-2" x2="0" y2="1" stroke="white" strokeWidth="1.2" />
                    <circle cx="0" cy="3" r="0.6" fill="white" />
                  </g>
                ) : node.type === 'server' ? (
                  <rect x="-5" y="-5" width="10" height="10" rx="2" fill="none" stroke={c.border} strokeWidth="1.5" />
                ) : node.type === 'external' ? (
                  <polygon points="0,-6 6,0 0,6 -6,0" fill="none" stroke={c.border} strokeWidth="1.5" />
                ) : (
                  <circle r="4" fill="none" stroke={c.border} strokeWidth="1.5" />
                )}
              </g>
            );
          })}
        </svg>

        {/* Entity Info Panel */}
        {selectedNode && selectedNodeData && (
          <div
            className="animate-slide-in-right"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 200,
              background: 'white',
              borderRadius: 12,
              border: `1px solid ${NODE_COLORS[selectedNodeData.type as NodeType].border}`,
              boxShadow: 'var(--shadow-md)',
              padding: '14px',
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedNodeData.ip}</div>
                <div style={{ fontSize: 11, color: NODE_COLORS[selectedNodeData.type as NodeType].border, fontWeight: 600, textTransform: 'capitalize', marginTop: 2 }}>
                  {selectedNodeData.type}
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
              <strong>Role:</strong> {selectedNodeData.label}
            </div>
            {selectedNodeData.type === 'suspicious' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--color-critical-light)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: 11,
                  color: 'var(--color-critical)',
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                <span>Threat Active — 3 alerts linked</span>
              </div>
            )}
            <button
              onClick={() => {
                const ip = selectedNodeData.ip;
                navigate(`/investigation?ip=${encodeURIComponent(ip)}&source=entity`);
              }}
              style={{
                width: '100%',
                padding: '7px',
                borderRadius: 7,
                border: '1px solid var(--primary)',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)'; }}
            >
              <Info size={11} />
              Investigate Entity →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
