// NEXTRACE AI — Simulation Page (Step 7)
// Route: /simulation
// SIMULATOR ONLY — no real network traffic generated.
// Isolated from live, historical, forensic, and investigation state.

import { useEffect, useState } from 'react';
import {
  Play, Pause, SkipForward, Square, RotateCcw,
  Cpu, Activity, Target, TrendingUp, AlertTriangle, FileText,
  Search, Key, Eye, ArrowLeftRight, Radio, UploadCloud, Lock, Zap, Settings,
  CheckCircle2, Clock, Circle,
} from 'lucide-react';
import { ReactFlow, Background, Controls, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSimulatorStore, DEFAULT_CONFIG, K_MIN, K_MAX } from '@/store/simulatorStore';
import { useFindingsStore } from '@/store/findingsStore';
import { useNavigate } from 'react-router-dom';
import type { SimEvent, ForecastSnapshot, SyntheticFeatureProfile } from '@/types/simulator';

// ── Stage colours (separate from forecast STAGE_COLORS) ─────────────────────
const STAGE_META: Record<string, { color: string; bg: string; border: string; icon: (size?: number) => React.ReactNode }> = {
  'Reconnaissance':     { color: '#f59e0b', bg: '#fef3c7', border: '#f59e0b', icon: (s = 14) => <Search size={s} /> },
  'Initial Access':     { color: '#f97316', bg: '#ffedd5', border: '#f97316', icon: (s = 14) => <Key size={s} /> },
  'Internal Discovery': { color: '#8b5cf6', bg: '#ede9fe', border: '#8b5cf6', icon: (s = 14) => <Eye size={s} /> },
  'Lateral Movement':   { color: '#ef4444', bg: '#fee2e2', border: '#ef4444', icon: (s = 14) => <ArrowLeftRight size={s} /> },
  'Command & Control':  { color: '#06b6d4', bg: '#cffafe', border: '#06b6d4', icon: (s = 14) => <Radio size={s} /> },
  'Data Exfiltration':  { color: '#dc2626', bg: '#fecaca', border: '#dc2626', icon: (s = 14) => <UploadCloud size={s} /> },
  'Persistence':        { color: '#7c3aed', bg: '#ede9fe', border: '#7c3aed', icon: (s = 14) => <Lock size={s} /> },
  'Impact':             { color: '#b91c1c', bg: '#fee2e2', border: '#b91c1c', icon: (s = 14) => <Zap size={s} /> },
};
const STAGE_DEFAULT = { color: '#94a3b8', bg: '#f1f5f9', border: '#cbd5e1', icon: (s = 14) => <Settings size={s} /> };

function getStageMeta(name: string) {
  return STAGE_META[name] ?? STAGE_DEFAULT;
}

