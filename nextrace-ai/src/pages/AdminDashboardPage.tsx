import { useNavigate } from 'react-router-dom';
import { 
  Users, Server, Activity, ShieldCheck, 
  FileText, ActivitySquare, Cpu, Database
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';

const mockSystemHealth = [
  { service: 'Application Backend', status: 'Healthy', uptime: '99.9%' },
  { service: 'Forecasting Engine', status: 'Healthy', uptime: '99.9%' },
  { service: 'Forensic Engine', status: 'Healthy', uptime: '99.8%' },
  { service: 'PostgreSQL Database', status: 'Healthy', uptime: '99.9%' },
];

const mockRecentActivity = [
  { user: 'soc.analyst1', action: 'Started Live Simulation', time: '10 mins ago' },
  { user: 'soc.analyst2', action: 'Generated Forensic Report', time: '1 hour ago' },
  { user: 'admin', action: 'Added new SOC User', time: '3 hours ago' },
  { user: 'system', action: 'Database Backup Completed', time: '5 hours ago' },
];

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { users } = useAppStore();
  const activeSocCount = users.filter((u) => u.role === 'SOC Analyst' && u.status === 'Active').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Admin Dashboard</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>System overview, health, and user activity.</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => navigate('/admin')} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Users size={16} /> Manage Users
            </button>
            <button onClick={() => navigate('/system-status')} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Activity size={16} /> System Health
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Active SOC Analysts', value: String(activeSocCount), icon: <Users size={20} color="var(--primary)" />, bg: 'var(--primary-light)' },
            { label: 'Active Data Sources', value: '12', icon: <Database size={20} color="var(--color-warning)" />, bg: 'var(--color-warning-light)' },
            { label: 'Running Analysis Jobs', value: '3', icon: <Cpu size={20} color="var(--color-live)" />, bg: 'var(--color-live-light)' },
            { label: 'System Status', value: '100% Healthy', icon: <ShieldCheck size={20} color="var(--color-safe)" />, bg: 'var(--color-safe-light)' },
          ].map((kpi, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {kpi.icon}
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{kpi.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{kpi.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* System Health */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-workspace)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ActivitySquare size={16} color="var(--primary)" /> Core Services Health
              </h2>
              <button onClick={() => navigate('/system-status')} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View All</button>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mockSystemHealth.map((s, i) => (
                <div key={i} style={{ padding: 12, background: 'var(--bg-workspace)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Server size={16} color="var(--text-secondary)" />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{s.service}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Uptime: {s.uptime}</span>
                    <span style={{ background: 'var(--color-safe-light)', color: 'var(--color-safe)', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{s.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-workspace)' }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} color="var(--primary)" /> Recent Audit Log
              </h2>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mockRecentActivity.map((log, i) => (
                <div key={i} style={{ padding: 12, background: 'var(--bg-workspace)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{log.action}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>User: <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{log.user}</span></div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {log.time}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
