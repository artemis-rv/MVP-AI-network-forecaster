// NEXTRACE AI — Attack stage map
// Kill-chain strip: each stage is observed (with the activities that prove it), predicted by the
// forecast, or not observed. Used on Attack Prediction, Historical analysis and in reports.

import { SEVERITY_STYLE } from '@/components/activity/severity';
import type { AlertSeverity } from '@/types/alert';

export interface StageMapItem {
  stage: string;
  status: 'observed' | 'predicted' | 'not_observed';
  severity: AlertSeverity | null;
  first_seen?: string | null;
  activities: string[];
  summary: string;
}

export function StageMap({ items, onSelectActivity, compact }: {
  items: StageMapItem[];
  onSelectActivity?: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      role="list"
      aria-label="Attack stage map"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 6, overflowX: 'auto' }}
    >
      {items.map((m, i) => {
        const observed = m.status === 'observed';
        const predicted = m.status === 'predicted';
        const color = observed && m.severity ? SEVERITY_STYLE[m.severity].color : predicted ? 'var(--color-warning)' : 'var(--text-muted)';
        return (
          <div
            key={m.stage}
            role="listitem"
            title={m.summary}
            style={{
              position: 'relative', minWidth: 96, borderRadius: 8, padding: compact ? '8px 8px' : '10px 10px',
              border: `1px ${predicted ? 'dashed' : 'solid'} ${observed || predicted ? color : 'var(--border-default)'}`,
              background: observed ? `color-mix(in srgb, ${color} 10%, transparent)` : 'var(--bg-workspace)',
              opacity: m.status === 'not_observed' ? 0.6 : 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{i + 1}</span>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.4px', color }}>
                {observed ? 'OBSERVED' : predicted ? 'PREDICTED' : 'NOT SEEN'}
              </span>
            </div>
            <div style={{ fontSize: compact ? 11 : 12, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25 }}>{m.stage}</div>
            {!compact && (
              <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.35 }}>
                {observed && m.first_seen ? `${m.first_seen} · ` : ''}{m.summary}
              </div>
            )}
            {m.activities.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
                {m.activities.slice(0, 4).map(id => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectActivity?.(id)}
                    disabled={!onSelectActivity}
                    style={{
                      fontSize: 9, fontFamily: 'var(--font-mono)', padding: '1px 5px', borderRadius: 4,
                      border: '1px solid var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-secondary)',
                      cursor: onSelectActivity ? 'pointer' : 'default',
                    }}
                  >
                    {id}
                  </button>
                ))}
                {m.activities.length > 4 && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{m.activities.length - 4}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

