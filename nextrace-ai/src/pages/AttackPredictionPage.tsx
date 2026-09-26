import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Target, Clock, Shield, FileText, Radio,
  ChevronRight, AlertTriangle, Search, Key, ArrowLeftRight, UploadCloud, CheckCircle2, Pause, TrendingUp,
} from 'lucide-react';
import { useForecastStore } from '@/store/forecastStore';
import { useLiveStore } from '@/store/liveStore';
import { useAlertStore } from '@/store/alertStore';
import { useFindingsStore } from '@/store/findingsStore';
import { apiService } from '@/services/api';
import type { ForecastResult } from '@/types/forecast';
import { ATTACK_STAGES, STAGE_COLORS } from '@/types/forecast';
import { significantActivities } from '@/lib/activityGrouping';
import { buildLiveSessionReport } from '@/lib/reportBuilder';
import { ActivityList } from '@/components/activity/ActivityList';
import { ActivityInspector } from '@/components/activity/ActivityInspector';

// ─────────────────────────────────────────────────────────────────────────────
export function AttackPredictionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentForecast, selectedStage, setSelectedStage, setForecast, setLoading } = useForecastStore();
  const { session, runId, activities, currentTemporal, trafficSummary, windowSeconds, runStartedAt } = useLiveStore();
  const { alerts } = useAlertStore();
  const { saveLocalReport } = useFindingsStore();
  const isLive = session?.running ?? false;
  const grouped = useMemo(() => significantActivities(activities), [activities]);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const inspected = inspectId ? grouped.find(a => a.id === inspectId) ?? null : null;
  const requestedSession = searchParams.get('session');

  function handleGenerateReport() {
    const report = buildLiveSessionReport({
      runId, runStartedAt, session, windowSeconds, activities, alerts,
      forecast: currentForecast, temporal: currentTemporal, traffic: trafficSummary,
    });
    navigate(`/reports/${saveLocalReport(report)}`);
  }

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
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
          <DemoBadge label={forecast?.demo_label ?? 'Deterministic demo prediction — not a trained ML model'} color="var(--text-muted)" small />
          <button
            id="generate-live-report-btn"
            onClick={handleGenerateReport}
            disabled={!runId}
            title={runId ? 'Build a report from the current session state' : 'Start a live session first'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
              padding: '8px 16px', borderRadius: 8, border: 'none', color: 'white',
              background: 'var(--primary)', cursor: runId ? 'pointer' : 'not-allowed', opacity: runId ? 1 : 0.5,
            }}
          >
            <FileText size={13} /> Generate Report
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 16, paddingBottom: 40 }}>
      {/* ── Main content area ── */}
      {!isLive && !forecast ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text-muted)', paddingTop: '10vh' }}>
          <AlertTriangle size={64} color="var(--color-warning)" style={{ opacity: 0.8 }} />
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Live Network Required</h2>
          <p style={{ textAlign: 'center', maxWidth: 450, lineHeight: 1.6, fontSize: 14 }}>
            To view attack predictions, please start the live monitoring network first. The prediction engine requires real-time traffic features to forecast the next stage of an attack.
          </p>
          <button
            onClick={() => navigate('/live-monitoring')}
            style={{ marginTop: 12, padding: '10px 20px', borderRadius: 8, background: 'var(--primary)', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            Go to Live Monitoring
          </button>
        </div>
      ) : (
        <>
          {/* ── Session context: the same observed state that drives the dashboard, alerts and reports ── */}
          <div style={{ ...cardStyle, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Radio size={15} color={isLive ? 'var(--color-live)' : 'var(--text-muted)'} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1, minWidth: 240 }}>
              Prediction based on the latest observed network state of session{' '}
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{runId ?? session?.session_id ?? '—'}</strong>
              {isLive ? '' : ' (stopped)'} · {trafficSummary.total.toLocaleString()} packets observed ·{' '}
              {grouped.length} grouped activit{grouped.length === 1 ? 'y' : 'ies'}
              {requestedSession && runId && requestedSession !== runId && (
                <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}> · note: opened for {requestedSession}, a newer session is now active</span>
              )}
            </span>
          </div>

          {/* ── Attack Path Forecaster Forward Simulation Callout ── */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.06))',
            border: '1.5px solid rgba(99,102,241,0.25)',
            borderRadius: 12,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <Target size={18} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Simulate Forward Paths on Whole Enterprise Topology
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Current observed state predicting <strong>{forecast?.predicted_next_stage || 'Next Stage'}</strong>. Project K steps forward across the entire network topology in real-time.
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/simulation')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 800,
                padding: '8px 16px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(99,102,241,0.3)',
              }}
            >
              Open Attack Path Forecaster Simulator →
            </button>
          </div>

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

          {/* ── Observed activities feeding the forecast ── */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Observed Activities</h3>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Grouped suspicious activity from the same session — click for deep inspection
              </div>
            </div>
            <ActivityList
              activities={grouped}
              live
              onSelect={a => setInspectId(a.id)}
              maxHeight={260}
              emptyText="No suspicious activity observed in this session."
            />
          </div>
        </>
      )}
      </div>

      {inspected && (
        <ActivityInspector
          activity={inspected}
          allActivities={grouped}
          live
          onSelect={a => setInspectId(a.id)}
          onInvestigate={ip => navigate(`/investigation?ip=${encodeURIComponent(ip)}&source=forecast`)}
          onClose={() => setInspectId(null)}
        />
      )}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--bg-workspace)', borderRadius: 8, padding: '6px 10px' }}>
        <AlertTriangle size={11} style={{ flexShrink: 0 }} />
        <span>{forecast?.demo_label ?? 'Deterministic demo prediction'}</span>
      </div>

      {/* Investigate target button */}
      {!isBenign && forecast?.target && forecast.target !== 'None detected' && forecast.target !== 'N/A' && (
        <InvestigateTargetBtn target={forecast.target} />
      )}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {seq.map((entry, i) => {
            const colors = STAGE_COLORS[entry.stage] ?? STAGE_COLORS['No Active Session'];
            let t: Date;
            const raw = entry.window_end;
            if (typeof raw === 'number') {
              t = new Date(raw < 1e11 ? raw * 1000 : raw);
            } else {
              const d = new Date(raw as string);
              if (!isNaN(d.getTime())) {
                t = d;
              } else {
                const num = Number(raw);
                t = new Date(isNaN(num) ? Date.now() : (num < 1e11 ? num * 1000 : num));
              }
            }
            const timeStr = isNaN(t.getTime()) ? '--:--:--' : t.toLocaleTimeString('en-US', { hour12: false });
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
              <span style={{ color: isBenign ? 'var(--color-live)' : 'var(--color-critical)', display: 'inline-flex', marginTop: 2, flexShrink: 0 }}>
                {isBenign ? <CheckCircle2 size={13} /> : <TrendingUp size={13} />}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 8 }}>
            <AlertTriangle size={11} style={{ flexShrink: 0 }} />
            <span>These are demo weights, not SHAP values.</span>
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
function stageIcon(stage: string, size = 14): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    'Reconnaissance':    <Search size={size} />,
    'Initial Access':    <Key size={size} />,
    'Lateral Movement':  <ArrowLeftRight size={size} />,
    'Data Exfiltration': <UploadCloud size={size} />,
    'Normal Activity':   <CheckCircle2 size={size} />,
    'No Active Session': <Pause size={size} />,
  };
  return icons[stage] ?? null;
}

// ─── Style helpers ─────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border-default)',
  boxShadow: 'var(--shadow-sm)',
  padding: 20,
};

// ─── Investigate Target Button ─────────────────────────────────────────────────
function InvestigateTargetBtn({ target }: { target: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/investigation?ip=${encodeURIComponent(target)}&source=forecast`)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 7, padding: '9px 14px', borderRadius: 10, cursor: 'pointer',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        border: 'none', color: 'white', fontSize: 12, fontWeight: 700,
        boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(99,102,241,0.5)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(99,102,241,0.3)'; }}
    >
      <Search size={14} />
      Investigate Predicted Target: {target}
    </button>
  );
}
