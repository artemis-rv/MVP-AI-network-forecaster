import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { recentAlerts } from '@/data/mockData';
import { Badge } from '@/components/ui/Badge';
import { ChevronRight } from 'lucide-react';

export function RecentAlerts() {
  const [hovered, setHovered] = useState<string | null>(null);
  const navigate = useNavigate();

  function handleInvestigate(alert: typeof recentAlerts[0], e: React.MouseEvent) {
    e.stopPropagation();
    const params = new URLSearchParams({
      ip: alert.source,
      source: 'alert',
      alertId: alert.id,
      event: alert.event,
    });
    navigate(`/investigation?${params.toString()}`);
  }

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Recent Alerts</h3>
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
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-workspace)' }}>
              {['Time', 'Severity', 'Event', 'Source IP', 'Destination IP', ''].map((col) => (
                <th
                  key={col}
                  style={{
                    padding: '10px 16px',
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
            {recentAlerts.map((alert) => (
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
              >
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                  {alert.time}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Badge severity={alert.severity} />
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {alert.event}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {alert.source}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {alert.destination}
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
