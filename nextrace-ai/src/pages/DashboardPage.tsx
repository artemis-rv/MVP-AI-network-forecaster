import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { LiveNetworkChart } from '@/components/dashboard/LiveNetworkChart';
import { AttackForecast } from '@/components/dashboard/AttackForecast';
import { NetworkEntities } from '@/components/dashboard/NetworkEntities';
import { RecentAlerts } from '@/components/dashboard/RecentAlerts';
import { LatestReports } from '@/components/dashboard/LatestReports';
import { kpiData } from '@/data/mockData';
import { useLiveStore } from '@/store/liveStore';
import { useAlertStore } from '@/store/alertStore';
import {
  ShieldAlert, Shield, TrendingUp, CheckCircle
} from 'lucide-react';

const kpiIcons = [
  <ShieldAlert size={20} />,
  <Shield size={20} />,
  <TrendingUp size={20} />,
  <CheckCircle size={20} />,
];

export function DashboardPage() {
  const navigate = useNavigate();
  const { session, temporalHistory, currentTemporal, liveNodes, liveEdges } = useLiveStore();
  const { stats, alerts, fetchStats, fetchAlerts } = useAlertStore();
  const isLive = session?.running ?? false;

  useEffect(() => {
    fetchStats();
    fetchAlerts();
  }, [fetchStats, fetchAlerts]);

  // Derive live KPI values when a session is active
  const liveKpiValues = isLive && session ? [
    { value: (stats?.total ?? 0) + (session.suspicious_count > 0 ? Math.ceil(session.suspicious_count / 15) : 0) },
    { value: session.active_entities?.length || 0 },
    { value: currentTemporal ? Math.ceil(currentTemporal.suspicious_ratio * 10) : 0 },
    { value: 12 },
  ] : null;

  // Chart data: use real temporal history if available, else mock
  const chartData = (isLive && temporalHistory.length > 0)
    ? temporalHistory.map(t => {
        let dateObj = new Date();
        if (t.window_end) {
           if (typeof t.window_end === 'number') {
             dateObj = new Date(t.window_end < 1e11 ? t.window_end * 1000 : t.window_end);
           } else {
             const str = String(t.window_end);
             dateObj = new Date(!isNaN(Number(str)) ? Number(str) * 1000 : str);
           }
        }
        return {
          time: dateObj.toLocaleTimeString('en-US', { hour12: false }),
          total: t.packet_count,
          events: t.suspicious_count,
        };
      })
    : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <DashboardHeader />

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {kpiData.map((kpi, i) => {
          const links = ['/alerts', '/live-monitoring', '/attack-prediction', '/reports'];
          const val = kpi.id === 'alerts'
            ? (liveKpiValues ? liveKpiValues[0].value : (stats?.total ?? alerts.length ?? kpi.value))
            : (liveKpiValues ? liveKpiValues[i].value : kpi.value);

          const comp = kpi.id === 'alerts'
            ? `${(stats?.open ?? 0) + (stats?.in_progress ?? 0)} unresolved threats`
            : (isLive && i < 2 ? 'Live session' : kpi.comparison);

          return (
            <KpiCard
              key={kpi.id}
              label={kpi.label}
              value={val}
              change={kpi.change}
              changeType={kpi.changeType}
              comparison={comp}
              color={kpi.color as 'critical' | 'warning' | 'primary' | 'secondary'}
              icon={kpiIcons[i]}
              delay={i * 80}
              onClick={() => navigate(links[i])}
            />
          );
        })}
      </div>

      {/* Top Row: Charts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          minHeight: 300,
        }}
      >
        <LiveNetworkChart data={chartData} isLive={isLive} />
        <AttackForecast />
      </div>

      {/* Bottom Row: Entities and Alerts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          minHeight: 350,
        }}
      >
        <NetworkEntities nodes={liveNodes.length > 0 ? liveNodes : undefined} edges={liveEdges.length > 0 ? liveEdges : undefined} />
        <RecentAlerts />
      </div>
      
      {/* Bottom Area */}
      <div style={{ paddingBottom: 16 }}>
        <LatestReports />
      </div>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '12px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
          <strong style={{ color: 'var(--primary)' }}>NEXTRACE AI</strong>
          &nbsp;|&nbsp;Network Attack Forecasting &amp; Forensic Intelligence
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {['Documentation', 'Support', 'Feedback'].map((link) => (
            <a
              key={link}
              href="#"
              style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {link}
            </a>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--color-live)', fontWeight: 600 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--color-live)',
                animation: 'pulse-dot 2s infinite',
              }}
            />
            All Systems Operational
          </div>
        </div>
      </footer>
    </div>
  );
}
