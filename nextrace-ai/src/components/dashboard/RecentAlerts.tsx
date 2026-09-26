import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlertStore } from '@/store/alertStore';
import { Badge } from '@/components/ui/Badge';
import { ChevronRight } from 'lucide-react';
import type { Alert } from '@/types/alert';

export function RecentAlerts() {
  const [hovered, setHovered] = useState<string | null>(null);
  const navigate = useNavigate();
  const { alerts, fetchAlerts, selectAlert } = useAlertStore();

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const displayAlerts = alerts.slice(0, 5);

  function formatTime(isoStr?: string) {
    if (!isoStr) return 'Just now';
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? isoStr : d.toLocaleTimeString('en-US', { hour12: false });
  }

  function formatSeverity(sev: string): 'Critical' | 'High' | 'Medium' | 'Low' {
    const s = sev.toUpperCase();
    if (s === 'CRITICAL') return 'Critical';
    if (s === 'HIGH') return 'High';
    if (s === 'MEDIUM') return 'Medium';
    return 'Low';
  }

  function handleInvestigate(alert: Alert, e: React.MouseEvent) {
    e.stopPropagation();
    selectAlert(alert.id);
    if (alert.source_ip) {
      const params = new URLSearchParams({
        ip: alert.source_ip,
        source: 'alert',
        alertId: alert.id,
        event: alert.title,
      });
      navigate(`/investigation?${params.toString()}`);
    } else {
      navigate('/alerts');
    }
  }

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
        maxHeight: 420,
        transition: 'all 0.3s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Recent Alerts</h3>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-workspace)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            {alerts.length} Total
          </span>
        </div>
        <button
          onClick={() => navigate('/alerts')}
          style={{
            fontSize: 12,
            color: 'var(--primary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          View All <ChevronRight size={13} />
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['Time', 'Severity', 'Event', 'Source IP', 'Destination IP', 'Status', ''].map((col) => (
                <th
                  key={col}
                  style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.4px',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayAlerts.map((alert) => (
              <tr
                key={alert.id}
                style={{
                  background: hovered === alert.id ? 'var(--bg-workspace)' : 'transparent',
                  borderTop: '1px solid var(--border-subtle)',
                  transition: 'background var(--transition-fast)',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHovered(alert.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  selectAlert(alert.id);
                  navigate('/alerts');
                }}
              >
                <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                  {formatTime(alert.created_at || alert.last_seen)}
                </td>
                <td style={{ padding: '9px 12px' }}>
                  <Badge severity={formatSeverity(alert.severity)} />
                </td>
                <td style={{ padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {alert.title}
                </td>
                <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {alert.source_ip || '—'}
                </td>
                <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {alert.destination_ip || '—'}
                </td>
                <td style={{ padding: '9px 12px', fontSize: 11, fontWeight: 700 }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: alert.status === 'OPEN' ? 'rgba(245, 158, 11, 0.1)' :
                                alert.status === 'RESOLVED' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-workspace)',
                    color: alert.status === 'OPEN' ? '#d97706' :
                           alert.status === 'RESOLVED' ? '#059669' : 'var(--text-secondary)'
                  }}>
                    {alert.status}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={(e) => handleInvestigate(alert, e)}
                    style={{
                      fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 8,
                      background: hovered === alert.id ? 'var(--primary)' : 'transparent',
                      color: hovered === alert.id ? 'white' : 'var(--primary)',
                      border: '1px solid var(--primary)',
                      cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    Investigate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