function fmtBytes(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}
function fmtSimTs(ts: number): string {
  return new Date(ts * 1000).toUTCString().replace(' GMT', ' (sim)');
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export function SimulationPage() {
  const {
    config, scenarios, setConfig, loadScenarios,
    simulationId, status, currentStep, totalSteps, stageSequence,
    currentStage, currentEvent, currentForecast, currentFeatures,
    allEvents, allForecasts, selectedStep, error,
    startSimulation, pauseSimulation, resumeSimulation,
    stopSimulation, resetSimulation, nextStep, selectStep, hardReset,
  } = useSimulatorStore();

  useEffect(() => { loadScenarios(); }, [loadScenarios]);

  const navigate = useNavigate();
  const { generateSimulationReport, loading: reportLoading } = useFindingsStore();
  const [reportError, setReportError] = useState<string | null>(null);

  async function handleGenerateReport() {
    if (!simulationId) return;
    setReportError(null);
    const reportId = await generateSimulationReport(simulationId);
    if (reportId) {
      navigate(`/reports/${reportId}`);
    } else {
      setReportError('Report generation failed. Ensure simulation is completed.');
    }
  }

  const isIdle      = status === 'idle';
  const isCompleted = status === 'completed';
  const isStopped   = status === 'stopped';
  const isTerminal  = isCompleted || isStopped;
  const isActive    = simulationId !== null;

  const selectedEvent    = selectedStep != null ? allEvents[selectedStep] : currentEvent;
  const selectedForecast = selectedStep != null ? allForecasts[selectedStep] : currentForecast;
  const selectedFeatures = selectedEvent?.synthetic_feature_profile ?? currentFeatures;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: 'calc(100vh - 60px)' }}>

      {/* ── Header ── */}
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: 0 }}>
                Attack Progression Simulator
              </h1>
              <SimOnlyBadge/>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Controlled synthetic attack progression for forecasting demonstration ·&nbsp;
              <strong style={{ color: 'var(--primary)' }}>K={config.k}</strong> stages · All events are in-memory only
            </p>
          </div>
          {simulationId && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, alignSelf: 'flex-start' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)', background: 'rgba(99,102,241,0.08)', padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.2)' }}>
                {simulationId}
              </div>
              {isCompleted && (
                <button
                  id="generate-sim-report-btn"
                  onClick={handleGenerateReport}
                  disabled={reportLoading}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 8,
                    background: reportLoading ? 'var(--bg-workspace)' : 'var(--primary)',
                    border: '1px solid var(--primary)', color: 'white',
                    cursor: reportLoading ? 'not-allowed' : 'pointer', opacity: reportLoading ? 0.7 : 1,
                  }}
                >
                  <FileText size={13} />
                  {reportLoading ? 'Generating…' : 'Generate Simulation Report'}
                </button>
              )}
              {reportError && (
                <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>{reportError}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Safety banner ── */}
      <div style={{ background: 'rgba(245,158,11,0.06)', border: '1.5px solid rgba(245,158,11,0.35)', borderRadius: 10, padding: '10px 16px', fontSize: 11, color: '#92400e', display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14, flexShrink: 0 }}>
        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }}/>
        <span>
          <strong>SIMULATION DATA — NOT REAL NETWORK TRAFFIC.</strong>{' '}
          All entities, events, and observations are synthetically generated in-memory.
          No packets are transmitted. No real hosts are contacted. No scanning, exploitation, or offensive action is performed.
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16, paddingBottom: 40 }}>

        {/* ── Layout grid: Config + Status (top) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isActive ? '320px 1fr' : '1fr', gap: 16, transition: 'all 0.3s' }}>

          {/* Config / Controls card */}
          <SimCard title="Configuration & Controls" icon={<Cpu size={15}/>}>
            {isIdle ? (
              <ConfigForm
                config={config}
                scenarios={scenarios}
                setConfig={setConfig}
                onStart={startSimulation}
              />
            ) : (
              <RunningControls
                status={status}
                currentStep={currentStep}
                totalSteps={totalSteps}
                simulationId={simulationId!}
                onPause={pauseSimulation}
                onResume={resumeSimulation}
                onNext={nextStep}
                onStop={stopSimulation}
                onReset={isTerminal ? hardReset : resetSimulation}
              />
            )}
          </SimCard>

          {/* Status / Stage Overview — only when active */}
          {isActive && (
            <SimCard
              title="Simulation Status"
              icon={<Activity size={15}/>}
              badge={<StatusPill status={status}/>}
            >
              <SimStatusPanel
                status={status}
                currentStep={currentStep}
                totalSteps={totalSteps}
                stageSequence={stageSequence}
                currentStage={currentStage}
                selectedStep={selectedStep}
                onSelectStep={selectStep}
              />
            </SimCard>
          )}
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#b91c1c' }}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* ── Forecast Panel (only when active) ── */}
        {isActive && selectedForecast && (
          <SimCard title="Simulator Forecast" icon={<TrendingUp size={15}/>} subtitle="Deterministic rule-based prediction — prototype only">
            <ForecastPanel forecast={selectedForecast}/>
          </SimCard>
        )}

        {/* ── Two-column: Temporal Features + Event Table ── */}
        {isActive && selectedEvent && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <SimCard title="Temporal Feature Vector" icon={<Activity size={15}/>} subtitle="Synthetic features for this simulation step">
              {selectedFeatures
                ? <FeatureVectorPanel features={selectedFeatures}/>
                : <EmptySlate text="No features yet"/>
              }
            </SimCard>
            <SimCard title="Synthetic Event Detail" icon={<Target size={15}/>} subtitle="SIMULATION DATA — NOT REAL NETWORK TRAFFIC">
              <EventDetailPanel event={selectedEvent}/>
            </SimCard>
          </div>
        )}

        {/* ── Events table ── */}
        {isActive && allEvents.length > 0 && (
          <SimCard title="Synthetic Activity Log" icon={<Activity size={15}/>} subtitle="SIMULATION DATA — no real packets generated">
            <EventTable events={allEvents} selectedStep={selectedStep} onSelect={selectStep}/>
          </SimCard>
        )}

        {/* ── Forecast Timeline ── */}
        {isActive && allForecasts.length > 0 && (
          <SimCard title="Forecast Timeline" icon={<TrendingUp size={15}/>} subtitle="Observed → Predicted per simulation step">
            <ForecastTimeline forecasts={allForecasts} selectedStep={selectedStep} onSelect={selectStep}/>
          </SimCard>
        )}

        {/* ── Network Graph ── */}
        {isActive && (
          <SimCard title="Synthetic Network Graph" icon={<Target size={15}/>} subtitle="Synthetic Network — Simulation Only · No real topology">
            <NetworkGraph currentStage={currentStage} currentEvent={selectedEvent}/>
          </SimCard>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG FORM
// ═══════════════════════════════════════════════════════════════════════════

function ConfigForm({
  config, scenarios, setConfig, onStart,
}: {
  config: typeof DEFAULT_CONFIG;
  scenarios: { id: string; description: string }[];
  setConfig: (p: Partial<typeof DEFAULT_CONFIG>) => void;
  onStart: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Scenario */}
      <FormField label="Scenario">
        <select
          value={config.scenario}
          onChange={e => setConfig({ scenario: e.target.value })}
          style={selectStyle}
        >
          <option value="controlled_attack_progression">Controlled Attack Progression</option>
          <option value="recon_to_exfiltration">Reconnaissance to Exfiltration</option>
          {scenarios.filter(s => s.id !== 'controlled_attack_progression' && s.id !== 'recon_to_exfiltration').map(s => (
            <option key={s.id} value={s.id}>{s.id}</option>
          ))}
        </select>
      </FormField>

      {/* K slider */}
      <FormField label={`Attack Stages  K = ${config.k}  (range: ${K_MIN}–${K_MAX})`}>
        <input
          type="range" min={K_MIN} max={K_MAX} step={1}
          value={config.k}
          onChange={e => setConfig({ k: Number(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--primary)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
          <span>{K_MIN}</span><span>{K_MAX}</span>
        </div>
        <KStagePreview k={config.k}/>
      </FormField>

      {/* Window / Speed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormField label="Window (s)">
          <select
            value={config.window_seconds}
            onChange={e => setConfig({ window_seconds: Number(e.target.value) })}
            style={selectStyle}
          >
            {[5, 10, 15, 30].map(v => <option key={v} value={v}>{v}s</option>)}
          </select>
        </FormField>
        <FormField label="Speed">
          <select
            value={config.speed}
            onChange={e => setConfig({ speed: Number(e.target.value) })}
            style={selectStyle}
          >
            {[0.5, 1.0, 2.0, 4.0].map(v => <option key={v} value={v}>{v}×</option>)}
          </select>
        </FormField>
      </div>

      <button
        id="start-simulation-btn"
        onClick={onStart}
        style={{
          width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          color: 'white', fontSize: 13, fontWeight: 800,
          boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        <Play size={14}/> Start Simulation (K={config.k})
      </button>

      <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        Synthetic simulation only · No real network activity
      </div>
    </div>
  );
}

// K stage preview (shows stage names for selected K)
function KStagePreview({ k }: { k: number }) {
  // Deterministic stage sequence mirroring backend _K_STAGE_MAP
  const allStages = [
    'Reconnaissance', 'Initial Access', 'Internal Discovery',
    'Lateral Movement', 'Command & Control', 'Data Exfiltration',
    'Persistence', 'Impact',
  ];
  const K_MAP: Record<number, number[]> = {
    3: [0, 1, 3],
    4: [0, 1, 2, 3],
    5: [0, 1, 2, 3, 5],
    6: [0, 1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6],
    8: [0, 1, 2, 3, 4, 5, 6, 7],
  };
  const stages = (K_MAP[k] ?? K_MAP[5]).map(i => allStages[i]);
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
      {stages.map((s, i) => {
        const m = getStageMeta(s);
        return (
          <span key={i} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: m.bg, color: m.color, border: `1px solid ${m.border}40`, whiteSpace: 'nowrap' }}>
            {i + 1}. {s}
          </span>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RUNNING CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

function RunningControls({
  status, currentStep, totalSteps, simulationId,
  onPause, onResume, onNext, onStop, onReset,
}: {
  status: string; currentStep: number; totalSteps: number; simulationId: string;
  onPause: () => void; onResume: () => void; onNext: () => void;
  onStop: () => void; onReset: () => void;
}) {
  const isCompleted = status === 'completed';
  const isStopped   = status === 'stopped';
  const isPaused    = status === 'paused';
  const isRunning   = status === 'running';
  const isTerminal  = isCompleted || isStopped;

  // Progress bar
  const pct = totalSteps > 0 ? Math.round(((currentStep + 1) / totalSteps) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
          <span style={{ color: 'var(--text-muted)' }}>Step {currentStep + 1} of {totalSteps}</span>
          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{pct}%</span>
        </div>
        <div style={{ background: 'var(--border-subtle)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: isCompleted ? '#059669' : 'linear-gradient(90deg, var(--primary), var(--secondary))', transition: 'width 0.4s ease' }}/>
        </div>
      </div>

      {/* Status display */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <StatusPill status={status as any}/>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          {simulationId}
        </div>
      </div>

      {/* Control buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {isRunning && (
          <CtrlBtn onClick={onPause} icon={<Pause size={13}/>} label="Pause" color="var(--color-warning)"/>
        )}
        {isPaused && (
          <CtrlBtn onClick={onResume} icon={<Play size={13}/>} label="Resume" color="#059669"/>
        )}
        {!isTerminal && (
          <CtrlBtn
            onClick={onNext}
            icon={<SkipForward size={13}/>}
            label="Next Step"
            color="var(--primary)"
            disabled={currentStep + 1 >= totalSteps}
          />
        )}
        {!isTerminal && (
          <CtrlBtn onClick={onStop} icon={<Square size={13}/>} label="Stop" color="var(--color-critical)"/>
        )}
        <CtrlBtn onClick={onReset} icon={<RotateCcw size={13}/>} label={isTerminal ? 'New Simulation' : 'Reset'} color="var(--text-muted)"/>
      </div>

      {isCompleted && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#065f46', textAlign: 'center', fontWeight: 600 }}>
          <CheckCircle2 size={13} /> Simulation completed — {totalSteps} stages
        </div>
      )}
      {isStopped && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#b91c1c', textAlign: 'center', fontWeight: 600 }}>
          <Square size={13} /> Simulation stopped at step {currentStep + 1}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS PANEL (stage progression bar)
// ═══════════════════════════════════════════════════════════════════════════

function SimStatusPanel({
  status, currentStep, totalSteps, stageSequence, currentStage, selectedStep, onSelectStep,
}: {
  status: string; currentStep: number; totalSteps: number;
  stageSequence: string[]; currentStage: string | null;
  selectedStep: number | null;
  onSelectStep: (s: number | null) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Horizontal stage progression */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
        {stageSequence.map((stage, i) => {
          const isDone    = i < currentStep;
          const isCurrent = i === currentStep;
          const isNext    = i === currentStep + 1;
          const isSelected = selectedStep === i;
          const m = getStageMeta(stage);

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <button
                onClick={() => onSelectStep(isSelected ? null : i)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: isSelected ? m.bg
                    : isDone ? '#f0fdf4'
                    : isCurrent ? m.bg
                    : 'var(--bg-workspace)',
                  outline: isSelected ? `2px solid ${m.color}` : isCurrent ? `2px solid ${m.border}` : '2px solid transparent',
                  transition: 'all 0.15s', minWidth: 80,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 20 }}>
                  {isDone ? (
                    <CheckCircle2 size={16} color="#059669" />
                  ) : isCurrent ? (
                    <span style={{ color: m.color }}>{m.icon(16)}</span>
                  ) : isNext ? (
                    <Clock size={16} color="#d97706" />
                  ) : (
                    <Circle size={10} color="var(--border-default)" />
                  )}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: isDone ? '#059669' : isCurrent ? m.color : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>
                  {i + 1}. {stage}
                </div>
                {isNext && status === 'running' && (
                  <div style={{ fontSize: 9, color: '#d97706', fontWeight: 700 }}>Predicted</div>
                )}
              </button>
              {i < stageSequence.length - 1 && (
                <div style={{ width: 20, height: 2, background: i < currentStep ? '#059669' : 'var(--border-subtle)', flexShrink: 0, transition: 'background 0.3s' }}/>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
        <span>Progress: <strong>Step {currentStep} of {totalSteps}</strong>{currentStage ? ` (${currentStage})` : ''}</span>
        <span>Click a stage to inspect its event and forecast details</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FORECAST PANEL
// ═══════════════════════════════════════════════════════════════════════════

function ForecastPanel({ forecast }: { forecast: ForecastSnapshot }) {
  const curMeta  = getStageMeta(forecast.current_stage);
  const nextMeta = getStageMeta(forecast.predicted_next_stage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Current → Predicted */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
        <div style={{ background: curMeta.bg, border: `1.5px solid ${curMeta.border}`, borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
            Step {forecast.step + 1} · Current Stage
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 28, color: curMeta.color }}>
            {curMeta.icon(22)}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: curMeta.color, marginTop: 4 }}>
            {forecast.current_stage}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 18, color: 'var(--text-muted)' }}>→</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: forecast.confidence >= 75 ? '#059669' : '#d97706' }}>
              {forecast.confidence}%
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>confidence</div>
          </div>
        </div>

        <div style={{ background: nextMeta.bg, border: `1.5px dashed ${nextMeta.border}`, borderRadius: 12, padding: '12px 14px', textAlign: 'center', opacity: forecast.predicted_next_stage === 'Simulation Complete' ? 0.6 : 1 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
            Predicted Next
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 28, color: nextMeta.color }}>
            {nextMeta.icon(22)}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: nextMeta.color, marginTop: 4 }}>
            {forecast.predicted_next_stage}
          </div>
        </div>
      </div>

      {/* Supporting features */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--bg-workspace)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Supporting Features</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {forecast.supporting_features.map((f, i) => (
              <li key={i} style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'flex-start', lineHeight: 1.4 }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 5 }}/>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ background: 'var(--bg-workspace)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Prediction Window</div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--primary)', marginBottom: 6 }}>{forecast.time_window}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            Target: <strong>{forecast.target_entity}</strong>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
            Prototype deterministic rule-based forecasting · Not a trained ML model
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPORAL FEATURE VECTOR
// ═══════════════════════════════════════════════════════════════════════════

function FeatureVectorPanel({ features }: { features: SyntheticFeatureProfile }) {
  const rows: [string, string | number, string?][] = [
    ['Packets',          features.packet_count.toLocaleString()],
    ['Bytes',            fmtBytes(features.byte_count)],
    ['Flows',            features.flow_count.toLocaleString()],
    ['Unique Src IPs',   features.unique_src_ips.toLocaleString()],
    ['Unique Dst IPs',   features.unique_dst_ips.toLocaleString()],
    ['Unique Dst Ports', features.unique_dst_ports.toLocaleString()],
    ['TCP',              features.tcp_count.toLocaleString()],
    ['UDP',              features.udp_count.toLocaleString()],
    ['ICMP',             features.icmp_count.toLocaleString()],
    ['Mean Pkt Size',    `${features.mean_packet_size.toFixed(0)} B`],
    ['Connection Rate',  `${features.connection_rate.toFixed(1)} pkt/s`],
    ['Suspicious Ratio', `${(features.suspicious_ratio * 100).toFixed(0)}%`],
    ['Window',           `${features.window_index}  (T+${features.window_start - 1_700_000_000}s)`],
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {rows.map(([label, value]) => {
        const isHigh = label === 'Suspicious Ratio' && features.suspicious_ratio > 0.3;
        return (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: isHigh ? 'var(--color-critical)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT DETAIL
// ═══════════════════════════════════════════════════════════════════════════

function EventDetailPanel({ event }: { event: SimEvent }) {
  const m = getStageMeta(event.stage);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: m.bg, border: `1px solid ${m.border}40`, borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: m.color, display: 'inline-flex' }}>{m.icon(20)}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: m.color }}>Step {event.step + 1}: {event.stage}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtSimTs(event.timestamp)}</div>
        </div>
      </div>

      {/* Flow */}
      <div style={{ background: 'var(--bg-workspace)', borderRadius: 10, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <IPTag label={event.source_label} ip={event.source}/>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>:{event.source_port}</span>
          <span style={{ fontSize: 14, color: 'var(--primary)' }}>→</span>
          <IPTag label={event.destination_label} ip={event.destination}/>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>:{event.destination_port}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', color: 'var(--primary)' }}>{event.protocol}</span>
        </div>
      </div>

      {/* Stats */}
      {[
        ['Packets',     event.packet_count.toLocaleString()],
        ['Bytes',       fmtBytes(event.byte_count)],
        ['Connections', event.connection_count.toLocaleString()],
      ].map(([l, v]) => (
        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{v}</span>
        </div>
      ))}

      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
        {event.disclaimer}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT TABLE
// ═══════════════════════════════════════════════════════════════════════════

function EventTable({ events, selectedStep, onSelect }: {
  events: SimEvent[]; selectedStep: number | null; onSelect: (s: number | null) => void;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {['Step', 'Stage', 'Source', 'Destination', 'Protocol', 'Connections', 'Bytes'].map(h => (
              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => {
            const isSelected = selectedStep === ev.step;
            const m = getStageMeta(ev.stage);
            return (
              <tr
                key={ev.step}
                onClick={() => onSelect(isSelected ? null : ev.step)}
                style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', background: isSelected ? 'rgba(99,102,241,0.06)' : 'transparent', transition: 'background 0.1s' }}
              >
                <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{ev.step + 1}</td>
                <td style={{ padding: '7px 10px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: m.bg, color: m.color, whiteSpace: 'nowrap' }}>
                    {m.icon(11)} {ev.stage}
                  </span>
                </td>
                <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {ev.source_label}<br/><span style={{ color: 'var(--text-muted)' }}>{ev.source}:{ev.source_port}</span>
                </td>
                <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {ev.destination_label}<br/><span style={{ color: 'var(--text-muted)' }}>{ev.destination}:{ev.destination_port}</span>
                </td>
                <td style={{ padding: '7px 10px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.08)', color: 'var(--primary)' }}>{ev.protocol}</span>
                </td>
                <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{ev.connection_count}</td>
                <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{fmtBytes(ev.byte_count)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '8px 10px', fontStyle: 'italic' }}>
        Synthetic events — no real network traffic generated · Click a row to inspect details
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FORECAST TIMELINE
// ═══════════════════════════════════════════════════════════════════════════

function ForecastTimeline({ forecasts, selectedStep, onSelect }: {
  forecasts: ForecastSnapshot[]; selectedStep: number | null; onSelect: (s: number | null) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {forecasts.map((fc) => {
        const curMeta  = getStageMeta(fc.current_stage);
        const nextMeta = getStageMeta(fc.predicted_next_stage);
        const isSelected = selectedStep === fc.step;
        return (
          <button
            key={fc.step}
            onClick={() => onSelect(isSelected ? null : fc.step)}
            style={{
              display: 'grid', gridTemplateColumns: '32px 1fr auto 1fr auto',
              gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10,
              background: isSelected ? 'rgba(99,102,241,0.06)' : 'var(--bg-workspace)',
              border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
              cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
              {fc.step + 1}
            </div>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: curMeta.bg, color: curMeta.color }}>
                {curMeta.icon(11)} {fc.current_stage}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{fc.time_window}</div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→</span>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: nextMeta.bg, color: nextMeta.color, opacity: fc.predicted_next_stage === 'Simulation Complete' ? 0.6 : 1 }}>
                {nextMeta.icon(11)} {fc.predicted_next_stage}
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 900, color: fc.confidence >= 75 ? '#059669' : '#d97706', textAlign: 'right' }}>
              {fc.confidence}%
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NETWORK GRAPH (React Flow)
// ═══════════════════════════════════════════════════════════════════════════

const ENTITY_POSITIONS: Record<string, { x: number; y: number }> = {
  'Simulated External': { x: 50,  y: 50 },
  'Workstation':        { x: 280, y: 50 },
  'Internal Server':    { x: 280, y: 190 },
  'Database':           { x: 500, y: 190 },
};

function NetworkGraph({ currentStage, currentEvent }: {
  currentStage: string | null; currentEvent: SimEvent | null;
}) {
  const nodes: Node[] = [
    { id: 'ext',  position: ENTITY_POSITIONS['Simulated External'], data: { label: 'Simulated External\n198.51.100.20', type: 'external', active: currentEvent?.source_label === 'Simulated External' || currentEvent?.destination_label === 'Simulated External' }, type: 'default' },
    { id: 'ws',   position: ENTITY_POSITIONS['Workstation'],        data: { label: 'Workstation\n10.10.1.10', type: 'internal', active: currentEvent?.source_label === 'Workstation' || currentEvent?.destination_label === 'Workstation' }, type: 'default' },
    { id: 'srv',  position: ENTITY_POSITIONS['Internal Server'],     data: { label: 'Internal Server\n10.10.2.20', type: 'internal', active: currentEvent?.source_label === 'Internal Server' || currentEvent?.destination_label === 'Internal Server' }, type: 'default' },
    { id: 'db',   position: ENTITY_POSITIONS['Database'],            data: { label: 'Database\n10.10.3.30', type: 'internal', active: currentEvent?.source_label === 'Database' || currentEvent?.destination_label === 'Database' }, type: 'default' },
  ].map(n => ({
    ...n,
    style: {
      background: (n.data as any).active ? (n.data as any).type === 'external' ? '#fee2e2' : '#ede9fe' : 'var(--bg-card)',
      border: `1.5px solid ${(n.data as any).active ? ((n.data as any).type === 'external' ? '#ef4444' : '#6366f1') : 'var(--border-default)'}`,
      borderRadius: 10, padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
      whiteSpace: 'pre-line', textAlign: 'center' as const,
      boxShadow: (n.data as any).active ? `0 0 12px ${(n.data as any).type === 'external' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}` : 'none',
      transition: 'all 0.3s',
    },
  }));

  // Edges based on current event
  const edges: Edge[] = [];
  if (currentEvent) {
    const LABEL_TO_ID: Record<string, string> = {
      'Simulated External': 'ext',
      'Workstation': 'ws',
      'Internal Server': 'srv',
      'Database': 'db',
    };
    const srcId = LABEL_TO_ID[currentEvent.source_label];
    const dstId = LABEL_TO_ID[currentEvent.destination_label];
    if (srcId && dstId) {
      edges.push({
        id: `e-${srcId}-${dstId}`,
        source: srcId,
        target: dstId,
        animated: true,
        label: `${currentEvent.protocol} · ${currentEvent.connection_count} conn`,
        style: { stroke: '#6366f1', strokeWidth: 2 },
        labelStyle: { fontSize: 9, fill: 'var(--text-muted)' },
      });
    }
  } else {
    // Show baseline topology
    edges.push(
      { id: 'e-ext-srv', source: 'ext', target: 'srv', label: 'internet', style: { stroke: 'var(--border-default)' } },
      { id: 'e-srv-db',  source: 'srv', target: 'db',  label: 'internal', style: { stroke: 'var(--border-default)' } },
      { id: 'e-srv-ws',  source: 'srv', target: 'ws',  label: 'internal', style: { stroke: 'var(--border-default)' } },
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: 'rgba(245,158,11,0.1)', color: '#92400e', border: '1px solid rgba(245,158,11,0.4)', display: 'flex', alignItems: 'center', gap: 5 }}>
        <AlertTriangle size={11} /> SYNTHETIC NETWORK — SIMULATION ONLY{currentStage ? ` · Active: ${currentStage}` : ''}
      </div>
      <div style={{ height: 320, borderRadius: 12, overflow: 'hidden', background: 'var(--bg-workspace)', border: '1px solid var(--border-subtle)' }}>
        <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable panOnDrag zoomOnScroll={false}>
          <Background color="var(--border-subtle)" gap={20}/>
          <Controls/>
        </ReactFlow>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED UTILITY COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function SimCard({
  title, icon, subtitle, badge, children,
}: {
  title: string; icon: React.ReactNode; subtitle?: string;
  badge?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--primary)' }}>{icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
          </div>
          {subtitle && <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 22, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {badge}
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, [string, string]> = {
    running:   ['#059669', '#d1fae5'],
    paused:    ['#d97706', '#fef3c7'],
    completed: ['#059669', '#d1fae5'],
    stopped:   ['#dc2626', '#fee2e2'],
    idle:      ['#94a3b8', '#f1f5f9'],
  };
  const [c, bg] = styles[status] ?? styles['idle'];
  const icons: Record<string, React.ReactNode> = {
    running:   <Play size={10} style={{ display: 'inline', marginRight: 4 }} />,
    paused:    <Pause size={10} style={{ display: 'inline', marginRight: 4 }} />,
    completed: <CheckCircle2 size={10} style={{ display: 'inline', marginRight: 4 }} />,
    stopped:   <Square size={10} style={{ display: 'inline', marginRight: 4 }} />,
    idle:      <Circle size={8} style={{ display: 'inline', marginRight: 4 }} />,
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: bg, color: c, border: `1px solid ${c}40`, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
      {icons[status] ?? null} {status}
    </span>
  );
}

function SimOnlyBadge() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, padding: '4px 12px', borderRadius: 999, background: 'rgba(245,158,11,0.1)', color: '#92400e', border: '1.5px solid rgba(245,158,11,0.5)', letterSpacing: '0.5px' }}>
      <AlertTriangle size={12} /> SIMULATION ONLY
    </div>
  );
}

function CtrlBtn({
  onClick, icon, label, color, disabled = false,
}: {
  onClick: () => void; icon: React.ReactNode; label: string; color: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        padding: '8px 0', borderRadius: 8, border: `1px solid ${color}40`,
        background: `${color}10`, color, fontSize: 12, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
    >
      {icon} {label}
    </button>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function IPTag({ label, ip }: { label: string; ip: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</span>
      <code style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--primary)', background: 'rgba(99,102,241,0.08)', padding: '1px 6px', borderRadius: 4 }}>{ip}</code>
    </div>
  );
}

function EmptySlate({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 12 }}>
      {text}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  border: '1px solid var(--border-default)', background: 'var(--bg-workspace)',
  color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
};
