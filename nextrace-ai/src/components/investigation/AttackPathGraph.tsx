// NEXTRACE AI — Attack Path Graph (ReactFlow)
// Uses @xyflow/react. No Neo4j, no external graph DB.

import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
  getBezierPath,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useLiveStore } from '@/store/liveStore';
import { useInvestigationStore } from '@/store/investigationStore';
import type { AttackNodeData } from '@/types/investigation';

// ─── Node category meta ───────────────────────────────────────────────────────
const NODE_META: Record<string, { label: string; icon: string; bg: string; border: string; text: string; shadow: string }> = {
  workstation: { label: 'WORKSTATION',     icon: '💻', bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8', shadow: 'rgba(59,130,246,0.3)' },
  suspicious:  { label: 'SUSPICIOUS HOST', icon: '⚠️', bg: '#fee2e2', border: '#ef4444', text: '#b91c1c', shadow: 'rgba(239,68,68,0.4)' },
  server:      { label: 'SERVER',          icon: '🖥️', bg: '#f0fdf4', border: '#10b981', text: '#065f46', shadow: 'rgba(16,185,129,0.3)' },
  database:    { label: 'DATABASE',        icon: '🗄️', bg: '#fdf4ff', border: '#a855f7', text: '#6b21a8', shadow: 'rgba(168,85,247,0.3)' },
  external:    { label: 'EXTERNAL',        icon: '🌐', bg: '#fff7ed', border: '#f97316', text: '#9a3412', shadow: 'rgba(249,115,22,0.3)' },
};

// ─── Custom Entity Node ────────────────────────────────────────────────────────
function EntityNode({ data }: NodeProps) {
  const d = data as unknown as AttackNodeData;
  const meta = NODE_META[d.nodeType] ?? NODE_META.server;
  const isSelected = d.isSelected;
  const isFocused  = d.isFocused;

  return (
    <div
      style={{
        background: meta.bg,
        border: `2px solid ${isSelected ? '#6366f1' : meta.border}`,
        borderRadius: 12,
        padding: '10px 14px',
        minWidth: 140,
        textAlign: 'center',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(99,102,241,0.3), 0 4px 16px rgba(0,0,0,0.12)'
          : isFocused
          ? `0 0 16px ${meta.shadow}, 0 4px 12px rgba(0,0,0,0.08)`
          : '0 2px 8px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        opacity: isFocused === false ? 0.45 : 1,
      }}
    >
      {/* Pulse ring for suspicious */}
      {d.nodeType === 'suspicious' && (
        <div style={{
          position: 'absolute', inset: -6, borderRadius: 16,
          border: '2px solid rgba(239,68,68,0.3)',
          animation: 'pulse-glow 2s infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Category badge */}
      <div style={{
        fontSize: 8, fontWeight: 800, letterSpacing: '0.6px',
        color: meta.text, textTransform: 'uppercase',
        background: meta.border + '20', borderRadius: 999,
        padding: '1px 6px', display: 'inline-block', marginBottom: 6,
      }}>
        {meta.label}
      </div>

      {/* Icon */}
      <div style={{ fontSize: 22, marginBottom: 4, lineHeight: 1 }}>{meta.icon}</div>

      {/* IP */}
      <div style={{
        fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-mono)',
        color: isSelected ? '#6366f1' : meta.text, letterSpacing: '-0.3px',
      }}>
        {d.ip}
      </div>

      {/* Role */}
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>
        {d.role}
      </div>

      {/* Connection count */}
      {d.connections > 0 && (
        <div style={{
          fontSize: 9, marginTop: 4, color: meta.text,
          background: meta.border + '15', borderRadius: 999, padding: '1px 6px', display: 'inline-block',
        }}>
          {d.connections} conn
        </div>
      )}

      <Handle type="target" position={Position.Top}    style={{ background: meta.border, width: 8, height: 8, border: '2px solid white' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: meta.border, width: 8, height: 8, border: '2px solid white' }} />
      <Handle type="target" position={Position.Left}   style={{ background: meta.border, width: 6, height: 6, border: '2px solid white' }} id="left-in"  />
      <Handle type="source" position={Position.Right}  style={{ background: meta.border, width: 6, height: 6, border: '2px solid white' }} id="right-out" />
    </div>
  );
}

// ─── Custom Attack Edge ────────────────────────────────────────────────────────
function AttackEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, selected,
}: EdgeProps) {
    const d = data as { protocol?: string; connectionCount?: number; isSuspicious?: boolean };
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const isSuspicious = d?.isSuspicious ?? false;
  const color = isSuspicious ? '#ef4444' : '#64748b';

  return (
    <g>
      {/* Shadow path */}
      <path d={edgePath} fill="none" stroke={color + '20'} strokeWidth={8} />
      {/* Main path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={selected ? '#6366f1' : color}
        strokeWidth={selected ? 2.5 : isSuspicious ? 2 : 1.5}
        strokeDasharray={isSuspicious ? '6 3' : 'none'}
        markerEnd={`url(#arrow-${isSuspicious ? 'red' : 'gray'})`}
        style={{ cursor: 'pointer' }}
      />
      {/* Label */}
      {d?.protocol && (
        <foreignObject x={labelX - 45} y={labelY - 16} width={90} height={32} style={{ overflow: 'visible', pointerEvents: 'none' }}>
          <div style={{
            background: selected ? '#6366f1' : isSuspicious ? '#fee2e2' : '#f8fafc',
            border: `1px solid ${selected ? '#6366f1' : isSuspicious ? '#fca5a5' : '#e2e8f0'}`,
            borderRadius: 6, padding: '2px 6px', fontSize: 10, fontWeight: 700,
            color: selected ? 'white' : isSuspicious ? '#b91c1c' : '#475569',
            textAlign: 'center', lineHeight: 1.4, whiteSpace: 'nowrap',
          }}>
            {d.protocol}{d.connectionCount ? ` · ${d.connectionCount}` : ''}
          </div>
        </foreignObject>
      )}
    </g>
  );
}

const nodeTypes = { entityNode: EntityNode };
const edgeTypes = { attackEdge: AttackEdge };

// ─── Demo fallback graph ───────────────────────────────────────────────────────
const DEMO_NODES: Node[] = [
  { id: 'wk1',  type: 'entityNode', position: { x: 300, y: 20  }, data: { ip: '192.168.1.10', role: 'Workstation',       nodeType: 'workstation', riskScore: 30, connections: 8,  isSelected: false, isFocused: true } },
  { id: 'sus1', type: 'entityNode', position: { x: 300, y: 150 }, data: { ip: '10.0.0.5',    role: 'Suspicious Host',    nodeType: 'suspicious',  riskScore: 90, connections: 15, isSelected: false, isFocused: true } },
  { id: 'srv1', type: 'entityNode', position: { x: 300, y: 290 }, data: { ip: '192.168.1.25', role: 'Application Server', nodeType: 'server',      riskScore: 70, connections: 27, isSelected: false, isFocused: true } },
  { id: 'db1',  type: 'entityNode', position: { x: 300, y: 430 }, data: { ip: '192.168.1.50', role: 'Database',           nodeType: 'database',    riskScore: 55, connections: 12, isSelected: false, isFocused: true } },
  { id: 'ext1', type: 'entityNode', position: { x: 300, y: 570 }, data: { ip: '203.0.113.5',  role: 'External Dest.',     nodeType: 'external',    riskScore: 95, connections: 4,  isSelected: false, isFocused: true } },
];

const DEMO_EDGES: Edge[] = [
  { id: 'e1', source: 'wk1',  target: 'sus1', type: 'attackEdge', animated: true, data: { protocol: 'TCP:445', connectionCount: 8,  isSuspicious: true  } },
  { id: 'e2', source: 'sus1', target: 'srv1', type: 'attackEdge', animated: true, data: { protocol: 'TCP:443', connectionCount: 12, isSuspicious: true  } },
  { id: 'e3', source: 'srv1', target: 'db1',  type: 'attackEdge', animated: true, data: { protocol: 'TCP:5432',connectionCount: 7,  isSuspicious: true  } },
  { id: 'e4', source: 'db1',  target: 'ext1', type: 'attackEdge', animated: true, data: { protocol: 'TCP:443', connectionCount: 3,  isSuspicious: true  } },
  { id: 'e5', source: 'wk1',  target: 'srv1', type: 'attackEdge', animated: false,data: { protocol: 'UDP:53',  connectionCount: 14, isSuspicious: false } },
];

// ─── Live node builder ────────────────────────────────────────────────────────
type LiveNodeIn = { id: string; ip: string; type: string; x: number; y: number };
type LiveEdgeIn  = { from: string; to: string; label: string; suspicious: boolean };

function buildLiveNodes(liveNodes: LiveNodeIn[], selectedIp: string | null): Node[] {
  const typeMap: Record<string, string> = {
    suspicious: 'suspicious', external: 'external', server: 'server', internal: 'workstation',
  };
  return liveNodes.map((n, i) => ({
    id: n.id,
    type: 'entityNode',
    position: { x: 100 + (i % 3) * 220, y: 60 + Math.floor(i / 3) * 160 },
    data: {
      ip: n.ip,
      role: n.type.charAt(0).toUpperCase() + n.type.slice(1),
      nodeType: typeMap[n.type] ?? 'server',
      riskScore: n.type === 'suspicious' ? 85 : 30,
      connections: 1,
      isSelected: n.ip === selectedIp,
      isFocused: true,
    },
  }));
}

function buildLiveEdges(liveEdges: LiveEdgeIn[]): Edge[] {
  return liveEdges.map((e, i) => ({
    id: `le-${i}`,
    source: e.from,
    target: e.to,
    type: 'attackEdge',
    animated: e.suspicious,
    data: { protocol: e.label, connectionCount: 1, isSuspicious: e.suspicious },
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────
interface AttackPathGraphProps {
  focusIp?: string;
  onNodeSelect?: (ip: string) => void;
}

export function AttackPathGraph({ focusIp, onNodeSelect }: AttackPathGraphProps) {
  const { liveNodes, liveEdges, session } = useLiveStore();
  const { selectedNodeIp, setSelectedNodeIp } = useInvestigationStore();
  const isLive = (session?.running ?? false) && liveNodes.length > 0;

  // Build nodes/edges
  const baseNodes = useMemo((): Node[] => {
    if (isLive) return buildLiveNodes(liveNodes as unknown as LiveNodeIn[], selectedNodeIp);
    // Update demo nodes to reflect selection
    return DEMO_NODES.map(n => ({
      ...n,
      data: { ...n.data as object, isSelected: (n.data as unknown as AttackNodeData).ip === (selectedNodeIp ?? focusIp) },
    }));
  }, [isLive, liveNodes, selectedNodeIp, focusIp]);

  const baseEdges = useMemo((): Edge[] => {
    if (isLive) return buildLiveEdges(liveEdges as unknown as LiveEdgeIn[]);
    return DEMO_EDGES;
  }, [isLive, liveEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(baseNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseEdges);

  // Sync when base data changes
  useEffect(() => { setNodes(baseNodes); }, [baseNodes, setNodes]);
  useEffect(() => { setEdges(baseEdges); }, [baseEdges, setEdges]);

  const { fitView } = useReactFlow();
  useEffect(() => { setTimeout(() => fitView({ padding: 0.2 }), 100); }, [fitView, isLive]);

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge(params, eds));
  }, [setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const ip = (node.data as unknown as AttackNodeData).ip;
    setSelectedNodeIp(ip);
    onNodeSelect?.(ip);
  }, [setSelectedNodeIp, onNodeSelect]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Arrow defs */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <marker id="arrow-red"  markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#ef4444" />
          </marker>
          <marker id="arrow-gray" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
          </marker>
        </defs>
      </svg>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.3}
        maxZoom={2}
        style={{ background: '#f8faff' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={20} size={1} />
        <Controls showInteractive={false} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }} />
        <MiniMap
          nodeColor={(n) => {
            const t = (n.data as unknown as AttackNodeData)?.nodeType ?? 'server';
            return NODE_META[t]?.border ?? '#94a3b8';
          }}
          style={{ background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: 8 }}
          zoomable pannable
        />
      </ReactFlow>

      {/* Legend */}
      <div style={{
        position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.95)',
        border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px',
        display: 'flex', gap: 12, flexWrap: 'wrap', backdropFilter: 'blur(4px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        {Object.entries(NODE_META).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: v.text }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: v.bg, border: `1.5px solid ${v.border}` }} />
            {v.label}
          </div>
        ))}
      </div>

      {/* Demo data badge */}
      {!isLive && (
        <div style={{
          position: 'absolute', bottom: 48, right: 12,
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 8, padding: '4px 10px', fontSize: 10, color: '#92400e', fontWeight: 600,
        }}>
          ⚠ Demo attack path — simulated data
        </div>
      )}
    </div>
  );
}
