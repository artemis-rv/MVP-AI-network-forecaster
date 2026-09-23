import { useEffect } from 'react';
import {
  Target, Clock, Shield,
  ChevronRight, Info,
} from 'lucide-react';
import { useForecastStore } from '@/store/forecastStore';
import { useLiveStore } from '@/store/liveStore';
import { apiService } from '@/services/api';
import type { ForecastResult } from '@/types/forecast';
import { ATTACK_STAGES, STAGE_COLORS } from '@/types/forecast';

// ─────────────────────────────────────────────────────────────────────────────
export function AttackPredictionPage() {
  const { currentForecast, selectedStage, setSelectedStage, setForecast, setLoading } = useForecastStore();
  const { session } = useLiveStore();
  const isLive = session?.running ?? false;

  // Fetch forecast on mount (REST fallback before WS fires)
  useEffect(() => {
    setLoading(true);
    apiService.getForecast()
      .then(setForecast)
      .catch(() => {/* backend may not be up yet – WS will supply it */})
      .finally(() => setLoading(false));
  }, [setForecast, setLoading]);

  const forecast = currentForecast;
  const isBenign = forecast?.is_benign ?? true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              Attack Prediction
            </h1>
            {isLive && <LiveBadge />}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Forecast the next stage of observed network activity · Rule-based temporal analysis
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <DemoBadge label="SIMULATED ANALYTICS" color="var(--color-warning)" />
          <DemoBadge label={forecast?.demo_label ?? 'Deterministic demo prediction — not a trained ML model'} color="var(--text-muted)" small />
        </div>
      </div>

      {/* ── No session banner ── */}
      {!isLive && !forecast && (
        <NoSessionBanner />
      )}

      {/* ── Main 2-col layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <CurrentStateCard forecast={forecast} />
        <ForecastCard forecast={forecast} />
      </div>

      {/* ── Attack Progression ── */}
      <AttackProgressionBar
        forecast={forecast}
        selectedStage={selectedStage}
        onStageClick={setSelectedStage}
      />

      {/* ── Bottom 2-col: Timeline + Evidence ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ForecastTimeline forecast={forecast} />
        <EvidencePanel forecast={forecast} isBenign={isBenign} />
      </div>
    </div>
  );
}

// ─── Current State Card ────────────────────────────────────────────────────────
function CurrentStateCard({ forecast }: { forecast: ForecastResult | null }) {
  const { currentTemporal, session } = useLiveStore();
  const stage = forecast?.current_stage ?? 'No Active Session';
  const colors = STAGE_COLORS[stage] ?? STAGE_COLORS['No Active Session'];

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Current State</h3>
        <Shield size={16} color="var(--text-muted)" />
      </div>

      {/* Stage badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: colors.bg, border: `1px solid ${colors.border}`,
        borderRadius: 12, padding: '10px 16px', marginBottom: 16,
        boxShadow: `0 0 16px ${colors.glow}`,
      }}>
        <span style={{ fontSize: 20 }}>{stageIcon(stage)}</span>
        <span style={{ fontWeight: 800, fontSize: 18, color: colors.text }}>{stage}</span>
      </div>

      {/* Temporal metrics */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          Observed Temporal State
        </div>
        {currentTemporal ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <MetricRow label="Window" value={`${currentTemporal.window_seconds}s`} />
            <MetricRow label="Traffic" value={`${currentTemporal.packet_count} pkts`} />
            <MetricRow label="Suspicious" value={currentTemporal.suspicious_count.toString()} highlight={currentTemporal.suspicious_count > 5} />
            <MetricRow label="Conn Rate" value={`${currentTemporal.connection_rate.toFixed(1)}/s`} />
            <MetricRow label="Susp Ratio" value={`${(currentTemporal.suspicious_ratio * 100).toFixed(1)}%`} highlight={currentTemporal.suspicious_ratio > 0.15} />
            <MetricRow label="Src IPs" value={currentTemporal.unique_src_ips.toString()} />
            <MetricRow label="Dst IPs" value={currentTemporal.unique_dst_ips.toString()} />
            <MetricRow label="Dst Ports" value={currentTemporal.unique_dst_ports.toString()} />
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '12px 0' }}>
            {session?.running ? 'Waiting for first temporal window…' : 'Start a live demo session to observe temporal states.'}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Forecast Card ─────────────────────────────────────────────────────────────
function ForecastCard({ forecast }: { forecast: ForecastResult | null }) {
  const nextStage = forecast?.predicted_next_stage ?? 'N/A';
  const confidence = forecast?.confidence ?? 0;
  const colors = STAGE_COLORS[nextStage] ?? STAGE_COLORS['No Active Session'];
  const isBenign = forecast?.is_benign ?? true;

  // Circular arc parameters
  const R = 44;
  const CIRC = 2 * Math.PI * R;
  const arc = CIRC * confidence;

  return (
    <div style={{ ...cardStyle, border: `1px solid ${isBenign ? 'var(--border-default)' : colors.border}`, boxShadow: isBenign ? 'var(--shadow-sm)' : `0 0 24px ${colors.glow}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Predicted Next Stage</h3>
        <Shield size={16} color={isBenign ? 'var(--color-live)' : colors.text} />
      </div>

      {/* Main prediction display */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 16 }}>
        {/* Confidence arc */}
        <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
          <svg width={110} height={110}>
            {/* Track */}
            <circle cx={55} cy={55} r={R} fill="none" stroke="var(--bg-input)" strokeWidth={8} />
            {/* Arc */}
            <circle
              cx={55} cy={55} r={R} fill="none"
              stroke={isBenign ? 'var(--color-live)' : colors.border}
              strokeWidth={8}
              strokeDasharray={`${arc} ${CIRC - arc}`}
              strokeDashoffset={CIRC / 4}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: isBenign ? 'var(--color-live)' : colors.text }}>
              {Math.round(confidence * 100)}%
            </span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>confidence</span>
          </div>
        </div>

        {/* Stage name + details */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>{stageIcon(nextStage)}</span>
            <span style={{ fontWeight: 800, fontSize: 17, color: isBenign ? 'var(--color-live)' : colors.text, lineHeight: 1.2 }}>
              {nextStage}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <InfoRow icon={<Clock size={12} />} label="Time Window" value={forecast?.time_window ?? 'N/A'} />
            <InfoRow icon={<Target size={12} />} label="Likely Target" value={forecast?.target ?? 'N/A'} highlight={!isBenign} />
          </div>
        </div>
      </div>

      {/* Demo disclaimer */}
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--bg-workspace)', borderRadius: 8, padding: '6px 10px' }}>
        ⚠ {forecast?.demo_label ?? 'Deterministic demo prediction'}
      </div>
    </div>
  );
}

// ─── Attack Progression Bar ────────────────────────────────────────────────────
function AttackProgressionBar({ forecast, selectedStage, onStageClick }: {
  forecast: ForecastResult | null;
  selectedStage: string | null;
  onStageClick: (s: string | null) => void;
}) {
  const currentStage = forecast?.current_stage ?? '';
  const nextStage    = forecast?.predicted_next_stage ?? '';
  const stageProbabilities = forecast?.stage_probabilities ?? [];
  const isBenign = forecast?.is_benign ?? true;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Attack Progression</h3>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click a stage for details</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
        {ATTACK_STAGES.map((stage, i) => {
          const isCurrent   = stage === currentStage;
          const isPredicted = stage === nextStage && !isBenign;
          const isCompleted = !isBenign && ATTACK_STAGES.indexOf(stage as typeof ATTACK_STAGES[number]) < ATTACK_STAGES.indexOf(currentStage as typeof ATTACK_STAGES[number]);
          const prob = stageProbabilities.find(p => p.stage === stage);
          const colors = STAGE_COLORS[stage];
          const isSelected = selectedStage === stage;

          return (
            <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div
                onClick={() => onStageClick(isSelected ? null : stage)}
                style={{
                  flex: 1, padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                  border: `2px solid ${isCurrent ? colors.border : isPredicted ? colors.border + '80' : isCompleted ? colors.border + '50' : 'var(--border-subtle)'}`,
                  background: isCurrent ? colors.bg : isPredicted ? colors.bg + '40' : isSelected ? 'var(--bg-workspace)' : 'var(--bg-card)',
                  boxShadow: isCurrent ? `0 0 16px ${colors.glow}` : 'none',
                  transition: 'all 0.25s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Animated pulse ring for current stage */}
                {isCurrent && (
                  <div style={{ position: 'absolute', inset: -4, borderRadius: 14, border: `2px solid ${colors.border}30`, animation: 'pulse-glow 2s infinite', pointerEvents: 'none' }} />
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{stageIcon(stage)}</span>
                  <div style={{ textAlign: 'right' }}>
                    {isCurrent && <StatusPill text="CURRENT" color={colors.text} bg={colors.bg} />}
                    {isPredicted && !isCurrent && <StatusPill text="PREDICTED NEXT" color={colors.text} bg={colors.bg + '60'} />}
                    {isCompleted && <StatusPill text="OBSERVED" color="var(--color-live)" bg="var(--color-live-light)" />}
                  </div>
                </div>

                <div style={{ fontWeight: 700, fontSize: 13, color: isCurrent ? colors.text : isCompleted ? 'var(--text-secondary)' : 'var(--text-muted)', marginBottom: 6 }}>
                  {stage}
                </div>

                {/* Probability bar */}
                <div style={{ height: 4, background: 'var(--bg-input)', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{
                    height: '100%', borderRadius: 999,
                    width: `${((prob?.probability ?? 0) * 100).toFixed(1)}%`,
                    background: isBenign ? 'var(--border-default)' : isCurrent ? colors.border : colors.border + '80',
                    transition: 'width 1s ease',
                  }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: isCurrent ? colors.text : 'var(--text-muted)' }}>
                  {Math.round((prob?.probability ?? 0) * 100)}%
                </div>
              </div>

              {/* Arrow connector */}
              {i < ATTACK_STAGES.length - 1 && (
                <ChevronRight size={18} color={isCompleted || isCurrent ? 'var(--color-critical)' : 'var(--border-default)'} style={{ flexShrink: 0, margin: '0 4px' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Stage detail panel */}
      {selectedStage && <StageDetailPanel stage={selectedStage} forecast={forecast} />}
    </div>
  );
}

// ─── Stage Detail Panel ────────────────────────────────────────────────────────
function StageDetailPanel({ stage, forecast }: { stage: string; forecast: ForecastResult | null }) {
  const descriptions: Record<string, string> = {
    'Reconnaissance':   'The adversary is gathering information about the target network. Indicators: ICMP probes, port scanning, DNS enumeration.',
    'Initial Access':   'The adversary is attempting to establish a foothold. Indicators: brute-force login attempts, unusual authentication patterns, exploit traffic.',
    'Lateral Movement': 'The adversary is moving through the internal network. Indicators: internal SMB traffic, unusual host-to-host connections, privilege escalation.',
    'Data Exfiltration':'The adversary is transferring data out. Indicators: high outbound byte volume, unusual external connections, encrypted tunnel traffic.',
  };

  const colors = STAGE_COLORS[stage] ?? STAGE_COLORS['No Active Session'];
  const isCurrentStage = forecast?.current_stage === stage;
  const isPredicted = forecast?.predicted_next_stage === stage;

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{stageIcon(stage)}</span>
        <span style={{ fontWeight: 700, color: colors.text, fontSize: 14 }}>{stage}</span>
        {isCurrentStage && <StatusPill text="CURRENT OBSERVED STAGE" color={colors.text} bg={colors.bg} />}
        {isPredicted && !isCurrentStage && <StatusPill text="PREDICTED NEXT STAGE" color={colors.text} bg={colors.bg} />}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
        {descriptions[stage] ?? 'Stage details not available.'}
      </p>
    </div>
  );
}

// ─── Forecast Timeline ─────────────────────────────────────────────────────────
function ForecastTimeline({ forecast }: { forecast: ForecastResult | null }) {
  const seq = forecast?.state_sequence ?? [];
  const predictedNext = forecast?.predicted_next_stage;
  const isBenign = forecast?.is_benign ?? true;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>State Sequence</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <Legend color="var(--color-live)" label="Observed" />
          {!isBenign && <Legend color="var(--color-warning)" label="Predicted" />}
        </div>
      </div>

      {seq.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '24px 0' }}>
          {forecast ? 'Waiting for temporal windows…' : 'Start a live session to see the state sequence.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 280, overflowY: 'auto' }}>
          {seq.map((entry, i) => {
            const colors = STAGE_COLORS[entry.stage] ?? STAGE_COLORS['No Active Session'];
            const t = typeof entry.window_end === 'number'
              ? new Date(entry.window_end * 1000)
              : new Date(entry.window_end as string);
            const timeStr = t.toLocaleTimeString('en-US', { hour12: false });
            const isLast = i === seq.length - 1;

            return (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 8 }}>
                {/* Timeline line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: colors.border, border: `2px solid ${colors.border}`, marginTop: 2 }} />
                  {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--border-subtle)', minHeight: 20, marginTop: 2 }} />}
                </div>
                <div style={{ paddingBottom: isLast ? 0 : 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>{timeStr}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: colors.text }}>{entry.stage}</div>
                </div>
              </div>
            );
          })}
          {/* Predicted next entry */}
          {predictedNext && predictedNext !== 'N/A' && !isBenign && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-warning)', border: '2px solid var(--color-warning)', marginTop: 2, animation: 'pulse-dot 1.5s infinite' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>Next predicted</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-warning)' }}>{predictedNext}</span>
                  <StatusPill text="PREDICTED" color="var(--color-warning)" bg="var(--color-warning-light)" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Evidence Panel ────────────────────────────────────────────────────────────
function EvidencePanel({ forecast, isBenign }: { forecast: ForecastResult | null; isBenign: boolean }) {
  const features = forecast?.supporting_features ?? [];
  const contributions = forecast?.feature_contributions ?? [];

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Why was this predicted?</h3>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>Demo model evidence — simulated feature contributions</span>
      </div>

      {/* Supporting features */}
      {features.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            Supporting Evidence
          </div>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0', borderBottom: i < features.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <span style={{ color: isBenign ? 'var(--color-live)' : 'var(--color-critical)', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {isBenign ? '✓' : '↑'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{f}</span>
            </div>
          ))}
        </div>
      )}

      {/* Feature contributions */}
      {contributions.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            Simulated Feature Contribution
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 8 }}>
            ⚠ These are demo weights, not SHAP values.
          </div>
          {contributions.slice(0, 6).map((c, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{c.feature}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {Math.round(c.weight * 100)}%
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-input)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  width: `${(c.weight * 100).toFixed(1)}%`,
                  background: isBenign
                    ? 'linear-gradient(90deg, var(--color-live), #34d399)'
                    : 'linear-gradient(90deg, var(--color-warning), var(--color-critical))',
                  transition: 'width 1s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!forecast && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '24px 0' }}>
          Start a live session to see the model evidence.
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ─────────────────────────────────────────────────────────
function NoSessionBanner() {
  return (
    <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
      <Info size={18} color="var(--text-muted)" />
      <div>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>No active session</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          Go to <strong>Live Monitoring</strong> and start a demo session. Forecast data will update automatically.
        </div>
      </div>
    </div>
  );
}

function LiveBadge() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 999, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.1)', color: 'var(--color-live)' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-live)', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
      LIVE
    </span>
  );
}

function DemoBadge({ label, color, small }: { label: string; color: string; small?: boolean }) {
  return (
    <span style={{
      fontSize: small ? 9 : 10, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
      background: 'var(--bg-input)', color, border: '1px solid var(--border-default)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ background: 'var(--bg-workspace)', borderRadius: 8, padding: '6px 10px' }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: highlight ? 'var(--color-critical)' : 'var(--text-primary)', letterSpacing: '-0.3px' }}>{value}</div>
    </div>
  );
}

function InfoRow({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}:</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: highlight ? 'var(--color-critical)' : 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function StatusPill({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: bg, color, letterSpacing: '0.3px', border: `1px solid ${color}40` }}>
      {text}
    </span>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      {label}
    </div>
  );
}

// ─── Utility ───────────────────────────────────────────────────────────────────
function stageIcon(stage: string): string {
  const icons: Record<string, string> = {
    'Reconnaissance':    '🔍',
    'Initial Access':    '🚪',
    'Lateral Movement':  '↔️',
    'Data Exfiltration': '📤',
    'Normal Activity':   '✅',
    'No Active Session': '⏸️',
    'N/A':               '—',
  };
  return icons[stage] ?? '●';
}

// ─── Style helpers ─────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border-default)',
  boxShadow: 'var(--shadow-sm)',
  padding: 20,
};
