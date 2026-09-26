import { useNavigate } from 'react-router-dom';
import { useForecastStore } from '@/store/forecastStore';
import { useLiveStore } from '@/store/liveStore';
import { Target, Clock, BarChart2, AlertTriangle, ArrowRight, Radio } from 'lucide-react';
import type { ForecastResult } from '@/types/forecast';
import { STAGE_COLORS } from '@/types/forecast';

// Dashboard summary of the single forecasting implementation (backend engine → forecastStore).
// The full view is the Attack Prediction page; this card links there with the session context.
export function AttackForecast() {
  const { currentForecast } = useForecastStore();
  const { session, runId } = useLiveStore();
  const hasForecast = !!currentForecast && currentForecast.current_stage !== 'No Active Session';

  if (runId && hasForecast) {
    return <LiveAttackForecast forecast={currentForecast} runId={runId} running={session?.running ?? false} />;
  }
  return <NoForecast />;
}

// ─── Live forecast (from backend engine) ──────────────────────────────────────
function LiveAttackForecast({ forecast, runId, running }: { forecast: ForecastResult; runId: string; running: boolean }) {
  const navigate = useNavigate();
  const { currentTemporal } = useLiveStore();
  const { current_stage, predicted_next_stage, confidence, target, time_window, is_benign, stage_probabilities } = forecast;
  const currentColors = STAGE_COLORS[current_stage] ?? STAGE_COLORS['No Active Session'];
  const nextColors    = STAGE_COLORS[predicted_next_stage] ?? STAGE_COLORS['No Active Session'];
  const windowLabel = windowEndLabel(currentTemporal?.window_end);

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          Attack Forecast (Next Steps)
        </h3>
        {running ? <LiveBadge /> : <StoppedBadge />}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        <Radio size={11} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Based on the latest observed network state of session{' '}
          <strong style={{ fontFamily: 'var(--font-mono)' }}>{runId}</strong>
          {windowLabel ? ` (window ending ${windowLabel})` : ''} · rule-based forecast
        </span>
      </div>

      {/* Current + Next */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StageChip label="Current Stage" stage={current_stage} colors={currentColors} />
        <StageChip label="Predicted Next" stage={predicted_next_stage} colors={nextColors} isPredicted={!is_benign} />
      </div>

      {/* Stage probability bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stage_probabilities.map((sp) => {
          const c = STAGE_COLORS[sp.stage] ?? STAGE_COLORS['No Active Session'];
          const isCur = sp.stage === current_stage;
          const isPred = sp.stage === predicted_next_stage && !is_benign;
          return (
            <div key={sp.stage}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{sp.stage}</span>
                <span style={{ fontWeight: 700, color: isCur ? c.text : isPred ? c.text : 'var(--text-muted)' }}>
                  {Math.round(sp.probability * 100)}%
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-input)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${(sp.probability * 100).toFixed(1)}%`, borderRadius: 999,
                  background: is_benign
                    ? 'var(--color-live)'
                    : isCur
                    ? `linear-gradient(90deg, ${c.border}, #dc2626)`
                    : isPred
                    ? c.border + '80'
                    : 'var(--border-default)',
                  transition: 'width 1s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary box */}
      <div style={{ background: is_benign ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)', border: `1px solid ${is_benign ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`, borderRadius: 12, padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <SumCard icon={<BarChart2 size={13} />} label="Predicted Next" value={`${predicted_next_stage} (${Math.round(confidence * 100)}%)`} critical={!is_benign} />
        <SumCard icon={<Target size={13} />} label="Likely Target" value={target} />
        <SumCard icon={<Clock size={13} />} label="Time Window" value={time_window} />
        <SumCard icon={<BarChart2 size={13} />} label="Confidence" value={`${Math.round(confidence * 100)}%`} />
      </div>

      <button onClick={() => navigate(`/attack-prediction?session=${encodeURIComponent(runId)}`)} style={ctaStyle}>
        View Attack Prediction <ArrowRight size={14} />
      </button>
    </div>
  );
}

// ─── No live session yet — never show a fabricated forecast ──────────────────
function NoForecast() {
  const navigate = useNavigate();
  return (
    <div style={containerStyle}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
        Attack Forecast (Next Steps)
      </h3>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
        <AlertTriangle size={26} color="var(--color-warning)" />
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>No forecast yet</div>
        <div style={{ fontSize: 12, maxWidth: 320, lineHeight: 1.5 }}>
          Predictions are computed from the latest observed network state. Start Live Monitoring and wait for the first temporal window.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={() => navigate('/live-monitoring')} style={{ ...ctaStyle, background: 'var(--bg-workspace)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', boxShadow: 'none' }}>
          Go to Live Monitoring
        </button>
        <button onClick={() => navigate('/attack-prediction')} style={ctaStyle}>
          View Attack Prediction <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function windowEndLabel(raw: number | string | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const num = Number(raw);
  const d = Number.isNaN(num) ? new Date(String(raw)) : new Date(num < 1e11 ? num * 1000 : num);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString('en-US', { hour12: false });
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function StageChip({ label, stage, colors, isPredicted }: { label: string; stage: string; colors: typeof STAGE_COLORS[string]; isPredicted?: boolean }) {
  return (
    <div style={{ background: colors.bg + '60', border: `1px solid ${colors.border}40`, borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isPredicted && <span style={{ fontSize: 10 }}>→</span>}
        <span style={{ fontSize: 12, fontWeight: 800, color: colors.text, lineHeight: 1.2 }}>{stage}</span>
      </div>
    </div>
  );
}

function SumCard({ icon, label, value, critical }: { icon: React.ReactNode; label: string; value: string; critical?: boolean }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: critical ? 'var(--color-critical)' : 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  );
}

function LiveBadge() {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(16,185,129,0.1)', color: 'var(--color-live)', border: '1px solid rgba(16,185,129,0.3)' }}>
      ● LIVE
    </span>
  );
}

function StoppedBadge() {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
      SESSION STOPPED
    </span>
  );
}

const ctaStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '9px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: 'white',
  fontSize: 12, fontWeight: 700, boxShadow: '0 2px 10px rgba(99,102,241,0.3)',
};

const containerStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  padding: '20px',
  border: '1px solid var(--border-default)',
  boxShadow: 'var(--shadow-sm)',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};
