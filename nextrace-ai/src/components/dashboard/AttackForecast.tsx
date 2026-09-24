import { useForecastStore } from '@/store/forecastStore';
import { useLiveStore } from '@/store/liveStore';
import { forecastStages, forecastSummary } from '@/data/mockData';
import { ArrowRight, Target, Clock, BarChart2, ShieldAlert } from 'lucide-react';
import type { ForecastResult } from '@/types/forecast';
import { STAGE_COLORS } from '@/types/forecast';

export function AttackForecast() {
  const { currentForecast } = useForecastStore();
  const { session } = useLiveStore();
  const isLive = session?.running ?? false;

  // Use live forecast when a session is active, else fall back to static demo data
  if (isLive && currentForecast) {
    return <LiveAttackForecast forecast={currentForecast} />;
  }
  return <MockAttackForecast />;
}

// ─── Live forecast (from backend engine) ──────────────────────────────────────
function LiveAttackForecast({ forecast }: { forecast: ForecastResult }) {
  const { current_stage, predicted_next_stage, confidence, target, time_window, is_benign, stage_probabilities } = forecast;
  const currentColors = STAGE_COLORS[current_stage] ?? STAGE_COLORS['No Active Session'];
  const nextColors    = STAGE_COLORS[predicted_next_stage] ?? STAGE_COLORS['No Active Session'];

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          Attack Forecast (Next Steps)
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <LiveBadge />
          <DemoBadge />
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
        ⚠ Deterministic demo prediction — not a real ML model output
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
    </div>
  );
}

// ─── Mock / fallback (no live session) ────────────────────────────────────────
function MockAttackForecast() {
  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          Attack Forecast (Next Steps)
        </h3>
        <DemoBadge />
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
        ⚠ Deterministic demo prediction — not a real ML model output
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'nowrap', overflowX: 'auto', padding: '4px 0' }}>
        {forecastStages.map((stage, i) => (
          <div key={stage.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <ForecastStageBubble stage={stage} />
            {i < forecastStages.length - 1 && (
              <ArrowRight
                size={16}
                color={stage.current || stage.completed ? 'var(--color-critical)' : 'var(--border-default)'}
                style={{
                  flexShrink: 0, margin: '0 4px',
                  filter: stage.current || stage.completed ? 'drop-shadow(0 0 6px var(--color-critical-glow))' : 'none',
                  animation: stage.current ? 'pulse-glow 2s infinite' : 'none'
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {forecastStages.map((stage) => (
          <div key={stage.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{stage.label}</span>
              <span style={{ fontWeight: 700, color: stage.current ? 'var(--color-critical)' : stage.completed ? 'var(--color-warning)' : 'var(--text-muted)' }}>
                {stage.probability}%
              </span>
            </div>
            <div style={{ height: 6, background: 'var(--bg-input)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${stage.probability}%`, borderRadius: 999,
                background: stage.current || stage.completed
                  ? 'var(--color-critical)'
                  : 'var(--border-default)',
                transition: 'width 1s ease',
              }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <SumCard icon={<BarChart2 size={13} />} label="Highest Risk Path" value={`Lateral Movement → Data Exfil`} critical />
          <SumCard icon={<Target size={13} />} label="Likely Target" value={forecastSummary.target} />
        </div>
        <div style={{ background: 'rgba(239,68,68,0.08)', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <ShieldAlert size={12} color="var(--color-critical)" />
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-critical)', textTransform: 'uppercase' }}>Recommended Action</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Isolate target ({forecastSummary.target}) and revoke active session tokens immediately.
          </div>
        </div>
      </div>
    </div>
  );
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

function ForecastStageBubble({ stage }: { stage: typeof forecastStages[0] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 80 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: `2px solid ${stage.current || stage.completed ? 'var(--color-critical)' : 'var(--border-default)'}`,
        background: stage.current || stage.completed ? 'var(--color-critical-light)' : 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: stage.current || stage.completed ? '0 0 12px var(--color-critical-glow)' : 'none',
        transition: 'all 0.3s', position: 'relative',
      }}>
        {stage.current && (
          <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid rgba(239,68,68,0.3)', animation: 'pulse-glow 2s infinite' }} />
        )}
        <span style={{ fontSize: 10, fontWeight: 800, color: stage.current || stage.completed ? 'var(--color-critical)' : 'var(--text-muted)' }}>
          {stage.probability}%
        </span>
      </div>
      <span style={{ fontSize: 10, fontWeight: stage.current || stage.completed ? 700 : 500, color: stage.current || stage.completed ? 'var(--color-critical)' : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>
        {stage.label}
      </span>
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

function DemoBadge() {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', color: 'var(--color-warning)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 999, padding: '2px 8px' }}>
      DEMO
    </span>
  );
}

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
