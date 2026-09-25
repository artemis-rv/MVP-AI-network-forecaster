import { useState } from 'react';
import { 
  Activity, Server, Database, Cloud, AlertTriangle, 
  CheckCircle, Clock, Cpu, HardDrive, RefreshCw
} from 'lucide-react';

const mockServices = [
  { name: 'Application Backend', status: 'Healthy', type: 'Server' },
  { name: 'Forecasting Engine', status: 'Healthy', type: 'Server' },
  { name: 'Forensic Engine', status: 'Degraded', type: 'Server' },
  { name: 'PostgreSQL', status: 'Healthy', type: 'Database' },
  { name: 'Redis', status: 'Healthy', type: 'Database' },
  { name: 'Object/File Storage', status: 'Healthy', type: 'Cloud' },
];

const mockEvents = [
  { time: '10 mins ago', message: 'Forensic Engine latency spike detected (>2000ms).', type: 'warning' },
  { time: '1 hour ago', message: 'Database backup completed successfully.', type: 'info' },
  { time: '2 hours ago', message: 'Telemetry data source (Switch-A) reconnected.', type: 'info' },
  { time: '5 hours ago', message: 'Redis connection timed out briefly. Recovered automatically.', type: 'warning' },
];

export function SystemHealthPage() {
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdated(new Date().toLocaleTimeString());
      setIsRefreshing(false);
    }, 800);
  };

  const getStatusColor = (status: string) => {
    if (status === 'Healthy') return 'var(--color-safe)';
    if (status === 'Degraded') return 'var(--color-warning)';
    return 'var(--color-critical)';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'Healthy') return <CheckCircle size={16} color="var(--color-safe)" />;
    if (status === 'Degraded') return <AlertTriangle size={16} color="var(--color-warning)" />;
    return <AlertTriangle size={16} color="var(--color-critical)" />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Activity size={24} color="var(--primary)" /> System Health
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Clock size={12} /> Last updated: {lastUpdated}
            </p>
          </div>
          <button 
            onClick={handleRefresh}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} /> {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
          </button>
        </div>

        {/* Global Status Banner */}
        <div style={{ background: 'var(--color-warning-light)', border: '1px solid var(--color-warning)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <AlertTriangle size={24} color="var(--color-warning)" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#9a3412' }}>System Degraded</div>
            <div style={{ fontSize: 13, color: '#9a3412', marginTop: 2 }}>Forensic Engine is experiencing high latency. Some historical analyses may be delayed.</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 24 }}>
          {/* Resource Usage */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <HardDrive size={16} /> Resource Utilization
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'CPU Usage', val: 45, icon: <Cpu size={14} /> },
                { label: 'Memory', val: 78, icon: <HardDrive size={14} /> },
                { label: 'Storage', val: 32, icon: <Database size={14} /> }
              ].map((res, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{res.icon} {res.label}</span>
                    <span>{res.val}%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: 'var(--bg-workspace)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${res.val}%`, height: '100%', background: res.val > 75 ? 'var(--color-warning)' : 'var(--primary)', borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Jobs & Telemetry Overview */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Analysis Jobs & Telemetry</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ padding: 12, background: 'var(--bg-workspace)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Active Jobs</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>3</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>12 Completed today</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-workspace)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Telemetry Sources</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-safe)', marginTop: 4 }}>12/12</div>
                <div style={{ fontSize: 11, color: 'var(--color-safe)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={10} /> All Connected</div>
              </div>
            </div>
          </div>
        </div>

        {/* Services Grid */}
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, marginTop: 32 }}>Microservices Status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
          {mockServices.map((svc, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-workspace)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {svc.type === 'Server' ? <Server size={18} color="var(--text-secondary)" /> : svc.type === 'Database' ? <Database size={18} color="var(--text-secondary)" /> : <Cloud size={18} color="var(--text-secondary)" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{svc.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{svc.type}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                {getStatusIcon(svc.status)}
                <span style={{ fontSize: 11, fontWeight: 700, color: getStatusColor(svc.status) }}>{svc.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Events */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-workspace)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>System Events Log</h2>
          </div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mockEvents.map((evt, i) => (
              <div key={i} style={{ padding: '12px 16px', background: 'var(--bg-workspace)', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ marginTop: 2 }}>
                  {evt.type === 'warning' ? <AlertTriangle size={16} color="var(--color-warning)" /> : <Activity size={16} color="var(--primary)" />}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{evt.message}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{evt.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}} />
    </div>
  );
}
