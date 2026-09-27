import { Badge } from '@/components/ui/Badge';
import type { Alert } from '@/types/alert';
import { Target, Clock, Hash, Tag, FileText, CheckCircle, AlertTriangle, RotateCcw, Search, Server, ListChecks, Lightbulb, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLiveStore } from '@/store/liveStore';
import {
  affectedAssetsOf, assetLine, recommendedActionsFor, actionLine, explainActivity,
} from '@/lib/socPlaybook';

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

export function AlertDetails({ alert: stored, onAcknowledge, onResolve, onReopen, onUpdateStatus }: AlertDetailsProps) {
  const navigate = useNavigate();
  // While the activity behind this alert is still in the current run, show its live state (counts,
  // assets and actions grow with it). Ids restart every run, so older alerts keep their stored snapshot.
  const activity = useLiveStore(st => {
    if (!stored.activity_id || !st.runStartedAt || Date.parse(stored.created_at) < st.runStartedAt) return null;
    return st.activities.find(a => a.id === stored.activity_id) ?? null;
  });
  const alert = activity ? {
    ...stored,
    explanation: explainActivity(activity),
    affected_assets: affectedAssetsOf(activity).map(assetLine),
    recommended_actions: recommendedActionsFor(activity).map(actionLine),
  } : stored;

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

      {/* Plain-language meaning */}
      {alert.explanation && (
        <div style={{ display: 'flex', gap: 10, background: 'var(--primary-light)', borderRadius: 8, padding: '12px 14px' }}>
          <Lightbulb size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{alert.explanation}</div>
        </div>
      )}

      {/* Affected assets — shown from the moment the alert is raised, updated when the activity reaches a new host */}
      <div>
        <h4 style={sectionTitle}><Server size={14} /> Affected Assets</h4>
        {alert.affected_assets && alert.affected_assets.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alert.affected_assets.map(line => {
              const [host, impact] = line.split(' — ');
              return (
                <div key={line} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', background: 'var(--bg-workspace)', padding: '8px 12px', borderRadius: 6 }}>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{host}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>{impact}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            No internal asset identified — {alert.destination_ip ? `destination ${alert.destination_ip} is outside the monitored network.` : 'no destination recorded.'}
          </div>
        )}
      </div>

      {/* Recommended actions */}
      {alert.recommended_actions && alert.recommended_actions.length > 0 && (
        <div>
          <h4 style={sectionTitle}><ListChecks size={14} /> Recommended Actions</h4>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alert.recommended_actions.map(line => {
              const m = line.match(/^\[(Immediate|Next|Follow-up)\]\s*(.*?)(?:\s—\s(.*))?$/);
              const priority = m?.[1] ?? 'Next';
              const color = priority === 'Immediate' ? 'var(--color-critical)' : priority === 'Next' ? '#d97706' : 'var(--text-muted)';
              return (
                <li key={line} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--bg-workspace)', padding: '8px 12px', borderRadius: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color, border: `1px solid ${color}`, borderRadius: 999, padding: '1px 6px', whiteSpace: 'nowrap', marginTop: 2 }}>{priority.toUpperCase()}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.45 }}>
                    {m?.[2] ?? line}
                    {m?.[3] && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{m[3]}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

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
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{alert.event_count.toLocaleString()}</span>
            </div>
            {alert.activity_id && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Layers size={12} /> Aggregated</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }} title="Similar packets are grouped into one activity; further packets update this alert instead of creating new ones.">
                  {alert.event_count.toLocaleString()} → 1 alert
                </span>
              </div>
            )}
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

        {alert.activity_id && (
          <button
            onClick={() => navigate(`${alert.activity_id!.startsWith('HACT') ? '/historical-pcap' : '/live-monitoring'}?focus=${encodeURIComponent(alert.activity_id!)}`)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '10px', background: 'var(--bg-workspace)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Layers size={16} /> View grouped activity {alert.activity_id}
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

const sectionTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px',
  marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
};
