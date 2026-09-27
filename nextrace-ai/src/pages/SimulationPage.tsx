// NEXTRACE AI — Attack Path Forecaster Simulator (FORECAST SIMULATION)
import { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Cpu,
  Target,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Layers,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useSimplifiedSimulatorStore, TopologyNode } from '@/store/simplifiedSimulatorStore';
import { SimplifiedWholeNetworkGraph } from '@/components/simulation/SimplifiedWholeNetworkGraph';
import { StepForecaster } from '@/components/simulation/StepForecaster';
import { MitreMappingView } from '@/components/simulation/MitreMappingView';

export function SimulationPage() {
  const {
    k,
    setK,
    status,
    currentStep,
    attackChain,
    start,
    reset,
    nextStep,
    prevStep,
    toggleAutoPlay,
    isPlaying,
    snapshotNodes,
    snapshotTime,
    candidateEdges,
    compromisedNodes,
    captureSnapshot,
  } = useSimplifiedSimulatorStore();

  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [activeTab, setActiveTab] = useState<'topology' | 'step-forecaster' | 'mitre'>('topology');

  // Immediately ensure topology is initialized on mount
  useEffect(() => {
    if (snapshotNodes.length === 0) {
      captureSnapshot();
    }
  }, [snapshotNodes.length, captureSnapshot]);

  const isIdle = status === 'idle';
  const isCompleted = status === 'completed' || currentStep >= k;
  const bestCandidate = candidateEdges.length > 0 ? candidateEdges[0] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 10 }}>
      {/* ── Page Header ── */}
      <div style={{ paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Attack Path Forecaster Simulator
              </h1>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', border: '1px solid rgba(99,102,241,0.25)', textTransform: 'uppercase' }}>
                FORECAST SIMULATION
              </span>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.25)', textTransform: 'uppercase' }}>
                SIMULATION ONLY
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Deterministic multi-stage attack path forecasting on enterprise topology · Project <strong style={{ color: 'var(--primary)' }}>K={k} steps forward</strong>
            </p>
          </div>

          {/* Tab Navigation Controls */}
          <div style={{ display: 'flex', gap: 8, background: 'var(--bg-workspace)', padding: 4, borderRadius: 10, border: '1px solid var(--border-default)' }}>
            <TabBtn
              active={activeTab === 'topology'}
              onClick={() => setActiveTab('topology')}
              icon={<Target size={14} />}
              label="Network Topology"
            />
            <TabBtn
              active={activeTab === 'step-forecaster'}
              onClick={() => setActiveTab('step-forecaster')}
              icon={<TrendingUp size={14} />}
              label={`Step Forecaster (${k} Steps)`}
              badge={k.toString()}
            />
            <TabBtn
              active={activeTab === 'mitre'}
              onClick={() => setActiveTab('mitre')}
              icon={<Layers size={14} />}
              label="MITRE ATT&CK Mapping"
              badge="v14"
            />
          </div>
        </div>
      </div>

      {snapshotTime && (
        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', color: '#047857', padding: '9px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={16} /> Enterprise Topology Loaded · Captured Snapshot at {snapshotTime}
          </div>
          <span style={{ fontSize: 11, color: '#065f46', background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: 6 }}>
            {snapshotNodes.length} Assets · {candidateEdges.length} Active Forecast Vectors
          </span>
        </div>
      )}

      {/* ── Main Layout: Controls (Left) & Active Tab Content (Right) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '330px 1fr', gap: 16 }}>
        {/* Left Column: Configuration & Step Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Cpu size={16} color="var(--primary)" />
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Configuration & Controls</h2>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)' }}>
                {isIdle ? 'IDLE' : isCompleted ? 'COMPLETED' : 'SIMULATING'}
              </span>
            </div>

            {/* K Horizon Slider */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                <span>Forecast Horizon (K Steps)</span>
                <span style={{ fontWeight: 800, color: 'var(--primary)' }}>K = {k}</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={k}
                onChange={e => setK(Number(e.target.value))}
                disabled={!isIdle}
                style={{ width: '100%', accentColor: 'var(--primary)', opacity: isIdle ? 1 : 0.6, cursor: isIdle ? 'pointer' : 'not-allowed' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>1 Step</span>
                <span>4 Steps</span>
                <span>8 Steps</span>
              </div>
            </div>

            {/* Stepper Progress Bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Progress: Step {currentStep} of {k}</span>
                <span style={{ color: isCompleted ? '#10b981' : 'var(--primary)' }}>
                  {Math.round((currentStep / k) * 100)}%
                </span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'var(--bg-input)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  width: `${(currentStep / k) * 100}%`,
                  height: '100%',
                  background: isCompleted ? '#10b981' : 'linear-gradient(90deg, var(--primary), #8b5cf6)',
                  borderRadius: 999,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {/* Control Buttons */}
            {isIdle ? (
              <button
                onClick={start}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 8, border: '1px solid var(--border-default)', cursor: 'pointer',
                  background: 'var(--primary)',
                  color: 'white', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <Play size={14} /> Start Simulation (K={k})
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Stepper Forward / Backward / Play */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <CtrlBtn
                    onClick={prevStep}
                    icon={<SkipBack size={13} />}
                    label="Previous"
                    color="var(--text-secondary)"
                    disabled={currentStep === 0}
                  />
                  <CtrlBtn
                    onClick={nextStep}
                    icon={<SkipForward size={13} />}
                    label="Next Step"
                    color="#10b981"
                    disabled={isCompleted}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
                  <button
                    onClick={toggleAutoPlay}
                    style={{
                      padding: '8px 0', borderRadius: 6, border: '1px solid var(--border-default)',
                      background: isPlaying ? 'rgba(239,68,68,0.1)' : 'var(--bg-workspace)',
                      color: isPlaying ? '#ef4444' : 'var(--text-primary)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                    {isPlaying ? 'Pause Auto' : 'Auto Play'}
                  </button>

                  <button
                    onClick={reset}
                    style={{
                      padding: '8px 0', borderRadius: 6, border: '1px solid var(--border-default)',
                      background: 'var(--bg-workspace)', color: 'var(--text-muted)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <RotateCcw size={13} /> Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Active / Next Forecast Panel */}
          <div style={cardStyle}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#d97706', marginBottom: 10, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={13} /> Simulator Forecast · Future / Predicted
            </div>

            {isCompleted ? (
              <div style={{ padding: 14, textAlign: 'center', color: '#047857', fontWeight: 700, fontSize: 13, background: 'rgba(16,185,129,0.08)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)' }}>
                <CheckCircle2 size={24} style={{ margin: '0 auto 6px', color: '#10b981' }} />
                Simulation Completed
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 400 }}>
                  Reached maximum forecast horizon (K={k} steps)
                </div>
              </div>
            ) : bestCandidate ? (
              (() => {
                const sourceNode = snapshotNodes.find(n => n.id === bestCandidate.source);
                const targetNode = snapshotNodes.find(n => n.id === bestCandidate.target);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                    <div style={{ background: 'var(--bg-workspace)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Predicted Next Target</div>
                      <div style={{ fontWeight: 800, fontSize: 13, marginTop: 2 }}>
                        {sourceNode?.name} → <span style={{ color: '#d97706' }}>{targetNode?.name}</span>
                      </div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 2 }}>
                        {targetNode?.ip} ({targetNode?.role})
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ background: 'var(--bg-workspace)', padding: '8px 10px', borderRadius: 6 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Confidence</div>
                        <div style={{ fontWeight: 800, color: '#059669', fontSize: 14 }}>{bestCandidate.confidence}%</div>
                      </div>
                      <div style={{ background: 'var(--bg-workspace)', padding: '8px 10px', borderRadius: 6 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Risk Score</div>
                        <div style={{ fontWeight: 800, color: '#ef4444', fontSize: 14 }}>{bestCandidate.priority} / 100</div>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>MITRE Technique</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{bestCandidate.technique}</div>
                      <div style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}>Tactic: {bestCandidate.tactic}</div>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'rgba(245,158,11,0.06)', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.2)' }}>
                      <strong>Threat Vector:</strong> {bestCandidate.reason}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, background: 'var(--bg-workspace)', borderRadius: 6 }}>
                All target paths mapped in current scope
              </div>
            )}
          </div>

          {/* Confirmed Attack Chain */}
          {attackChain.length > 0 && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Target size={16} color="#ef4444" />
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Confirmed Attack Chain</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {attackChain.map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-workspace)' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                      {step.step}
                    </div>
                    <div style={{ fontSize: 11, lineHeight: 1.3 }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{snapshotNodes.find(n => n.id === step.sourceId)?.name || step.sourceId}</span>
                      <span style={{ color: 'var(--text-muted)' }}> → </span>
                      <span style={{ fontWeight: 700, color: '#ef4444' }}>{snapshotNodes.find(n => n.id === step.targetId)?.name || step.targetId}</span>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{step.technique}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Tabbed Content View */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {activeTab === 'topology' && (
            <>
              <SimplifiedWholeNetworkGraph onNodeClick={setSelectedNode} />

              {/* SOC Decision Support: Why this path? */}
              {attackChain.length > 0 && (
                <div style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
                    <ShieldAlert size={18} color="#ef4444" />
                    <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      SOC Decision Support: Why this forecasted attack path?
                    </h2>
                  </div>

                  {(() => {
                    const step = attackChain[attackChain.length - 1];
                    const target = snapshotNodes.find(n => n.id === step.targetId);
                    const source = snapshotNodes.find(n => n.id === step.sourceId);
                    if (!target || !source) return null;

                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 16, columnGap: 24 }}>
                        <InfoRow label="Active Attacker Compromise" value={source.name} highlight />
                        <InfoRow label="MITRE Attack Vector" value={`${step.technique} (Target Ports: ${target.ports})`} />

                        <InfoRow label="Target Entity Under Threat" value={`${target.name} (${target.ip})`} />
                        <InfoRow label="Asset Criticality Level" value={target.criticality} highlight={target.criticality === 'Critical' || target.criticality === 'High'} />

                        <InfoRow label="Adversary Priority Risk Score" value={`${step.priority} / 100`} />
                        <InfoRow label="Network Reachability" value={`Reachable across ${source.zone} to ${target.zone}`} />

                        <InfoRow label="Vulnerability / Exposure" value={target.vulnerabilities[0] || 'Unprotected Network Port'} highlight={target.vulnerabilities.length > 0} />
                        <InfoRow label="Recommended Defensive Action" value={step.mitigation || target.vulnerabilities[0] ? `Patch ${target.vulnerabilities[0]} and apply firewall rule` : `Restrict ingress access on ${target.ports}`} />
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {activeTab === 'step-forecaster' && (
            <div style={cardStyle}>
              <StepForecaster />
            </div>
          )}

          {activeTab === 'mitre' && (
            <MitreMappingView />
          )}
        </div>
      </div>

      {/* ── Node Investigation Modal Popup ── */}
      {selectedNode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: 480, padding: 22, boxShadow: '0 10px 40px rgba(0,0,0,0.3)', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={18} color="var(--primary)" />
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>SOC Entity Profile: {selectedNode.name}</h3>
              </div>
              <button onClick={() => setSelectedNode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
              <InfoRow label="Hostname" value={selectedNode.name} />
              <InfoRow label="IP Address" value={selectedNode.ip} />
              <InfoRow label="Role / Category" value={`${selectedNode.role} (${selectedNode.category})`} />
              <InfoRow label="Security Zone" value={selectedNode.zone} />
              <InfoRow label="Operating System" value={selectedNode.os} />
              <InfoRow label="Open Listening Ports" value={selectedNode.ports} />
              <InfoRow label="Criticality" value={selectedNode.criticality} highlight={selectedNode.criticality === 'Critical' || selectedNode.criticality === 'High'} />
              <InfoRow label="Compromise Status" value={compromisedNodes.has(selectedNode.id) ? '💥 Compromised by Adversary' : '🛡️ Normal / Monitored'} highlight={compromisedNodes.has(selectedNode.id)} />
            </div>

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>CVE VULNERABILITIES</div>
              {selectedNode.vulnerabilities.length > 0 ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selectedNode.vulnerabilities.map(v => (
                    <span key={v} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>
                      ⚠️ {v}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No high-severity CVEs recorded</div>
              )}
            </div>

            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedNode(null)}
                style={{ padding: '7px 16px', borderRadius: 6, background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Components ──

function TabBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 8,
        border: 'none',
        background: active ? 'var(--primary)' : 'transparent',
        color: active ? 'white' : 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {icon}
      <span>{label}</span>
      {badge && (
        <span style={{
          fontSize: 9,
          fontWeight: 800,
          padding: '1px 6px',
          borderRadius: 999,
          background: active ? 'rgba(255,255,255,0.25)' : 'var(--bg-card)',
          color: active ? 'white' : 'var(--text-muted)',
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function CtrlBtn({ onClick, icon, label, color, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px',
        borderRadius: 6, border: `1px solid ${disabled ? 'var(--border-default)' : color}`,
        background: disabled ? 'var(--bg-input)' : `${color}15`,
        color: disabled ? 'var(--text-muted)' : color,
        fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: highlight ? '#ef4444' : 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border-default)',
  boxShadow: 'var(--shadow-sm)',
  padding: 16,
};
