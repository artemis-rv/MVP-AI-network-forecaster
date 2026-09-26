import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAlertStore } from '@/store/alertStore';
import { useLiveStore } from '@/store/liveStore';
import { ShieldAlert, AlertCircle, AlertTriangle, List, Search as SearchIcon, RefreshCw } from 'lucide-react';
import { AlertTable } from '@/components/alerts/AlertTable';
import { AlertDetailsDrawer } from '@/components/alerts/AlertDetailsDrawer';

export function AlertsPage() {
  const {
    alerts, stats, filters, loading, error,
    fetchAlerts, fetchStats, setFilter, resetFilters, selectAlert, selectedAlertId
  } = useAlertStore();

  const { session } = useLiveStore();

  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetchAlerts();
    fetchStats();
    
    const statusParam = searchParams.get('filter');
    if (statusParam) {
      setFilter('status', statusParam.toUpperCase());
    }
  }, [fetchAlerts, fetchStats, searchParams, setFilter]);

  const activeFiltersCount = Object.values(filters).filter(v => v !== '').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Alerts</h1>
            {(!session || !session.running) && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-workspace)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
                DEMO ALERT DATA
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Security Alert Management & Triage Center
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { fetchAlerts(); fetchStats(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <KpiCard title="Critical" count={stats?.critical || 0} icon={<AlertCircle size={18} />} color="var(--color-critical)" onClick={() => setFilter('severity', 'CRITICAL')} active={filters.severity === 'CRITICAL'} />
        <KpiCard title="High" count={stats?.high || 0} icon={<AlertTriangle size={18} />} color="#f97316" onClick={() => setFilter('severity', 'HIGH')} active={filters.severity === 'HIGH'} />
        <KpiCard title="Open" count={stats?.open || 0} icon={<ShieldAlert size={18} />} color="#d97706" onClick={() => setFilter('status', 'OPEN')} active={filters.status === 'OPEN'} />
        <KpiCard title="Total Alerts" count={stats?.total || 0} icon={<List size={18} />} color="var(--primary)" onClick={resetFilters} active={activeFiltersCount === 0} />
      </div>

      {/* Filters & Table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', flex: 1 }}>

        {/* Filter Bar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200, background: 'var(--bg-input)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-default)' }}>
            <SearchIcon size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: '100%', color: 'var(--text-primary)' }}
            />
          </div>

          <select
            value={filters.severity}
            onChange={(e) => setFilter('severity', e.target.value)}
            style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-card)', outline: 'none', cursor: 'pointer' }}
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
            style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-card)', outline: 'none', cursor: 'pointer' }}
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          <select
            value={filters.category}
            onChange={(e) => setFilter('category', e.target.value)}
            style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-card)', outline: 'none', cursor: 'pointer' }}
          >
            <option value="">All Categories</option>
            <option value="RECONNAISSANCE">Reconnaissance</option>
            <option value="BRUTE_FORCE">Brute Force</option>
            <option value="LATERAL_MOVEMENT">Lateral Movement</option>
            <option value="EXFILTRATION">Exfiltration</option>
            <option value="ANOMALY">Anomaly</option>
            <option value="C2">C2</option>
            <option value="POLICY">Policy</option>
          </select>

          {activeFiltersCount > 0 && (
            <button
              onClick={resetFilters}
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Table Area */}
        <div style={{ flex: 1, position: 'relative' }}>
          {error ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-critical)' }}>{error}</div>
          ) : loading && alerts.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading alerts...</div>
          ) : (
            <AlertTable alerts={alerts} selectedId={selectedAlertId} onSelect={selectAlert} />
          )}
        </div>
      </div>

      <AlertDetailsDrawer />
    </div>
  );
}

function KpiCard({ title, count, icon, color, onClick, active }: { title: string, count: number, icon: React.ReactNode, color: string, onClick: () => void, active: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 'var(--radius-lg)',
        border: `1px solid ${active ? color : 'var(--border-default)'}`,
        boxShadow: active ? `0 0 0 1px ${color}, var(--shadow-sm)` : 'var(--shadow-sm)',
        display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer',
        transition: 'all 0.2s'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</span>
        <div style={{ color }}>{icon}</div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
        {count}
      </div>
    </div>
  );
}
