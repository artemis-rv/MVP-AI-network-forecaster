import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { networkNodes } from '@/data/mockData';
import { ShieldAlert, Shield, Server, Activity } from 'lucide-react';
import type { LiveNode } from '@/types/live';

function adaptLiveNodes(nodes: LiveNode[]) {
  return nodes.map(n => ({
    id: n.id,
    label: n.ip,
    type: n.type as 'internal' | 'suspicious' | 'server' | 'external',
    ip: n.ip,
    status: n.type === 'suspicious' ? 'Threat Detected' : 'Active',
    riskScore: n.type === 'suspicious' ? 85 : n.type === 'external' ? 40 : 15,
  }));
}

type NodeType = 'internal' | 'suspicious' | 'server' | 'external';

export function NetworkEntities({ nodes: propNodes }: { nodes?: LiveNode[], edges?: any[] }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  
  const nodes = propNodes ? adaptLiveNodes(propNodes) : networkNodes.map(n => ({ ...n, status: n.type === 'suspicious' ? 'Threat Detected' : 'Active', riskScore: n.type === 'suspicious' ? 85 : 20 }));
  const isLiveData = !!propNodes;

  const filteredNodes = nodes.filter(n => 
    n.ip.includes(searchTerm) || 
    n.label.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => b.riskScore - a.riskScore).slice(0, 8); // Top 8 highest risk entities

  const getTypeIcon = (type: NodeType | string) => {
    switch (type) {
      case 'suspicious': return <ShieldAlert size={14} color="var(--color-critical)" />;
      case 'server': return <Server size={14} color="var(--color-live)" />;
      case 'external': return <Activity size={14} color="var(--color-warning)" />;
      case 'internal': default: return <Shield size={14} color="var(--primary)" />;
    }
  };

  const getRiskBadge = (score: number) => {
    if (score >= 75) return <span style={{ background: 'var(--color-critical-light)', color: 'var(--color-critical)', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>High</span>;
    if (score >= 40) return <span style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Medium</span>;
    return <span style={{ background: 'var(--bg-workspace)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Low</span>;
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: 400,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {isLiveData ? 'Active Network Entities' : 'Top Risk Entities'}
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {isLiveData ? `${nodes.length} entities tracked` : 'Highest priority entities requiring attention'}
          </p>
        </div>
        <div>
          <input
            type="text"
            placeholder="Search IP or Role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-default)',
              fontSize: 12,
              outline: 'none',
              background: 'var(--bg-input)',
              width: 150,
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Entity (IP)</th>
              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Role</th>
              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Risk</th>
              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredNodes.length > 0 ? filteredNodes.map((node, i) => (
              <tr 
                key={node.id} 
                style={{ 
                  borderBottom: i === filteredNodes.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'background var(--transition-fast)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-workspace)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                onClick={() => navigate(`/investigation?ip=${encodeURIComponent(node.ip)}&source=entity`)}
              >
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {getTypeIcon(node.type)}
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{node.ip}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{node.label}</td>
                <td style={{ padding: '10px 12px' }}>{getRiskBadge(node.riskScore)}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ 
                    fontSize: 11, 
                    fontWeight: 600, 
                    color: node.type === 'suspicious' ? 'var(--color-critical)' : 'var(--text-secondary)' 
                  }}>
                    {node.status}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No entities found matching "{searchTerm}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
