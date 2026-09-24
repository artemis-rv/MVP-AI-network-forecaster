// NEXTRACE AI — Historical Network Graph
// High-fidelity interactive network entity relationship visualization for real PCAP captures.

import { useCallback, useMemo, useEffect, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection,
  Position, Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { EntityRelationship } from '@/types/historical';
import { ShieldAlert, Globe, Server, ArrowRightLeft, X } from 'lucide-react';

// ── Node data interface ───────────────────────────────────────────────────────

interface HistNodeData {
  ip: string;
  isSrc: boolean;
  isDst: boolean;
  isSuspicious: boolean;
  packetCount: number;
  byteCount: number;
  protocols: string[];
  ports: number[];
  peerCount: number;
}

function formatBytes(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1024)      return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}

// ── Custom Node Component ─────────────────────────────────────────────────────

function HistIpNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const d = data as unknown as HistNodeData;
  
  const borderColor = d.isSuspicious
    ? '#ef4444'
    : d.isSrc && d.isDst
      ? '#8b5cf6'
      : d.isSrc
        ? '#6366f1'
        : '#06b6d4';

  const badgeBg = d.isSuspicious
    ? '#fee2e2'
    : d.isSrc && d.isDst
      ? '#ede9fe'
      : d.isSrc
        ? '#e0e7ff'
        : '#cffafe';

  const badgeText = d.isSuspicious
    ? '#991b1b'
    : d.isSrc && d.isDst
      ? '#5b21b6'
      : d.isSrc
        ? '#3730a3'
        : '#155e75';

  return (
    <div
      style={{
        background: d.isSuspicious ? '#fff5f5' : '#ffffff',
        border: `2px solid ${selected ? '#2563eb' : borderColor}`,
        borderRadius: 12,
        padding: '10px 14px',
        minWidth: 150,
        boxShadow: selected
          ? `0 0 0 3px rgba(37,99,235,0.3), 0 4px 14px rgba(0,0,0,0.12)`
          : d.isSuspicious
            ? `0 0 14px ${borderColor}35`
            : '0 2px 10px rgba(0,0,0,0.06)',
        position: 'relative',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: borderColor, border: '2px solid white', width: 9, height: 9 }}
      />

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              padding: '2px 6px',
              borderRadius: 6,
              background: badgeBg,
              color: badgeText,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            {d.isSuspicious ? (
              <>
                <ShieldAlert size={10} /> SUSPICIOUS
              </>
            ) : d.isSrc && d.isDst ? (
              <>
                <ArrowRightLeft size={10} /> BRIDGE / HUB
              </>
            ) : d.isSrc ? (
              <>
                <Globe size={10} /> SOURCE
              </>
            ) : (
              <>
                <Server size={10} /> TARGET
              </>
            )}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>
            {d.peerCount} {d.peerCount === 1 ? 'peer' : 'peers'}
          </span>
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#0f172a', letterSpacing: '-0.3px' }}>
          {d.ip}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 10, color: '#64748b' }}>
          <span>{d.packetCount.toLocaleString()} pkts</span>
          <span>{formatBytes(d.byteCount)}</span>
        </div>

        {d.protocols && d.protocols.length > 0 && (
          <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
            {d.protocols.slice(0, 3).map(p => (
              <span key={p} style={{ fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 4, background: '#f1f5f9', color: '#475569' }}>
                {p}
              </span>
            ))}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: borderColor, border: '2px solid white', width: 9, height: 9 }}
      />
    </div>
  );
}

const NODE_TYPES = { histIpNode: HistIpNode };

// ── Smart Grid / Layered Layout Algorithm ─────────────────────────────────────

