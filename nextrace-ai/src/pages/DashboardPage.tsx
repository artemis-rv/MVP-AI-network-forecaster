import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { LiveNetworkChart } from '@/components/dashboard/LiveNetworkChart';
import { AttackForecast } from '@/components/dashboard/AttackForecast';
import { NetworkEntities } from '@/components/dashboard/NetworkEntities';
import { RecentAlerts } from '@/components/dashboard/RecentAlerts';
import { InvestigationAssistant } from '@/components/dashboard/InvestigationAssistant';
import { LatestReports } from '@/components/dashboard/LatestReports';
import { kpiData } from '@/data/mockData';
import {
  ShieldAlert, Activity, TrendingUp, Folder
} from 'lucide-react';

const kpiIcons = [
  <ShieldAlert size={20} />,
  <Activity size={20} />,
  <TrendingUp size={20} />,
  <Folder size={20} />,
];

export function DashboardPage() {
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
            value={kpi.value}
            change={kpi.change}
            changeType={kpi.changeType}
            comparison={kpi.comparison}
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
        <LiveNetworkChart />
        <AttackForecast />
      </div>

      {/* Network Entities — Full Width */}
      <div style={{ marginBottom: 20 }}>
        <NetworkEntities />
      </div>

      {/* Alerts — Full Width */}
      <div style={{ marginBottom: 20 }}>
        <RecentAlerts />
      </div>

      {/* Bottom Two-Column */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
          marginBottom: 20,
        }}
      >
        <InvestigationAssistant />
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
