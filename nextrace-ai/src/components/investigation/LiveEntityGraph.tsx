import { useState, useMemo, useEffect, useRef } from 'react';
import { Radio, Focus } from 'lucide-react';
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
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  // Find "now" in the graph context to handle demo/live safely
  const maxTimestamp = useMemo(() => {
    let max = 0;
    edges.forEach(e => {
      if (!e.lastSeen) return;
      const t = new Date(e.lastSeen).getTime();
      if (t > max) max = t;
    });
    return max || Date.now();
  }, [edges]);

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

  const { vbX, vbY, vbWidth, vbHeight } = useMemo(() => {
    if (layoutNodes.length === 0) return { vbX: 0, vbY: 0, vbWidth: 800, vbHeight: 600 };

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    layoutNodes.forEach(n => {
      if (n.renderX < minX) minX = n.renderX;
      if (n.renderX > maxX) maxX = n.renderX;
      if (n.renderY < minY) minY = n.renderY;
      if (n.renderY > maxY) maxY = n.renderY;
    });

    // Account for column headers
    minY = Math.min(minY, 20);

    // Padding ensures nodes don't clip at edges
    const paddingX = 120;
    const paddingY = 80;

    return {
      vbX: minX - paddingX,
      vbY: minY - paddingY,
      vbWidth: (maxX - minX) + (paddingX * 2),
      vbHeight: (maxY - minY) + (paddingY * 2)
    };
  }, [layoutNodes]);

  const svgRef = useRef<SVGSVGElement>(null);
  const transformRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  const [, forceRender] = useState({});
  const vbRef = useRef({ vbX: 0, vbY: 0, vbWidth: 800, vbHeight: 600 });

  useEffect(() => {
    vbRef.current = { vbX, vbY, vbWidth, vbHeight };
  }, [vbX, vbY, vbWidth, vbHeight]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); // Stop page scroll

      const { zoom: prevZoom, panX: prevPanX, panY: prevPanY } = transformRef.current;
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1; // down = out, up = in
      const nextZoom = Math.max(0.2, Math.min(prevZoom * zoomFactor, 5));
      if (nextZoom === prevZoom) return;

      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;

      const svgP = pt.matrixTransform(ctm.inverse());

      const { vbX: bx, vbY: by, vbWidth: bw, vbHeight: bh } = vbRef.current;

      const old_w = bw / prevZoom;
      const old_h = bh / prevZoom;

      const current_vbX = bx + (bw - old_w) / 2 - prevPanX;
      const current_vbY = by + (bh - old_h) / 2 - prevPanY;

      const relX = (svgP.x - current_vbX) / old_w;
      const relY = (svgP.y - current_vbY) / old_h;

      const new_w = bw / nextZoom;
      const new_h = bh / nextZoom;

      const new_vbX = svgP.x - relX * new_w;
      const new_vbY = svgP.y - relY * new_h;

      const new_panX = bx + (bw - new_w) / 2 - new_vbX;
      const new_panY = by + (bh - new_h) / 2 - new_vbY;

      transformRef.current = { zoom: nextZoom, panX: new_panX, panY: new_panY };
      forceRender({});
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, []);

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
      width: '100%',
      height: '100%',
      minHeight: isExpanded ? 0 : 260,
      flex: isExpanded ? 1 : undefined,
      background: 'var(--bg-workspace)',
      borderRadius: 12,
      border: '1px solid var(--border-subtle)',
      overflow: 'hidden',
    }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${vbX + (vbWidth - vbWidth / transformRef.current.zoom) / 2 - transformRef.current.panX} ${vbY + (vbHeight - vbHeight / transformRef.current.zoom) / 2 - transformRef.current.panY} ${vbWidth / transformRef.current.zoom} ${vbHeight / transformRef.current.zoom}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        <defs>
          <style>{`
            @keyframes pulse-ring {
              0% { transform: scale(0.8); opacity: 0.8; stroke-width: 2px; }
              100% { transform: scale(1.8); opacity: 0; stroke-width: 1px; }
            }
          `}</style>
          <pattern id="lgrid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="var(--border-subtle)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x={vbX} y={vbY} width={vbWidth} height={vbHeight} fill="url(#lgrid)" />

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

          const isHovered = hoveredEdge === edge.id;
          const nodeHovered = hoveredNode === from.id || hoveredNode === to.id;
          const isAttackPath = edge.suspicious;

          // Traffic volume edge thickness: minimum 1, max 6, scales smoothly
          const thickness = Math.min(6, Math.max(1, 1 + (edge.packetCount || 0) / 10));

          return (
            <g key={edge.id || i}
              onMouseEnter={() => setHoveredEdge(edge.id)}
              onMouseLeave={() => setHoveredEdge(null)}
              style={{ cursor: 'pointer' }}>

              {/* Invisible thicker line for easier hovering */}
              <line
                x1={from.renderX} y1={from.renderY} x2={to.renderX} y2={to.renderY}
                stroke="transparent"
                strokeWidth={20}
              />

              <line
                x1={from.renderX} y1={from.renderY} x2={to.renderX} y2={to.renderY}
                stroke={isAttackPath ? '#ef4444' : (nodeHovered || isHovered ? '#6366f1' : 'var(--border-default)')}
                strokeWidth={isAttackPath ? thickness + 1 : thickness}
                style={{
                  transition: 'stroke 0.2s',
                  filter: isAttackPath ? 'drop-shadow(0 0 4px rgba(239,68,68,0.5))' : 'none'
                }}
              />
            </g>
          );
        })}

        {layoutNodes.map(node => {
          const c = NODE_COLORS[node.type] ?? NODE_COLORS.internal;
          const activeNode = hoveredNode === node.id || selectedNode === node.id;

          // Pulse effect if this node is actively involved in suspicious traffic
          const isRecentAlert = edges.some(e => e.suspicious && (e.from === node.id || e.to === node.id) && (e.lastSeen && maxTimestamp - new Date(e.lastSeen).getTime() < 5000));

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
                } else if (!newId && onNodeSelect) {
                  // Clear filter when clicking same node again
                  onNodeSelect('');
                }
              }}
            >
              {isRecentAlert && (
                <circle r={35} fill="none" stroke="#ef4444" style={{ transformOrigin: 'center', animation: 'pulse-ring 2s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
              )}
              {node.type === 'internal' || node.type === 'external' ? (
                <>
                  {activeNode && <rect x={-27} y={-27} width={54} height={54} rx={8} fill="none" stroke={c.border} strokeWidth={1} opacity={0.4} />}
                  <rect x={activeNode ? -22 : -18} y={activeNode ? -22 : -18} width={activeNode ? 44 : 36} height={activeNode ? 44 : 36} rx={6} fill={c.bg} stroke={c.border} strokeWidth={activeNode ? 2.5 : 1.5} filter={activeNode ? `drop-shadow(0 0 8px ${c.shadow})` : 'none'} style={{ transition: 'all 0.2s' }} />
                </>
              ) : (
                <>
                  {activeNode && <circle r={27} fill="none" stroke={c.border} strokeWidth={1} opacity={0.4} />}
                  <circle r={activeNode ? 22 : 18} fill={c.bg} stroke={c.border} strokeWidth={activeNode ? 2.5 : 1.5} filter={activeNode ? `drop-shadow(0 0 8px ${c.shadow})` : 'none'} style={{ transition: 'all 0.2s' }} />
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

      <button
        onClick={() => {
          transformRef.current = { zoom: 1, panX: 0, panY: 0 };
          forceRender({});
        }}
        title="Fit graph to view"
        style={{
          position: 'absolute',
          top: 12,
          right: selectedNode ? 212 : 12,
          zIndex: 20,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          width: 30,
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          boxShadow: 'var(--shadow-sm)',
          transition: 'right 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
      >
        <Focus size={16} />
      </button>

      {selectedNode && (() => {
        const n = nodes.find(nd => nd.id === selectedNode);
        if (!n) return null;
        const c = NODE_COLORS[n.type] ?? NODE_COLORS.internal;
        return (
          <div className="animate-slide-in-right" style={{ position: 'absolute', top: 10, right: 10, width: 190, background: 'var(--bg-card)', borderRadius: 10, border: `1px solid ${c.border}`, padding: 12, boxShadow: 'var(--shadow-md)', zIndex: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{n.ip}</div>
            <div style={{ fontSize: 11, color: c.border, fontWeight: 600, textTransform: 'capitalize', marginBottom: 8 }}>{n.type}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              <div>Role: {n.label}</div>
              <div style={{ marginTop: 4 }}>Edges: {edges.filter(e => e.from === n.id || e.to === n.id).length}</div>
            </div>

            <button onClick={() => { setSelectedNode(null); if (onNodeSelect) onNodeSelect(''); }} style={{ position: 'absolute', top: 8, right: 10, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
          </div>
        );
      })()}

      {hoveredEdge && !selectedNode && (() => {
        const e = edges.find(ed => ed.id === hoveredEdge);
        if (!e) return null;
        const isAttack = e.suspicious;
        return (
          <div className="animate-slide-in-right" style={{ pointerEvents: 'none', position: 'absolute', bottom: 10, right: 10, width: 220, background: 'var(--bg-card)', borderRadius: 10, border: `1px solid ${isAttack ? '#ef4444' : 'var(--border-default)'}`, padding: 12, boxShadow: 'var(--shadow-md)', zIndex: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: isAttack ? '#ef4444' : 'var(--text-primary)', marginBottom: 2 }}>
              {isAttack ? 'Suspicious Path' : 'Network Flow'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {e.from} → {e.to}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <div>Protocol: <strong style={{ color: 'var(--text-primary)' }}>{e.label}</strong></div>
              <div>Packets: <strong style={{ color: 'var(--text-primary)' }}>{e.packetCount || 0}</strong></div>
              <div>Bytes: <strong style={{ color: 'var(--text-primary)' }}>{e.bytes || 0}</strong></div>
              <div>Active: <strong style={{ color: 'var(--text-primary)' }}>{e.lastSeen ? e.lastSeen.slice(11, 19) : 'N/A'}</strong></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
