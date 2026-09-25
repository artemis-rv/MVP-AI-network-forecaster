import { Badge } from '@/components/ui/Badge';
import type { Alert } from '@/types/alert';
import { Target, Clock, Hash, Tag, FileText, CheckCircle, AlertTriangle, RotateCcw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AlertDetailsProps {
  alert: Alert;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onUpdateStatus: (id: string, status: import('@/types/alert').AlertStatus) => void;
}

const severityMap: Record<string, 'Critical' | 'High' | 'Medium' | 'Low'> = {
  CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low'
};

export function AlertDetails({ alert, onAcknowledge, onResolve, onReopen, onUpdateStatus }: AlertDetailsProps) {
  const navigate = useNavigate();

  function handleInvestigate() {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Badge severity={severityMap[alert.severity] || 'Low'} />
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
            background: alert.status === 'OPEN' ? 'rgba(245,158,11,0.1)' : 
                       alert.status === 'RESOLVED' ? 'rgba(16,185,129,0.1)' : 'var(--bg-workspace)',
            color: alert.status === 'OPEN' ? '#d97706' : 
                   alert.status === 'RESOLVED' ? '#059669' : 'var(--text-secondary)'
          }}>
            {alert.status}
          </span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{alert.id}</span>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0', lineHeight: 1.3 }}>
          {alert.title}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          {alert.description}
        </p>
      </div>

      {/* Entity Context */}
      <div style={{ background: 'var(--bg-workspace)', borderRadius: 8, padding: 16 }}>
        <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Target size={14} /> Entity Context
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Source IP</div>
            <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{alert.source_ip || '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Destination IP</div>
            <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{alert.destination_ip || '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Protocol</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{alert.protocol || '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Category</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{alert.category}</div>
          </div>
        </div>
      </div>

      {/* Detection & Timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Hash size={14} /> Detection
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Confidence</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{alert.confidence}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Events</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{alert.event_count}</span>
            </div>
          </div>
        </div>
        <div>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} /> Timeline
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>First Seen</span>
              <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatTime(alert.first_seen)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Last Seen</span>
              <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatTime(alert.last_seen)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Evidence */}
      {alert.evidence && alert.evidence.length > 0 && (
        <div>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={14} /> Evidence
          </h4>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alert.evidence.map((ev, i) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--bg-workspace)', padding: '8px 12px', borderRadius: 6 }}>
                <span style={{ color: 'var(--primary)', marginTop: 2 }}>•</span>
                <span style={{ lineHeight: 1.4 }}>{ev}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tags */}
      {alert.tags && alert.tags.length > 0 && (
        <div>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag size={14} /> Tags
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {alert.tags.map(tag => (
              <span key={tag} style={{ fontSize: 11, background: 'var(--bg-workspace)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: 4 }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {alert.status === 'OPEN' && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '10px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <CheckCircle size={16} /> Acknowledge Alert
          </button>
        )}
        
        {alert.status === 'ACKNOWLEDGED' && (
          <button
            onClick={() => onUpdateStatus(alert.id, 'IN_PROGRESS')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '10px', background: 'var(--color-warning)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <AlertTriangle size={16} /> Mark In Progress
          </button>
        )}

        {(alert.status === 'IN_PROGRESS' || alert.status === 'ACKNOWLEDGED') && (
          <button
            onClick={() => onResolve(alert.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '10px', background: 'var(--color-live)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <CheckCircle size={16} /> Resolve Alert
          </button>
        )}

        {alert.status === 'RESOLVED' && (
          <button
            onClick={() => onReopen(alert.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '10px', background: 'var(--bg-card)', color: '#d97706', border: '1px solid #d97706', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <RotateCcw size={16} /> Reopen Alert (Mark Open)
          </button>
        )}

        <button
          onClick={handleInvestigate}
          disabled={!alert.source_ip}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '10px', background: 'var(--bg-workspace)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: alert.source_ip ? 'pointer' : 'not-allowed', opacity: alert.source_ip ? 1 : 0.5 }}
        >
          <Search size={16} /> Investigate Entity
        </button>
      </div>
    </div>
  );
}
