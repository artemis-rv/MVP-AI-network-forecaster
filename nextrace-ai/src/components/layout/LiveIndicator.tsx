// NEXTRACE AI — Global live-session indicator (top bar)
// Visible on every page. Stopped: a quiet grey pill. Running: a slow breathing ring (no blinking),
// elapsed time and packet count, coloured by the current threat level of ongoing activity:
// green = normal, amber = medium activity ongoing, red = high/critical activity ongoing.
// Animations are disabled for users who prefer reduced motion (see index.css).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveStore } from '@/store/liveStore';
import { isActivityActive, SEVERITY_RANK } from '@/lib/activityGrouping';

const LEVEL = {
  normal:   { color: '#10b981', label: 'Normal traffic' },
  elevated: { color: '#d97706', label: 'Medium-severity activity ongoing' },
  threat:   { color: '#dc2626', label: 'High-severity activity ongoing' },
} as const;

function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

export function LiveIndicator() {
  const navigate = useNavigate();
  const { session, wsConnected, activities, trafficSummary, runStartedAt } = useLiveStore();
  const running = session?.running ?? false;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const level = useMemo<keyof typeof LEVEL>(() => {
    let worst = -1;
    for (const a of activities) {
      if (a.significant && isActivityActive(a, now)) worst = Math.max(worst, SEVERITY_RANK[a.severity]);
    }
    return worst >= SEVERITY_RANK.HIGH ? 'threat' : worst >= SEVERITY_RANK.MEDIUM ? 'elevated' : 'normal';
  }, [activities, now]);

  if (!running) {
    return (
      <button
        type="button"
        onClick={() => navigate('/live-monitoring')}
        title="No live session running — open Live Monitoring to start one"
        data-tour="live-indicator"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999,
          border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-muted)',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.4px', cursor: 'pointer',
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-muted)', opacity: 0.6 }} />
        LIVE OFF
      </button>
    );
  }

  const { color, label } = wsConnected ? LEVEL[level] : { color: '#d97706', label: 'Reconnecting to the live stream' };
  const start = runStartedAt ?? (session?.start_time ? Date.parse(session.start_time) : now);

  return (
    <>
      {/* Thin animated accent along the top edge — present but not distracting */}
      <div className="live-sweep" aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, opacity: 0.9, ['--live-accent' as string]: color }} />
      <button
        type="button"
        onClick={() => navigate('/live-monitoring')}
        title={`${label} — open Live Monitoring`}
        data-tour="live-indicator"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px 4px 10px', borderRadius: 999,
          border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
          background: `color-mix(in srgb, ${color} 10%, transparent)`,
          color, fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', cursor: 'pointer', whiteSpace: 'nowrap',
          transition: 'color 0.4s, border-color 0.4s, background 0.4s',
        }}
      >
        <span className="live-dot" style={{ background: color }} />
        {wsConnected ? 'LIVE' : 'RECONNECTING'}
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {elapsed(now - start)} · {trafficSummary.total.toLocaleString()} pkts
        </span>
      </button>
    </>
  );
}