function _layoutNodes(relationships: EntityRelationship[]): Node[] {
  if (!relationships || relationships.length === 0) return [];

  const ipMeta: Map<string, {
    isSrc: boolean;
    isDst: boolean;
    isSuspicious: boolean;
    packetCount: number;
    byteCount: number;
    protocols: Set<string>;
    ports: Set<number>;
    peers: Set<string>;
  }> = new Map();

  for (const rel of relationships) {
    // Source host
    const s = ipMeta.get(rel.src_ip) ?? {
      isSrc: false, isDst: false, isSuspicious: false,
      packetCount: 0, byteCount: 0,
      protocols: new Set(), ports: new Set(), peers: new Set(),
    };
    s.isSrc = true;
    s.packetCount += rel.packet_count;
    s.byteCount += rel.byte_count;
    rel.protocols.forEach(p => s.protocols.add(p));
    rel.ports.forEach(p => s.ports.add(p));
    s.peers.add(rel.dst_ip);
    if (rel.is_suspicious) s.isSuspicious = true;
    ipMeta.set(rel.src_ip, s);

    // Destination host
    const d = ipMeta.get(rel.dst_ip) ?? {
      isSrc: false, isDst: false, isSuspicious: false,
      packetCount: 0, byteCount: 0,
      protocols: new Set(), ports: new Set(), peers: new Set(),
    };
    d.isDst = true;
    d.packetCount += rel.packet_count;
    d.byteCount += rel.byte_count;
    rel.protocols.forEach(p => d.protocols.add(p));
    rel.ports.forEach(p => d.ports.add(p));
    d.peers.add(rel.src_ip);
    if (rel.is_suspicious) d.isSuspicious = true;
    ipMeta.set(rel.dst_ip, d);
  }

  const ips = Array.from(ipMeta.entries());
  const cols: string[][] = [[], [], []]; // 0: src-only, 1: both (bridges/gateways), 2: dst-only

  for (const [ip, meta] of ips) {
    if (meta.isSrc && !meta.isDst)      cols[0].push(ip);
    else if (meta.isSrc && meta.isDst)  cols[1].push(ip);
    else                                cols[2].push(ip);
  }

  // If a column is empty, rebalance
  if (cols[0].length === 0 && cols[1].length > 2) {
    const half = Math.ceil(cols[1].length / 2);
    cols[0] = cols[1].slice(0, half);
    cols[1] = cols[1].slice(half);
  }

  const nodes: Node[] = [];
  const X_GAP = 280;
  const Y_GAP = 120;
  const MAX_PER_SUBCOL = 6;

  cols.forEach((colIps, colIdx) => {
    colIps.forEach((ip, idx) => {
      const meta = ipMeta.get(ip)!;
      const subCol = Math.floor(idx / MAX_PER_SUBCOL);
      const rowInSubCol = idx % MAX_PER_SUBCOL;

      const posX = colIdx * X_GAP + (subCol * 190);
      const posY = rowInSubCol * Y_GAP;

      nodes.push({
        id:       ip,
        type:     'histIpNode',
        position: { x: posX, y: posY },
        data:     {
          ip,
          isSrc:        meta.isSrc,
          isDst:        meta.isDst,
          isSuspicious: meta.isSuspicious,
          packetCount:  meta.packetCount,
          byteCount:    meta.byteCount,
          protocols:    Array.from(meta.protocols),
          ports:        Array.from(meta.ports).slice(0, 8),
          peerCount:    meta.peers.size,
        } as unknown as Record<string, unknown>,
      });
    });
  });

  return nodes;
}

function _buildEdges(relationships: EntityRelationship[]): Edge[] {
  if (!relationships) return [];

  return relationships.map((rel, i) => {
    const labelParts = [...rel.protocols];
    if (rel.ports && rel.ports.length > 0) {
      labelParts.push(`:${rel.ports.slice(0, 2).join(',')}`);
    }

    return {
      id:        `e-${rel.src_ip}-${rel.dst_ip}-${i}`,
      source:    rel.src_ip,
      target:    rel.dst_ip,
      animated:  rel.is_suspicious,
      style:     {
        stroke:      rel.is_suspicious ? '#ef4444' : '#94a3b8',
        strokeWidth: rel.is_suspicious ? 2.5 : 1.5,
      },
      label:     labelParts.join(' '),
      labelStyle: { fontSize: 9, fill: rel.is_suspicious ? '#dc2626' : '#64748b', fontWeight: 700 },
      labelBgStyle: { fill: 'white', opacity: 0.88, rx: 4, ry: 4 },
      data:      { ...rel },
    };
  });
}

// ── Main Graph Component ──────────────────────────────────────────────────────

export function HistoricalNetworkGraph({ relationships }: { relationships: EntityRelationship[] }) {
  const initialNodes = useMemo(() => _layoutNodes(relationships), [relationships]);
  const initialEdges = useMemo(() => _buildEdges(relationships), [relationships]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<HistNodeData | null>(null);

  // Sync state whenever relationships prop changes
  useEffect(() => {
    setNodes(_layoutNodes(relationships));
    setEdges(_buildEdges(relationships));
    setSelectedNode(null);
  }, [relationships, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge(params, eds)),
    [setEdges],
  );

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.data as unknown as HistNodeData);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  if (!relationships || relationships.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No entity relationship data available in this capture.
      </div>
    );
  }

  const suspiciousCount = relationships.filter(r => r.is_suspicious).length;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Legend overlay */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 10,
          background: 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(6px)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: '8px 12px',
          fontSize: 11,
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
          Node Legend
        </div>
        <LegendDot color="#6366f1" label="Source Host" />
        <LegendDot color="#06b6d4" label="Target Server" />
        <LegendDot color="#8b5cf6" label="Bidirectional / Bridge" />
        <LegendDot color="#ef4444" label={`Suspicious Flow (${suspiciousCount})`} />
      </div>

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            zIndex: 10,
            width: 280,
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            padding: '12px 16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary)' }}>
              {selectedNode.ip}
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, marginBottom: 8 }}>
            <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: 6 }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 9 }}>PACKETS</span>
              <strong>{selectedNode.packetCount.toLocaleString()}</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: 6 }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 9 }}>BYTES</span>
              <strong>{formatBytes(selectedNode.byteCount)}</strong>
            </div>
          </div>

          {selectedNode.ports && selectedNode.ports.length > 0 && (
            <div style={{ fontSize: 11 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}>Active Ports:</span>{' '}
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                {selectedNode.ports.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable
        style={{ background: '#f8fafc' }}
      >
        <Background color="#cbd5e1" gap={20} />
        <Controls showInteractive={false} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }} />
        <MiniMap
          nodeColor={n => {
            const d = n.data as unknown as HistNodeData;
            return d?.isSuspicious ? '#ef4444' : d?.isSrc ? '#6366f1' : '#06b6d4';
          }}
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}
        />
      </ReactFlow>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ color: '#475569', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

