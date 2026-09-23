import { Badge } from '@/components/ui/Badge';
import type { Alert } from '@/types/alert';
import { useNavigate } from 'react-router-dom';

interface AlertTableProps {
  alerts: Alert[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const severityMap: Record<string, 'Critical' | 'High' | 'Medium' | 'Low'> = {
  CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low'
};

export function AlertTable({ alerts, selectedId, onSelect }: AlertTableProps) {
  const navigate = useNavigate();

  function handleInvestigate(alert: Alert, e: React.MouseEvent) {
    e.stopPropagation();
    if (!alert.source_ip) return;
    const params = new URLSearchParams({
      ip: alert.source_ip,
      source: 'alert',
      alertId: alert.id,
    });
    navigate(`/investigation?${params.toString()}`);
  }

  function formatTime(ts: string) {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? ts : d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  }

  if (alerts.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No alerts match the current filters.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-workspace)', borderBottom: '1px solid var(--border-subtle)' }}>
            {['Severity', 'Alert', 'Category', 'Source', 'Dest', 'Confidence', 'Events', 'Status', 'Last Seen', 'Actions'].map((col) => (
              <th
                key={col}
                style={{
                  padding: '12px 16px', textAlign: 'left', fontSize: 11,
                  fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap'
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => {
            const isSelected = selectedId === alert.id;
            return (
              <tr
                key={alert.id}
                onClick={() => onSelect(alert.id)}
                style={{
                  background: isSelected ? 'var(--sidebar-active-bg)' : 'transparent',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'background var(--transition-fast)'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--bg-workspace)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <td style={{ padding: '12px 16px' }}>
                  <Badge severity={severityMap[alert.severity] || 'Low'} />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{alert.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{alert.id}</div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {alert.category}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {alert.source_ip || '-'}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {alert.destination_ip || '-'}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {alert.confidence}%
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {alert.event_count}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                    background: alert.status === 'OPEN' ? 'rgba(245,158,11,0.1)' : 
                               alert.status === 'RESOLVED' ? 'rgba(16,185,129,0.1)' : 'var(--bg-workspace)',
                    color: alert.status === 'OPEN' ? '#d97706' : 
                           alert.status === 'RESOLVED' ? '#059669' : 'var(--text-secondary)'
                  }}>
                    {alert.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {formatTime(alert.last_seen)}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button
                    onClick={(e) => handleInvestigate(alert, e)}
                    disabled={!alert.source_ip}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
                      background: 'var(--primary-light)', color: 'var(--primary)',
                      border: '1px solid var(--primary)', cursor: alert.source_ip ? 'pointer' : 'not-allowed',
                      opacity: alert.source_ip ? 1 : 0.5, whiteSpace: 'nowrap'
                    }}
                  >
                    Investigate
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
