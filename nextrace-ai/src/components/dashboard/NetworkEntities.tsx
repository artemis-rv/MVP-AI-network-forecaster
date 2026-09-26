import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Shield, Server, Activity } from 'lucide-react';
import type { LiveNode } from '@/types/live';
import { useAlertStore } from '@/store/alertStore';
import { deriveDashboardEntities, DashboardEntity, EntityRiskLevel } from '@/utils/entityRisk';

export interface NetworkEntitiesProps {
  nodes?: LiveNode[];
  edges?: any[];
  entities?: DashboardEntity[];
  riskFilter?: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';
  onRiskFilterChange?: (filter: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW') => void;
  highlighted?: boolean;
}

export function NetworkEntities({
  nodes: propNodes,
  entities: propEntities,
  riskFilter: externalFilter,
  onRiskFilterChange,
  highlighted,
}: NetworkEntitiesProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [internalFilter, setInternalFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const { alerts } = useAlertStore();

  const activeFilter = externalFilter !== undefined ? externalFilter : internalFilter;
  const setFilter = onRiskFilterChange || setInternalFilter;

  // Derive entities dynamically from live nodes and alerts if not passed directly
  const derived = propEntities ? {
    entities: propEntities,
    counts: {
      total: propEntities.length,
      high: propEntities.filter(e => e.riskLevel === 'High').length,
      medium: propEntities.filter(e => e.riskLevel === 'Medium').length,
      low: propEntities.filter(e => e.riskLevel === 'Low').length,
    }
  } : deriveDashboardEntities(propNodes, alerts);

  const { entities, counts } = derived;
  const isLiveData = !!propNodes && propNodes.length > 0;

  // Filter by risk and search
  const filteredNodes = entities.filter(n => {
    if (activeFilter === 'HIGH' && n.riskLevel !== 'High') return false;
    if (activeFilter === 'MEDIUM' && n.riskLevel !== 'Medium') return false;
    if (activeFilter === 'LOW' && n.riskLevel !== 'Low') return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return n.ip.includes(q) || n.label.toLowerCase().includes(q) || n.status.toLowerCase().includes(q);
    }
    return true;
  }).slice(0, 10);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'suspicious': return <ShieldAlert size={14} color="var(--color-critical)" />;
      case 'server': return <Server size={14} color="var(--color-live)" />;
      case 'external': return <Activity size={14} color="var(--color-warning)" />;
      case 'internal': default: return <Shield size={14} color="var(--primary)" />;
    }
  };

  const getRiskBadge = (level: EntityRiskLevel) => {
    if (level === 'High') {
      return (
        <span style={{
          background: 'var(--color-critical-light)',
          color: 'var(--color-critical)',
          padding: '2px 8px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          border: '1px solid rgba(239, 68, 68, 0.2)'
        }}>
          High
        </span>
      );
    }
    if (level === 'Medium') {
      return (
        <span style={{
          background: 'var(--color-warning-light)',
          color: 'var(--color-warning)',
          padding: '2px 8px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          border: '1px solid rgba(245, 158, 11, 0.2)'
        }}>
          Medium
        </span>
      );
    }
    return (
      <span style={{
        background: 'var(--bg-workspace)',
        color: 'var(--text-secondary)',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        border: '1px solid var(--border-subtle)'
      }}>
        Low
      </span>
    );
  };

  return (
    <div
      id="top-risk-entities"
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        border: highlighted ? '1.5px solid var(--color-critical)' : '1px solid var(--border-default)',
        boxShadow: highlighted ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: 420,
        transition: 'all 0.3s ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {isLiveData ? 'Active Network Entities' : 'Top Risk Entities'}
            </h3>
            {counts.high > 0 && (
              <span style={{
                background: 'var(--color-critical-light)',
                color: 'var(--color-critical)',
                fontSize: 10,
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: 999,
              }}>
                {counts.high} High
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {counts.high > 0
              ? `${counts.high} high-risk ${counts.high === 1 ? 'entity' : 'entities'} requiring immediate attention`
              : 'Highest priority entities requiring attention'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            placeholder="Search IP or Role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-default)',
              fontSize: 12,
              outline: 'none',
              background: 'var(--bg-input)',
              width: 130,
            }}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
        {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(tab => {
          const count = tab === 'ALL' ? counts.total : tab === 'HIGH' ? counts.high : tab === 'MEDIUM' ? counts.medium : counts.low;
          const isActive = activeFilter === tab;
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                background: isActive
                  ? (tab === 'HIGH' ? 'var(--color-critical-light)' : 'var(--bg-workspace)')
                  : 'transparent',
                color: isActive
                  ? (tab === 'HIGH' ? 'var(--color-critical)' : 'var(--text-primary)')
                  : 'var(--text-muted)',
                border: isActive
                  ? (tab === 'HIGH' ? '1px solid var(--color-critical)' : '1px solid var(--border-default)')
                  : '1px solid transparent',
                borderRadius: 6,
                padding: '3px 8px',
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
              <span style={{
                fontSize: 10,
                padding: '0 4px',
                borderRadius: 4,
                background: isActive ? 'rgba(0,0,0,0.06)' : 'var(--bg-workspace)',
                fontWeight: 700
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
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
                <td style={{ padding: '9px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {getTypeIcon(node.type)}
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{node.ip}</span>
                  </div>
                </td>
                <td style={{ padding: '9px 12px', color: 'var(--text-secondary)' }}>{node.label}</td>
                <td style={{ padding: '9px 12px' }}>{getRiskBadge(node.riskLevel)}</td>
                <td style={{ padding: '9px 12px' }}>
                  <span style={{ 
                    fontSize: 11, 
                    fontWeight: 600, 
                    color: node.riskLevel === 'High' ? 'var(--color-critical)' : 'var(--text-secondary)' 
                  }}>
                    {node.status}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No entities found {activeFilter !== 'ALL' ? `with ${activeFilter.toLowerCase()} risk` : ''} {searchTerm ? `matching "${searchTerm}"` : ''}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

