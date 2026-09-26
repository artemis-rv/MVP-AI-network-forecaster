// NEXTRACE AI — Investigation Timeline Panel

import { useForecastStore } from '@/store/forecastStore';
import { useInvestigationStore } from '@/store/investigationStore';
import { STAGE_COLORS } from '@/types/forecast';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';
import { useLiveStore } from '@/store/liveStore';

const TYPE_CONFIG = {
  observed: { dot: 'var(--color-live)',     label: 'OBSERVED',  labelColor: 'var(--color-live)'     },
  predicted:{ dot: 'var(--color-warning)',  label: 'PREDICTED', labelColor: 'var(--color-warning)'  },
  info:     { dot: 'var(--text-muted)',     label: 'INFO',      labelColor: 'var(--text-muted)'     },
};

export function TimelinePanel() {
  const { timeline, refreshTimeline } = useInvestigationStore();
  const { currentForecast } = useForecastStore();
  const { displayEvents } = useLiveStore();

  useEffect(() => {
    refreshTimeline();
  }, [displayEvents, refreshTimeline]);

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Attack Timeline</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <LegendDot color="var(--color-live)" label="Observed" />
          <LegendDot color="var(--color-warning)" label="Predicted" />
        </div>
      </div>

      {timeline.length === 0 ? (
        <EmptyState text="No events observed for this entity." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {timeline.map((entry, i) => {
            const cfg = TYPE_CONFIG[entry.type] ?? TYPE_CONFIG.info;
            const isLast = i === timeline.length - 1;
            const stageColors = entry.stage ? STAGE_COLORS[entry.stage] : null;

            return (
              <div key={entry.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: isLast ? 0 : 4 }}>
                {/* Timeline line + dot */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 3 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: stageColors?.border ?? cfg.dot,
                    border: `2px solid ${stageColors?.border ?? cfg.dot}`,
                    animation: entry.type === 'predicted' ? 'pulse-dot 1.5s infinite' : 'none',
                    flexShrink: 0,
                  }} />
                  {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--border-subtle)', minHeight: 18, marginTop: 3 }} />}
                </div>

                {/* Content */}
                <div style={{ paddingBottom: isLast ? 0 : 10, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {entry.timestamp}
                    </span>
                    <span style={{
                      fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 999,
                      background: cfg.dot + '18', color: cfg.labelColor, letterSpacing: '0.4px',
                    }}>
                      {cfg.label}
                    </span>
                    {entry.stage && stageColors && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 999,
                        background: stageColors.bg, color: stageColors.text,
                      }}>
                        {entry.stage}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: entry.type === 'predicted' ? 'var(--color-warning)' : 'var(--text-secondary)', lineHeight: 1.4, fontWeight: entry.type === 'predicted' ? 600 : 400 }}>
                    {entry.event}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Forecast disclaimer */}
      {currentForecast && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 10, fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          <AlertTriangle size={11} style={{ flexShrink: 0 }} />
          <span>Timeline combines observed demo events with deterministic forecast predictions. Not real attack evidence.</span>
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
      {label}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '24px 0' }}>{text}</div>;
}

const panelStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border-default)',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
};
