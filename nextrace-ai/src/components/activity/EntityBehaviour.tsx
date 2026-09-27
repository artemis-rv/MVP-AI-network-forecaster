// NEXTRACE AI — Entity behaviour breakdown
// Answers "what exactly did this host do?" behind its (aggregated) alerts: every grouped activity it
// originated or received, how many attempts each contains, against which services, and what the
// network can and cannot show about the outcome. One row per activity — the raw events stay grouped.

import { useMemo } from 'react';
import { ArrowRight, ArrowLeft, Layers } from 'lucide-react';
import type { GroupedActivity } from '@/lib/activityGrouping';
import { formatActivityDuration } from '@/lib/activityGrouping';
import { entityBehaviour } from '@/lib/socPlaybook';
import { SeverityPill } from '@/components/activity/ActivityList';

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour12: false });
}

export function EntityBehaviour({ ip, activities, onSelect, compact, alertsApplicable = true }: {
  ip: string;
  activities: GroupedActivity[];
  onSelect?: (activityId: string) => void;
  compact?: boolean;
  /** Historical captures produce report findings, not live alerts. */
  alertsApplicable?: boolean;
}) {
  const b = useMemo(() => entityBehaviour(ip, activities), [ip, activities]);

  if (b.rows.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No suspicious activity involves {ip}.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Aggregation at a glance: many events, few activities, even fewer alerts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-workspace)', borderRadius: 8, padding: '8px 10px' }}>
        <Layers size={14} color="var(--primary)" />
        <strong style={{ color: 'var(--text-primary)' }}>{b.totalEvents.toLocaleString()}</strong> suspicious events
        <ArrowRight size={12} /> <strong style={{ color: 'var(--text-primary)' }}>{b.rows.length}</strong> grouped activit{b.rows.length === 1 ? 'y' : 'ies'}
        ({b.attackTypes} attack type{b.attackTypes === 1 ? '' : 's'})
        {alertsApplicable && <><ArrowRight size={12} /> <strong style={{ color: 'var(--text-primary)' }}>{b.alerts}</strong> alert{b.alerts === 1 ? '' : 's'}</>}
        <span style={{ color: 'var(--text-muted)' }}>· repeated attempts are counted inside one activity{alertsApplicable ? ', not raised as separate alerts' : ''}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-workspace)' }}>
              {['Activity', 'Role', 'Attempts', 'Against', ...(compact ? [] : ['When', 'Outcome']), 'Severity'].map(c => (
                <th key={c} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.rows.map(r => (
              <tr
                key={r.activityId}
                onClick={() => onSelect?.(r.activityId)}
                style={{ borderBottom: '1px solid var(--border-subtle)', cursor: onSelect ? 'pointer' : 'default' }}
                onMouseEnter={e => onSelect && (e.currentTarget.style.background = 'var(--bg-workspace)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '7px 10px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {r.activityId}{!alertsApplicable ? '' : r.alertIds.length ? ` · ${r.alertIds.join(', ')}` : ' · no alert yet'}
                  </div>
                </td>
                <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: r.role === 'source' ? 'var(--color-critical)' : 'var(--text-secondary)', fontWeight: 600 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {r.role === 'source' ? <ArrowRight size={12} /> : <ArrowLeft size={12} />}
                    {r.role === 'source' ? 'Performed' : 'Targeted'}
                  </span>
                </td>
                <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{r.attempts.toLocaleString()}</strong>
                  <span style={{ color: 'var(--text-muted)' }}> {r.noun}</span>
                </td>
                <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{r.counterparts.slice(0, 2).join(', ')}{r.counterparts.length > 2 ? ` +${r.counterparts.length - 2}` : ''}</span>
                  {r.services !== '—' && <span style={{ color: 'var(--text-muted)' }}> · {r.services}</span>}
                </td>
                {!compact && (
                  <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                    {clock(r.firstSeen)} · {formatActivityDuration(r.lastSeen - r.firstSeen)}
                  </td>
                )}
                {!compact && <td style={{ padding: '7px 10px', fontSize: 11, color: 'var(--text-secondary)', minWidth: 180 }}>{r.outcome}</td>}
                <td style={{ padding: '7px 10px' }}><SeverityPill severity={r.severity} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
