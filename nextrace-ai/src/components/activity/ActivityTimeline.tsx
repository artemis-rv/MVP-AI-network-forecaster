// NEXTRACE AI — Attack timeline built from grouped-activity milestones
// Entries are activity-level (detected / escalated / evolved), never per packet, in chronological order.
// The list lives in its own bounded scroll container and follows the newest entry unless the
// analyst has scrolled up to read older ones.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crosshair, ExternalLink, PanelRightOpen } from 'lucide-react';
import type { GroupedActivity } from '@/lib/activityGrouping';
import { explainActivity, affectedAssetsOf, recommendedActionsFor } from '@/lib/socPlaybook';
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
  activities, onSelect, onLocate, linkFor, filterIp, predicted, maxHeight = 320, emptyText,
}: {
  activities: GroupedActivity[];
  /** Open the deep-inspection drawer for the activity. */
  onSelect?: (a: GroupedActivity) => void;
  /** Scroll to and highlight the activity elsewhere on the same page. */
  onLocate?: (a: GroupedActivity) => void;
  /** Page that owns the activity, when it lives on another page (navigates there with ?focus=). */
  linkFor?: (a: GroupedActivity) => string;
  filterIp?: string;
  predicted?: { stage: string; target?: string } | null;
  maxHeight?: number;
  emptyText?: string;
}) {
  const navigate = useNavigate();
  const [openKey, setOpenKey] = useState<string | null>(null);
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
                role="button"
                tabIndex={0}
                aria-expanded={openKey === e.key}
                onClick={() => {
                  setOpenKey(k => (k === e.key ? null : e.key));
                  if (onSelect) onSelect(e.activity);
                }}
                onKeyDown={ev => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    setOpenKey(k => (k === e.key ? null : e.key));
                    if (onSelect) onSelect(e.activity);
                  }
                }}
                style={{ display: 'flex', gap: 10, cursor: 'pointer', borderRadius: 8, padding: '2px 4px', background: openKey === e.key ? 'var(--bg-workspace)' : 'transparent' }}
                onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg-workspace)')}
                onMouseLeave={ev => (ev.currentTarget.style.background = openKey === e.key ? 'var(--bg-workspace)' : 'transparent')}
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
                  {openKey === e.key && (
                    <TimelineDetail
                      activity={e.activity}
                      onInspect={onSelect ? () => onSelect(e.activity) : undefined}
                      onLocate={onLocate ? () => onLocate(e.activity) : undefined}
                      onOpen={linkFor ? () => navigate(linkFor(e.activity)) : undefined}
                    />
                  )}
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

/** Inline answer to "what is this event?" — then one click to the exact element. */
function TimelineDetail({ activity: a, onInspect, onLocate, onOpen }: {
  activity: GroupedActivity;
  onInspect?: () => void;
  onLocate?: () => void;
  onOpen?: () => void;
}) {
  const assets = affectedAssetsOf(a);
  const first = recommendedActionsFor(a)[0];
  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 9px',
    borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer',
  };
  return (
    <div onClick={ev => ev.stopPropagation()} style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', cursor: 'default' }}>
      <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{explainActivity(a)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 10px', marginTop: 6, fontSize: 11 }}>
        <span style={{ color: 'var(--text-muted)' }}>Source</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{a.sources.join(', ')}</span>
        <span style={{ color: 'var(--text-muted)' }}>Affected</span>
        <span style={{ color: 'var(--text-secondary)' }}>{assets.length ? assets.map(x => `${x.ip} (${x.role})`).join(', ') : 'No internal asset'}</span>
        {first && <>
          <span style={{ color: 'var(--text-muted)' }}>First step</span>
          <span style={{ color: 'var(--text-secondary)' }}>{first.action}</span>
        </>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {onInspect && <button type="button" style={btn} onClick={onInspect}><PanelRightOpen size={12} /> Inspect</button>}
        {onLocate && <button type="button" style={btn} onClick={onLocate}><Crosshair size={12} /> Show in activity list</button>}
        {onOpen && <button type="button" style={btn} onClick={onOpen}><ExternalLink size={12} /> Open {a.id}</button>}
      </div>
    </div>
  );
}
