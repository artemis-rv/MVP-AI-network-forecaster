import React from 'react';
import {
  TrendingUp,
  ArrowRight,
  Zap
} from 'lucide-react';
import { useSimplifiedSimulatorStore, ForecastStepInfo } from '@/store/simplifiedSimulatorStore';

export function StepForecaster() {
  const {
    k,
    currentStep,
    attackChain,
    projectedPlan,
    jumpToStep,
    status
  } = useSimplifiedSimulatorStore();

  const isCompleted = status === 'completed' || currentStep >= k;

  // Combine confirmed attack chain (step 1..currentStep) with remaining projected steps
  const stepsToDisplay: ForecastStepInfo[] = projectedPlan.map((planStep) => {
    const confirmed = attackChain.find(s => s.step === planStep.step);
    if (confirmed) {
      return {
        ...planStep,
        techniqueId: confirmed.techniqueId,
        techniqueName: confirmed.technique,
        tactic: confirmed.tactic,
        confidence: confirmed.confidence,
        riskScore: confirmed.priority,
        reason: confirmed.reason,
        mitigation: confirmed.mitigation,
        status: planStep.step < currentStep ? 'completed' : 'active',
      };
    }
    return planStep;
  });

  const avgConfidence = Math.round(
    stepsToDisplay.reduce((acc, s) => acc + s.confidence, 0) / (stepsToDisplay.length || 1)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Forecast Summary Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))',
        border: '1.5px solid rgba(99,102,241,0.25)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'var(--primary)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99,102,241,0.3)', flexShrink: 0
          }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Multi-Stage Attack Path Forecaster ({k}-Step Projection)
              </h2>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                background: isCompleted ? '#d1fae5' : '#ede9fe',
                color: isCompleted ? '#065f46' : '#6d28d9',
                border: `1px solid ${isCompleted ? '#a7f3d0' : '#ddd6fe'}`,
              }}>
                {isCompleted ? 'FORECAST COMPLETED' : `STEP ${currentStep} OF ${k}`}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Deterministic forward simulation projecting adversary lateral movement, privilege escalation, and crown-jewel targeting.
            </p>
          </div>
        </div>

        {/* Metric Badges */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={metricBadgeStyle}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Horizon</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary)' }}>K = {k} Steps</span>
          </div>
          <div style={metricBadgeStyle}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Avg Confidence</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#059669' }}>{avgConfidence}%</span>
          </div>
          <div style={metricBadgeStyle}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Est. Timeframe</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#d97706' }}>T+{k * 15}s</span>
          </div>
        </div>
      </div>

      {/* Step by Step Forecaster Timeline Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {stepsToDisplay.map((step) => {
          const isDone = step.step <= currentStep;
          const isCurrent = step.step === currentStep;
          const isNext = step.step === currentStep + 1;

          let cardBorder = 'var(--border-default)';
          let cardBg = 'var(--bg-card)';
          let badgeBg = 'var(--bg-workspace)';
          let badgeColor = 'var(--text-muted)';
          let badgeText = `PROJECTED (${step.timeWindow})`;

          if (isDone) {
            cardBorder = '#ef4444';
            cardBg = 'rgba(239,68,68,0.03)';
            badgeBg = '#fee2e2';
            badgeColor = '#dc2626';
            badgeText = isCurrent ? `⚡ EXECUTED (ACTIVE STAGE)` : `✓ COMPLETED (${step.timeWindow})`;
          } else if (isNext) {
            cardBorder = '#f59e0b';
            cardBg = 'rgba(245,158,11,0.04)';
            badgeBg = '#fef3c7';
            badgeColor = '#b45309';
            badgeText = `🔮 IMMINENT NEXT TARGET (${step.timeWindow})`;
          }

          return (
            <div
              key={step.step}
              style={{
                background: cardBg,
                borderRadius: 12,
                border: `1.5px solid ${cardBorder}`,
                padding: '16px 20px',
                boxShadow: isNext ? '0 0 16px rgba(245,158,11,0.15)' : 'var(--shadow-sm)',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: isDone ? '#ef4444' : isNext ? '#f59e0b' : 'var(--bg-input)',
                    color: isDone || isNext ? 'white' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, flexShrink: 0
                  }}>
                    {step.step}
                  </div>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                      Step {step.step}: {step.tactic}
                    </span>
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                      {step.techniqueId}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
                    background: badgeBg, color: badgeColor, textTransform: 'uppercase', letterSpacing: '0.4px'
                  }}>
                    {badgeText}
                  </span>
                  {!isDone && (
                    <button
                      onClick={() => jumpToStep(step.step)}
                      style={{
                        padding: '4px 10px', borderRadius: 6,
                        background: 'var(--bg-workspace)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-secondary)',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}
                      title="Jump simulation to this step"
                    >
                      <Zap size={11} color="var(--primary)" /> Jump to Step {step.step}
                    </button>
                  )}
                </div>
              </div>

              {/* Path & Assets Info */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(200px, 1fr) auto minmax(200px, 1fr)',
                alignItems: 'center',
                gap: 12,
                background: 'var(--bg-workspace)',
                padding: '10px 14px',
                borderRadius: 8,
                marginBottom: 12,
              }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Pivot Source</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{step.sourceName}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{step.sourceId}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: isDone ? '#ef4444' : isNext ? '#f59e0b' : 'var(--text-muted)' }}>
                  <ArrowRight size={18} />
                  <span style={{ fontSize: 9, fontWeight: 800 }}>ATTACK VECTOR</span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Projected Target</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isDone ? '#ef4444' : isNext ? '#d97706' : 'var(--primary)' }}>
                    {step.targetName}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {step.targetIp} · {step.targetRole}
                  </div>
                </div>
              </div>

              {/* Technique, Reason & Confidence Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, fontSize: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 2 }}>
                    MITRE ATT&CK Technique: <span style={{ color: 'var(--text-primary)' }}>{step.techniqueName}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    <strong>Exploit Vector:</strong> {step.reason}
                  </div>
                  <div style={{ fontSize: 11, color: '#047857', marginTop: 4, lineHeight: 1.4 }}>
                    <strong>SOC Mitigation:</strong> {step.mitigation}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, borderLeft: '1px solid var(--border-subtle)', paddingLeft: 14 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Prediction Confidence</span>
                      <span style={{ color: step.confidence >= 80 ? '#059669' : '#d97706' }}>{step.confidence}%</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'var(--bg-input)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${step.confidence}%`, height: '100%', background: step.confidence >= 80 ? '#10b981' : '#f59e0b', borderRadius: 999 }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Target Risk Impact</span>
                      <span style={{ color: step.riskScore >= 70 ? '#ef4444' : '#f59e0b' }}>{step.riskScore} / 100</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'var(--bg-input)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${step.riskScore}%`, height: '100%', background: step.riskScore >= 70 ? '#ef4444' : '#f59e0b', borderRadius: 999 }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const metricBadgeStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '6px 12px',
  borderRadius: 8,
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
};
