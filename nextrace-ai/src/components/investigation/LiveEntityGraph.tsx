import { useState, useMemo, useEffect } from 'react';
import { Radio } from 'lucide-react';
import type { LiveNode, LiveEdge } from '@/types/live';

export interface LiveEntityGraphProps {
  nodes: LiveNode[];
  edges: LiveEdge[];
  running: boolean;
  isExpanded?: boolean;
  focusIp?: string;
  onNodeSelect?: (ip: string) => void;
}

export function LiveEntityGraph({ nodes, edges, running, isExpanded, focusIp, onNodeSelect }: LiveEntityGraphProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    if (focusIp) {
      const node = nodes.find(n => n.ip === focusIp);
      if (node) {
        setSelectedNode(node.id);
      }
    }
  }, [focusIp, nodes]);

  const NODE_COLORS: Record<string, { bg: string; border: string; shadow: string }> = {
    suspicious: { bg: '#fee2e2', border: '#ef4444', shadow: 'rgba(239,68,68,0.3)' },
    server: { bg: '#f0fdf4', border: '#10b981', shadow: 'rgba(16,185,129,0.2)' },
    external: { bg: '#f5f3ff', border: '#8b5cf6', shadow: 'rgba(139,92,246,0.2)' },
    internal: { bg: '#eff6ff', border: '#3b82f6', shadow: 'rgba(59,130,246,0.2)' },
  };

  const categorized = useMemo(() => {
    const suspicious = nodes.filter(n => n.type === 'suspicious');
    const internal = nodes.filter(n => n.type === 'internal');
    const server = nodes.filter(n => n.type === 'server');
    const external = nodes.filter(n => n.type === 'external');
    return { suspicious, internal, server, external };
  }, [nodes]);

  const layoutNodes = useMemo(() => {
    const colSpacing = isExpanded ? 340 : 230;
    const baseColX = isExpanded ? 180 : 120;
    const rowSpacing = isExpanded ? 80 : 70;
    const startY = 80;

    const positioned: Array<LiveNode & { renderX: number; renderY: number }> = [];

    const placeCol = (list: LiveNode[], colIndex: number) => {
      const subCols = isExpanded && list.length > 8 ? 2 : 1;
      const subColWidth = 140;

      list.forEach((node, idx) => {
        const subCol = idx % subCols;
        const row = Math.floor(idx / subCols);
        const x = baseColX + colIndex * colSpacing + subCol * subColWidth;
        const y = startY + row * rowSpacing;
        positioned.push({ ...node, renderX: x, renderY: y });
      });
    };

    placeCol(categorized.suspicious, 0);
    placeCol(categorized.internal, 1);
    placeCol(categorized.server, 2);
    if (categorized.external.length > 0) {
      placeCol(categorized.external, 3);
    }

    return positioned;
  }, [categorized, isExpanded]);

  const maxNodeY = Math.max(260, ...layoutNodes.map(n => n.renderY + 100));
  const maxNodeX = Math.max(isExpanded ? 1100 : 750, ...layoutNodes.map(n => n.renderX + 160));

  if (nodes.length === 0) {
    return (
      <div style={{ height: isExpanded ? '100%' : 240, flex: isExpanded ? 1 : undefined, background: 'var(--bg-workspace)', borderRadius: 12, border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <Radio size={28} color="var(--text-muted)" />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {running ? 'Entities will appear as traffic is observed…' : 'Start a session to discover network entities.'}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      height: isExpanded ? '100%' : 260,
      flex: isExpanded ? 1 : undefined,
      minHeight: 0,
      background: 'var(--bg-workspace)',
      borderRadius: 12,
      border: '1px solid var(--border-subtle)',
      overflowY: 'auto',
      overflowX: 'auto',
    }}>
      <svg
        width={isExpanded ? '100%' : Math.max(750, maxNodeX)}
        height={maxNodeY}
        viewBox={isExpanded ? `0 0 ${Math.max(1200, maxNodeX)} ${Math.max(700, maxNodeY)}` : undefined}
        style={{ minHeight: isExpanded ? '100%' : undefined, display: 'block', minWidth: isExpanded ? '100%' : 750 }}
      >
        <defs>
          <pattern id="lgrid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="var(--border-subtle)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lgrid)" />

        {/* Column Header Titles */}
        <g opacity={0.6}>
          <text x={isExpanded ? 180 : 120} y={35} fontSize={12} fontWeight={700} fill="var(--color-critical)" textAnchor="middle">
            SUSPICIOUS ({categorized.suspicious.length})
          </text>
          <text x={isExpanded ? 180 + (isExpanded ? 340 : 230) : 120 + 230} y={35} fontSize={12} fontWeight={700} fill="var(--primary)" textAnchor="middle">
            WORKSTATIONS ({categorized.internal.length})
          </text>
          <text x={isExpanded ? 180 + (isExpanded ? 340 : 230) * 2 : 120 + 460} y={35} fontSize={12} fontWeight={700} fill="var(--color-live)" textAnchor="middle">
            SERVERS ({categorized.server.length})
          </text>
        </g>

        {edges.map((edge, i) => {
          const from = layoutNodes.find(n => n.id === edge.from);
          const to = layoutNodes.find(n => n.id === edge.to);
          if (!from || !to) return null;
          const active = hoveredNode === from.id || hoveredNode === to.id;
          const isAttack = edge.suspicious;

          const midX = (from.renderX + to.renderX) / 2;
          const midY = (from.renderY + to.renderY) / 2;

          return (
            <g key={i}>
              <title>{edge.label} ({isAttack ? 'Suspicious' : 'Normal'})</title>
              <line
                x1={from.renderX} y1={from.renderY} x2={to.renderX} y2={to.renderY}
                stroke={isAttack ? '#ef4444' : (active ? '#6366f1' : '#cbd5e1')}
                strokeWidth={isAttack ? (active ? 3 : 2) : (active ? 2 : 1)}
                strokeDasharray={isAttack ? '5,5' : undefined}
                style={{
                  transition: 'stroke 0.2s',
                  animation: isAttack ? 'dash-flow 1.5s linear infinite' : 'none'
                }}
              />
              <text x={midX} y={midY - 6} fontSize={8} fill={isAttack ? '#ef4444' : '#64748b'} textAnchor="middle" style={{ pointerEvents: 'none' }}>
                {edge.label}
              </text>
            </g>
          );
        })}

        {layoutNodes.map(node => {
          const c = NODE_COLORS[node.type] ?? NODE_COLORS.internal;
          const active = hoveredNode === node.id || selectedNode === node.id;
          return (
            <g key={node.id} transform={`translate(${node.renderX},${node.renderY})`}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => {
                const newId = selectedNode === node.id ? null : node.id;
                setSelectedNode(newId);
                if (newId && onNodeSelect) {
                  onNodeSelect(node.ip);
                }
              }}
            >
              {node.type === 'internal' || node.type === 'external' ? (
                <>
                  {active && <rect x={-27} y={-27} width={54} height={54} rx={8} fill="none" stroke={c.border} strokeWidth={1} opacity={0.4} />}
                  <rect x={active ? -22 : -18} y={active ? -22 : -18} width={active ? 44 : 36} height={active ? 44 : 36} rx={6} fill={c.bg} stroke={c.border} strokeWidth={active ? 2.5 : 1.5} filter={active ? `drop-shadow(0 0 8px ${c.shadow})` : 'none'} style={{ transition: 'all 0.2s' }} />
                </>
              ) : (
                <>
                  {active && <circle r={27} fill="none" stroke={c.border} strokeWidth={1} opacity={0.4} />}
                  <circle r={active ? 22 : 18} fill={c.bg} stroke={c.border} strokeWidth={active ? 2.5 : 1.5} filter={active ? `drop-shadow(0 0 8px ${c.shadow})` : 'none'} style={{ transition: 'all 0.2s' }} />
                </>
              )}
              <text textAnchor="middle" y={-27} fontSize={9} fill={c.border} fontWeight={700}>{node.ip}</text>
              <text textAnchor="middle" y={30} fontSize={9} fill="var(--text-muted)" fontWeight={500}>{node.label}</text>
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

      {selectedNode && (() => {
        const n = nodes.find(nd => nd.id === selectedNode);
        if (!n) return null;
        const c = NODE_COLORS[n.type] ?? NODE_COLORS.internal;
        return (
          <div className="animate-slide-in-right" style={{ position: 'absolute', top: 10, right: 10, width: 190, background: 'white', borderRadius: 10, border: `1px solid ${c.border}`, padding: 12, boxShadow: 'var(--shadow-md)', zIndex: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{n.ip}</div>
            <div style={{ fontSize: 11, color: c.border, fontWeight: 600, textTransform: 'capitalize', marginBottom: 8 }}>{n.type}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              <div>Role: {n.label}</div>
              <div style={{ marginTop: 4 }}>Edges: {edges.filter(e => e.from === n.id || e.to === n.id).length}</div>
            </div>

            <button onClick={() => setSelectedNode(null)} style={{ position: 'absolute', top: 8, right: 10, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
          </div>
        );
      })()}
    </div>
  );
}
