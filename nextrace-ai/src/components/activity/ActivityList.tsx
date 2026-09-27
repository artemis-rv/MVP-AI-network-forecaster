// NEXTRACE AI — Grouped activity table (Live Monitoring, Attack Prediction, Historical analysis)
// One row per grouped activity — never one row per packet.

import { useEffect, useRef } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { AlertSeverity } from '@/types/alert';
import { SEVERITY_STYLE } from '@/components/activity/severity';
import { type GroupedActivity, isActivityActive, formatActivityDuration } from '@/lib/activityGrouping';

export function SeverityPill({ severity }: { severity: AlertSeverity }) {
  const s = SEVERITY_STYLE[severity];
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.color}30`, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
      {severity}
    </span>
  );
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour12: false });
}

export function ActivityList({
  activities, onSelect, live = false, maxHeight = 320, emptyText, highlight,
}: {
  activities: GroupedActivity[];
  onSelect: (a: GroupedActivity) => void;
  live?: boolean;
  maxHeight?: number;
  emptyText?: string;
  /** Deep-linked activity: scrolled into view and briefly highlighted. */
  highlight?: { id: string; key: string | number } | null;
}) {
  const rows = [...activities].sort((a, b) => b.lastSeen - a.lastSeen);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlight) return;
    const row = scrollRef.current?.querySelector<HTMLElement>(`[data-activity-id="${CSS.escape(highlight.id)}"]`);
    if (!row) return;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.classList.remove('focus-flash');
    void row.offsetWidth; // restart the animation when the same row is focused again
    row.classList.add('focus-flash');
  }, [highlight]);

  if (rows.length === 0) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        {emptyText ?? 'No suspicious activity grouped yet.'}
      </div>
    );
  }

  return (
    <div ref={scrollRef} style={{ maxHeight, overflowY: 'auto', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
          <tr style={{ background: 'var(--bg-workspace)' }}>
            {['Activity', 'Source → Target(s)', 'Proto / Ports', 'Time range', 'Events', 'Severity', 'Conf.'].map(col => (
              <th key={col} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-default)' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(a => {
            const active = live && isActivityActive(a);
            return (
              <tr
                key={a.id}
                data-activity-id={a.id}
                onClick={() => onSelect(a)}
                style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-workspace)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '8px 10px', minWidth: 170 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldAlert size={13} color={SEVERITY_STYLE[a.severity].color} style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{a.label}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{a.id}</span>
                    {live && (
                      <span style={{ fontWeight: 700, color: active ? 'var(--color-live)' : 'var(--text-muted)' }}>
                        {active ? '● ongoing' : 'ended'}
                      </span>
                    )}
                    {a.alertIds.length > 0 && <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{a.alertIds.length} alert{a.alertIds.length > 1 ? 's' : ''}</span>}
                  </div>
                </td>
                <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {a.sources[0]}{a.sources.length > 1 ? ` +${a.sources.length - 1}` : ''} → {a.targets.length > 1 ? `${a.targets.length} hosts` : a.targets[0]}
                </td>
                <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {a.protocols.join('/')} · {a.portCount === 0 ? 'ports n/a' : a.portCount === 1 ? `:${a.ports[0]}` : `${a.portCount} ports`}
                </td>
                <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {clock(a.firstSeen)} · {formatActivityDuration(a.lastSeen - a.firstSeen)}
                </td>
                <td style={{ padding: '8px 10px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{a.eventCount.toLocaleString()}</td>
                <td style={{ padding: '8px 10px' }}><SeverityPill severity={a.severity} /></td>
                <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{a.confidence}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
