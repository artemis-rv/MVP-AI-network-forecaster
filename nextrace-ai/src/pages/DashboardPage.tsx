import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { LiveNetworkChart } from '@/components/dashboard/LiveNetworkChart';
import { AttackForecast } from '@/components/dashboard/AttackForecast';
import { NetworkEntities } from '@/components/dashboard/NetworkEntities';
import { RecentAlerts } from '@/components/dashboard/RecentAlerts';
import { LatestReports } from '@/components/dashboard/LatestReports';
import { kpiData, trafficData } from '@/data/mockData';
import { useLiveStore } from '@/store/liveStore';
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
  const { session, temporalHistory, currentTemporal, liveNodes, liveEdges } = useLiveStore();
  const isLive = session?.running ?? false;

  // Derive live KPI values when a session is active
  const liveKpiValues = isLive && session ? [
    { value: session.suspicious_count > 0 ? Math.ceil(session.suspicious_count / 15) : 0 },
    { value: session.active_entities?.length || 0 },
    { value: currentTemporal ? Math.ceil(currentTemporal.suspicious_ratio * 10) : 0 },
    { value: 12 },
  ] : null;

  // Chart data: use real temporal history if available, else mock
  const chartData = temporalHistory.length > 0
    ? temporalHistory.map(t => ({
        time: typeof t.window_end === 'number'
          ? new Date(t.window_end < 1e11 ? t.window_end * 1000 : t.window_end).toLocaleTimeString('en-US', { hour12: false })
          : new Date(String(t.window_end)).toLocaleTimeString('en-US', { hour12: false }),
        total: t.packet_count,
        events: t.suspicious_count,
      }))
    : trafficData;

  return (
    <div>
      {/* Header */}
      <DashboardHeader />

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {kpiData.map((kpi, i) => (
          <KpiCard
            key={kpi.id}
            label={kpi.label}
            value={liveKpiValues ? liveKpiValues[i].value : kpi.value}
            change={kpi.change}
            changeType={kpi.changeType}
            comparison={isLive && i < 2 ? 'Live session' : kpi.comparison}
            color={kpi.color as 'critical' | 'warning' | 'primary' | 'secondary'}
            icon={kpiIcons[i]}
            sparkline={kpi.sparkline}
            delay={i * 80}
          />
        ))}
      </div>

      {/* Main Two-Column */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
          marginBottom: 20,
        }}
      >
        <LiveNetworkChart data={chartData} isLive={isLive} />
        <AttackForecast />
      </div>

      {/* Network Entities — Full Width */}
      <div style={{ marginBottom: 20 }}>
        <NetworkEntities nodes={liveNodes.length > 0 ? liveNodes : undefined} edges={liveEdges.length > 0 ? liveEdges : undefined} />
      </div>

      {/* Alerts — Full Width */}
      <div style={{ marginBottom: 20 }}>
        <RecentAlerts />
      </div>

      {/* Bottom Area */}
      <div style={{ marginBottom: 20 }}>
        <LatestReports />
      </div>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '20px 0 8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
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
