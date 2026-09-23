// NEXTRACE AI — Historical Network Graph
// Reuses @xyflow/react (same dependency as AttackPathGraph) for entity relationship visualization.
// Isolated from investigation graph — does not share state or types.

import { useCallback, useMemo } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection,
  Position, Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { EntityRelationship } from '@/types/historical';

// ── Node types ────────────────────────────────────────────────────────────────

interface HistNodeData {
  ip: string;
  isSrc: boolean;
  isDst: boolean;
  isSuspicious: boolean;
  packetCount: number;
}

function HistIpNode({ data }: { data: Record<string, unknown> }) {
  const d = data as unknown as HistNodeData;
  const color   = d.isSuspicious ? '#ef4444' : d.isSrc && d.isDst ? '#8b5cf6' : d.isSrc ? '#6366f1' : '#06b6d4';
  const bgColor = d.isSuspicious ? '#fee2e2' : '#f8faff';

  return (
    <div style={{
      background: bgColor, border: `2px solid ${color}`,
      borderRadius: 10, padding: '8px 14px', minWidth: 120,
      boxShadow: d.isSuspicious ? `0 0 12px ${color}40` : '0 2px 8px rgba(0,0,0,0.08)',
      position: 'relative',
    }}>
      <Handle type="target" position={Position.Top}    style={{ background: color, border: `2px solid white`, width: 8, height: 8 }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color, letterSpacing: '0.5px', marginBottom: 2 }}>
          {d.isSuspicious ? '⚠' : d.isSrc && d.isDst ? '⇄' : d.isSrc ? '↑' : '↓'}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: '#1e293b' }}>{d.ip}</div>
        <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{d.packetCount} pkts</div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: color, border: `2px solid white`, width: 8, height: 8 }} />
    </div>
  );
}

const NODE_TYPES = { histIpNode: HistIpNode };

// ── Layout helper (left-to-right layered) ────────────────────────────────────

function _layoutNodes(relationships: EntityRelationship[]): Node[] {
  const ipMeta: Map<string, { isSrc: boolean; isDst: boolean; isSuspicious: boolean; packetCount: number }> = new Map();

  for (const rel of relationships) {
    const s = ipMeta.get(rel.src_ip) ?? { isSrc: false, isDst: false, isSuspicious: false, packetCount: 0 };
    s.isSrc = true;
    s.packetCount += rel.packet_count;
    if (rel.is_suspicious) s.isSuspicious = true;
    ipMeta.set(rel.src_ip, s);

    const d = ipMeta.get(rel.dst_ip) ?? { isSrc: false, isDst: false, isSuspicious: false, packetCount: 0 };
    d.isDst = true;
    d.packetCount += rel.packet_count;
    ipMeta.set(rel.dst_ip, d);
  }

  const ips = Array.from(ipMeta.entries());
  const cols: string[][] = [[], [], []]; // src-only, both, dst-only

  for (const [ip, meta] of ips) {
    if (meta.isSrc && !meta.isDst)      cols[0].push(ip);
    else if (meta.isSrc && meta.isDst)  cols[1].push(ip);
    else                                cols[2].push(ip);
  }

  const nodes: Node[] = [];
  cols.forEach((col, colIdx) => {
    col.forEach((ip, rowIdx) => {
      const meta = ipMeta.get(ip)!;
      nodes.push({
        id:       ip,
        type:     'histIpNode',
        position: { x: colIdx * 220, y: rowIdx * 100 },
        data:     { ip, ...meta } as unknown as Record<string, unknown>,
      });
    });
  });

  return nodes;
}

function _buildEdges(relationships: EntityRelationship[]): Edge[] {
  return relationships.map((rel, i) => ({
    id:        `e-${i}`,
    source:    rel.src_ip,
    target:    rel.dst_ip,
    animated:  rel.is_suspicious,
    style:     {
      stroke:      rel.is_suspicious ? '#ef4444' : '#94a3b8',
      strokeWidth: rel.is_suspicious ? 2.5 : 1.5,
    },
    label:     rel.protocols.join('/'),
    labelStyle: { fontSize: 9, fill: '#64748b', fontWeight: 600 },
    labelBgStyle: { fill: 'white', opacity: 0.8 },
  }));
}

// ── Main Graph Component ──────────────────────────────────────────────────────

export function HistoricalNetworkGraph({ relationships }: { relationships: EntityRelationship[] }) {
  const initialNodes = useMemo(() => _layoutNodes(relationships), [relationships]);
  const initialEdges = useMemo(() => _buildEdges(relationships), [relationships]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge(params, eds)),
    [setEdges],
  );

  if (relationships.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        No entity relationship data available.
      </div>
    );
  }

  const suspiciousCount = relationships.filter(r => r.is_suspicious).length;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Legend overlay */}
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, background: 'rgba(255,255,255,0.92)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '7px 12px', fontSize: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <LegendDot color="#6366f1" label="Source host" />
        <LegendDot color="#06b6d4" label="Destination host" />
        <LegendDot color="#8b5cf6" label="Both directions" />
        <LegendDot color="#ef4444" label={`Suspicious (${suspiciousCount} edges)`} />
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        nodesDraggable
        style={{ background: '#f8faff' }}
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls showInteractive={false} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }} />
        <MiniMap
          nodeColor={n => {
            const d = n.data as unknown as HistNodeData;
            return d?.isSuspicious ? '#ef4444' : d?.isSrc ? '#6366f1' : '#06b6d4';
          }}
          style={{ background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: 8 }}
        />
      </ReactFlow>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ color: '#64748b' }}>{label}</span>
    </div>
  );
}
