// NEXTRACE AI — Attack timeline built from grouped-activity milestones
// Entries are activity-level (detected / escalated / evolved), never per packet, in chronological order.
// The list lives in its own bounded scroll container and follows the newest entry unless the
// analyst has scrolled up to read older ones.

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { GroupedActivity } from '@/lib/activityGrouping';
import { SeverityPill } from '@/components/activity/ActivityList';
import { SEVERITY_STYLE } from '@/components/activity/severity';

interface Entry {
  key: string;
  ts: number;
  kind: string;
  text: string;
  activity: GroupedActivity;
}

const KIND_LABEL: Record<string, string> = { detected: 'DETECTED', escalated: 'ESCALATED', changed: 'EVOLVED' };

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour12: false });
}

export function ActivityTimeline({
  activities, onSelect, filterIp, predicted, maxHeight = 320, emptyText,
}: {
  activities: GroupedActivity[];
  onSelect?: (a: GroupedActivity) => void;
  filterIp?: string;
  predicted?: { stage: string; target?: string } | null;
  maxHeight?: number;
  emptyText?: string;
}) {
  const entries = useMemo<Entry[]>(() => activities
    .filter(a => !filterIp || a.sources.includes(filterIp) || a.targets.includes(filterIp))
    .flatMap(a => a.milestones.map((m, i) => ({ key: `${a.id}-${i}`, ts: m.ts, kind: m.kind, text: m.text, activity: a })))
    .sort((a, b) => a.ts - b.ts), [activities, filterIp]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight;
  }, [entries.length, predicted?.stage]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => { pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24; };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div ref={scrollRef} style={{ maxHeight, overflowY: 'auto', paddingRight: 4 }}>
      {entries.length === 0 && !predicted ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '24px 0' }}>
          {emptyText ?? 'No major events yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {entries.map((e, i) => {
            const color = SEVERITY_STYLE[e.activity.severity].color;
            const isLast = i === entries.length - 1 && !predicted;
            return (
              <div
                key={e.key}
                onClick={() => onSelect?.(e.activity)}
                style={{ display: 'flex', gap: 10, cursor: onSelect ? 'pointer' : 'default', borderRadius: 8, padding: '2px 4px' }}
                onMouseEnter={ev => onSelect && (ev.currentTarget.style.background = 'var(--bg-workspace)')}
                onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--border-subtle)', minHeight: 16, marginTop: 3 }} />}
                </div>
                <div style={{ paddingBottom: 10, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{clock(e.ts)}</span>
                    <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 999, background: `${color}18`, color, letterSpacing: '0.4px' }}>
                      {KIND_LABEL[e.kind] ?? e.kind.toUpperCase()}
                    </span>
                    <SeverityPill severity={e.activity.severity} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {e.activity.id} · {e.activity.eventCount.toLocaleString()} events
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{e.text}</div>
                </div>
              </div>
            );
          })}
          {predicted && (
            <div style={{ display: 'flex', gap: 10, padding: '2px 4px' }}>
              <div style={{ paddingTop: 4, flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--color-warning)', animation: 'pulse-dot 1.5s infinite' }} />
              </div>
              <div style={{ paddingBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Next</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 999, background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>PREDICTED</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-warning)' }}>
                  Potential next stage: {predicted.stage}{predicted.target ? ` → ${predicted.target}` : ''}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
