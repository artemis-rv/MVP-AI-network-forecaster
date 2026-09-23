import { forecastStages, forecastSummary } from '@/data/mockData';
import { ArrowRight, Target, Clock, BarChart2 } from 'lucide-react';

export function AttackForecast() {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sm)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          Attack Forecast (Next Steps)
        </h3>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.5px',
            color: 'var(--color-warning)',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 999,
            padding: '2px 8px',
          }}
        >
          DEMO
        </span>
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
        ⚠ Deterministic demo prediction — not a real ML model output
      </div>

      {/* Attack Progression */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'nowrap', overflowX: 'auto', padding: '4px 0' }}>
        {forecastStages.map((stage, i) => (
          <div key={stage.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <ForecastStage stage={stage} />
            {i < forecastStages.length - 1 && (
              <ArrowRight
                size={14}
                color={stage.completed ? 'var(--color-critical)' : 'var(--border-default)'}
                style={{ flexShrink: 0, margin: '0 4px' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Probability Bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {forecastStages.map((stage) => (
          <div key={stage.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{stage.label}</span>
              <span
                style={{
                  fontWeight: 700,
                  color: stage.current ? 'var(--color-critical)' : stage.completed ? 'var(--color-warning)' : 'var(--text-muted)',
                }}
              >
                {stage.probability}%
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: 'var(--bg-input)',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${stage.probability}%`,
                  borderRadius: 999,
                  background: stage.current
                    ? 'linear-gradient(90deg, var(--color-warning), var(--color-critical))'
                    : stage.completed
                    ? 'var(--color-warning)'
                    : 'var(--border-default)',
                  transition: 'width 1s ease',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div
        style={{
          background: 'rgba(239,68,68,0.04)',
          border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: 12,
          padding: '14px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}
      >
        <SumCard icon={<BarChart2 size={13} />} label="Most Likely Next Step" value={`${forecastSummary.nextStep} (${forecastSummary.probability}%)`} critical />
        <SumCard icon={<Target size={13} />} label="Likely Target" value={forecastSummary.target} />
        <SumCard icon={<Clock size={13} />} label="Time Window" value={forecastSummary.timeWindow} />
        <SumCard icon={<BarChart2 size={13} />} label="Confidence" value={forecastSummary.confidence} />
      </div>
    </div>
  );
}

function ForecastStage({ stage }: { stage: typeof forecastStages[0] }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        minWidth: 80,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: `2px solid ${
            stage.current ? 'var(--color-critical)' :
            stage.completed ? 'var(--color-warning)' :
            'var(--border-default)'
          }`,
          background: stage.current ? 'var(--color-critical-light)' : stage.completed ? 'var(--color-warning-light)' : 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: stage.current ? '0 0 12px var(--color-critical-glow)' : 'none',
          transition: 'all 0.3s',
          position: 'relative',
        }}
      >
        {stage.current && (
          <div
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              border: '2px solid rgba(239,68,68,0.3)',
              animation: 'pulse-glow 2s infinite',
            }}
          />
        )}
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: stage.current ? 'var(--color-critical)' : stage.completed ? 'var(--color-warning)' : 'var(--text-muted)',
          }}
        >
          {stage.probability}%
        </span>
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: stage.current ? 700 : 500,
          color: stage.current ? 'var(--color-critical)' : stage.completed ? 'var(--text-secondary)' : 'var(--text-muted)',
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
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
