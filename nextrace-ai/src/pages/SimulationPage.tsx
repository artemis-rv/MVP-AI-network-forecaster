// NEXTRACE AI — Attack Path Forecaster Simulator (FORECAST SIMULATION)
import { useState } from 'react';
import { Play, SkipForward, SkipBack, RotateCcw, Cpu, Target, ShieldAlert, X } from 'lucide-react';
import { useSimplifiedSimulatorStore, TopologyNode } from '@/store/simplifiedSimulatorStore';
import { SimplifiedWholeNetworkGraph } from '@/components/simulation/SimplifiedWholeNetworkGraph';

export function SimulationPage() {
  const { k, setK, status, currentStep, attackChain, start, reset, nextStep, prevStep, snapshotNodes, snapshotTime, candidateEdges, compromisedNodes } = useSimplifiedSimulatorStore();
  
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);

  const isIdle = status === 'idle';
  const isCompleted = status === 'completed';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minHeight: 0, paddingBottom: 40 }}>
      {/* ── Header ── */}
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
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

      {snapshotTime && (
        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', color: '#047857', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={16} /> Live Monitoring Snapshot Captured at {snapshotTime}
        </div>
      )}

      {/* ── Main Layout: Controls & Graph ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        {/* Left Column: Config & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Cpu size={16} color="var(--primary)" />
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Configuration & Controls</h2>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                <span>Forecast Horizon (K Steps)</span>
                <span>{k}</span>
              </label>
              <input
                type="range" min={1} max={8} step={1}
                value={k}
                onChange={e => setK(Number(e.target.value))}
                disabled={!isIdle}
                style={{ width: '100%', accentColor: 'var(--primary)', opacity: isIdle ? 1 : 0.5 }}
              />
            </div>

            {isIdle ? (
              <button
                onClick={start}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  color: 'white', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Play size={14} /> Start Simulation
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Step {currentStep} of {k}</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{isCompleted ? 'COMPLETED' : 'FORECASTING'}</span>
                </div>
                
                {/* Simulator Forecast Panel */}
                <div style={{ padding: 12, background: 'var(--bg-workspace)', borderRadius: 8, border: '1px solid var(--border-default)', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 8, textTransform: 'uppercase' }}>Simulator Forecast · FUTURE / PREDICTED</div>
                  {isCompleted ? (
                    <div style={{ padding: 12, textAlign: 'center', color: '#10b981', fontWeight: 600, fontSize: 13, background: 'rgba(16,185,129,0.1)', borderRadius: 6 }}>
                      ✓ Simulation Completed
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 400 }}>Reached forecast horizon (K={k})</div>
                    </div>
                  ) : candidateEdges.length > 0 ? (
                    (() => {
                      const next = candidateEdges[0];
                      const sourceNode = snapshotNodes.find(n => n.id === next.source);
                      const targetNode = snapshotNodes.find(n => n.id === next.target);
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Predicted Next Stage</div>
                            <div style={{ fontWeight: 600 }}>{sourceNode?.name} → <span style={{ color: '#f59e0b' }}>{targetNode?.name}</span></div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Confidence/Risk Score</div>
                              <div style={{ fontWeight: 600, color: '#ef4444' }}>{next.priority}%</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>MITRE ATT&CK Tactic/Technique</div>
                              <div style={{ fontWeight: 600 }}>{next.technique}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
                            Predicted Event: {next.reason}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
                      No viable attack paths predicted
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
                  <CtrlBtn onClick={prevStep} icon={<SkipBack size={14} />} label="Previous Step" color="var(--text-secondary)" disabled={currentStep === 0} />
                  <CtrlBtn onClick={nextStep} icon={<SkipForward size={14} />} label="Next Step" color="#10b981" disabled={isCompleted} />
                </div>
                
                <button
                  onClick={reset}
                  style={{ width: '100%', padding: '8px 0', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-workspace)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', marginTop: 8 }}
                >
                  <RotateCcw size={13} /> Reset
                </button>
              </div>
            )}
          </div>

          {/* Attack Chain Summary */}
          {attackChain.length > 0 && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Target size={16} color="#ef4444" />
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Confirmed Attack Chain</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {attackChain.map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                      {step.step}
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{snapshotNodes.find(n => n.id === step.sourceId)?.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}> → </span>
                      <span style={{ fontWeight: 600, color: '#ef4444' }}>{snapshotNodes.find(n => n.id === step.targetId)?.name}</span>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{step.technique}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Main Graph */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SimplifiedWholeNetworkGraph onNodeClick={setSelectedNode} />
          
          {/* SOC Decision Support */}
          {attackChain.length > 0 && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
                <ShieldAlert size={18} color="#ef4444" />
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>SOC Decision Support: Why this path?</h2>
              </div>
              
              {(() => {
                const step = attackChain[attackChain.length - 1];
                const target = snapshotNodes.find(n => n.id === step.targetId);
                const source = snapshotNodes.find(n => n.id === step.sourceId);
                if (!target || !source) return null;
                
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <InfoRow label="Current State" value={`Compromised: ${source.name}`} highlight />
                      <InfoRow label="Predicted Target" value={target.name} />
                      <InfoRow label="Priority Score" value={step.priority.toString()} />
                      <InfoRow label="Key Vulnerability/Exposure" value={target.vulnerabilities[0] || 'Exposed Service Configuration'} highlight={target.vulnerabilities.length > 0} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <InfoRow label="Reachability & Service" value={`${step.technique} (Ports: ${target.ports})`} />
                      <InfoRow label="Asset Criticality" value={target.criticality} highlight={target.criticality === 'High' || target.criticality === 'Critical'} />
                      <InfoRow label="Evidence/Observation" value={`Direct historical lateral movement observed toward ${target.role}s`} />
                      <InfoRow label="Recommended Defensive Action" value={target.vulnerabilities.length > 0 ? `Patch ${target.vulnerabilities[0]} and isolate` : `Restrict access to ${target.ports} from ${source.zone}`} />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* ── Node Investigation Popup ── */}
      {selectedNode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: 450, padding: 20, boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={18} color="var(--primary)" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>SOC Entity Info</h3>
              </div>
              <button onClick={() => setSelectedNode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
              <InfoRow label="Hostname" value={selectedNode.name} />
              <InfoRow label="IP Address" value={selectedNode.ip} />
              <InfoRow label="Role" value={selectedNode.role} />
              <InfoRow label="Zone" value={selectedNode.zone} />
              <InfoRow label="OS" value={selectedNode.os} />
              <InfoRow label="Open Ports" value={selectedNode.ports} />
              <InfoRow label="Criticality" value={selectedNode.criticality} highlight={selectedNode.criticality === 'Critical' || selectedNode.criticality === 'High'} />
              <InfoRow label="Compromise Status" value={compromisedNodes.has(selectedNode.id) ? 'Compromised / Attacked' : 'Normal'} highlight={compromisedNodes.has(selectedNode.id)} />
            </div>

            {(() => {
              const chainStep = attackChain.find(s => s.targetId === selectedNode.id);
              if (chainStep) {
                return (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', fontSize: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>SELECTION REASON</div>
                    <div style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      Selected due to Priority Score <span style={{ fontWeight: 700, color: '#ef4444' }}>{chainStep.priority}</span>. {chainStep.reason}.
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>VULNERABILITIES</div>
              {selectedNode.vulnerabilities.length > 0 ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selectedNode.vulnerabilities.map(v => (
                    <span key={v} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>{v}</span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No known vulnerabilities</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Components ──

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
      <div style={{ fontSize: 13, fontWeight: 600, color: highlight ? '#ef4444' : 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

const cardStyle = {
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border-default)',
  boxShadow: 'var(--shadow-sm)',
  padding: 16,
};
