import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useLiveStore } from '@/store/liveStore';

export function DashboardHeader() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const activities = useLiveStore(state => state.activities);
  const suspicious = activities.filter(a => a.significant).length;

  const hour = now.getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div
      className="animate-fade-in-up"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 28,
        flexWrap: 'wrap',
        gap: 16,
      }}
    >
      {/* Left: Greeting */}
      <div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.5px',
            lineHeight: 1.2,
            marginBottom: 6,
          }}
        >
          {greeting}, SOC Analyst
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 400 }}>
          {suspicious > 0
            ? `${suspicious} suspicious activit${suspicious === 1 ? 'y' : 'ies'} observed in the current session. Here's what's happening right now.`
            : "No suspicious activity observed. Here's what's happening right now."}
        </p>
      </div>

      {/* Right: Tagline + Date + Live */}
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.3px',
            fontStyle: 'italic',
          }}
        >
          "From Packets to Predictions."
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
          {format(now, 'EEEE, dd MMM yyyy')} · {format(now, 'HH:mm:ss')}
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 999,
            padding: '3px 10px',
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-live)',
              animation: 'pulse-dot 1.5s infinite',
            }}
          />
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-live)', letterSpacing: '0.5px' }}>
            LIVE DEMO
          </span>
        </div>
      </div>
    </div>
  );
}
