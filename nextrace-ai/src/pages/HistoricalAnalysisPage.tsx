// NEXTRACE AI — Historical Analysis Page (Step 5)
// Isolated from live monitoring, forecasting, and investigation state.
// No imports from liveStore, forecastStore, or investigationStore. Detector indicators are grouped with
// the same activity engine used for live traffic, so both views and their reports share one vocabulary.

import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import {
  Upload, Play, RefreshCw, AlertTriangle, Info, Search, FileText, Users,
  CheckCircle2, UploadCloud, AlertCircle, Layers, Clock, ShieldAlert,
  FileSearch, Link2, BarChart2, Calendar, Settings, XCircle, ArrowLeft
} from 'lucide-react';
import {
  AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useHistoricalStore } from '@/store/historicalStore';
import { useForensicStore } from '@/store/forensicStore';
import { useFindingsStore } from '@/store/findingsStore';
import type {
  HistoricalResult, SuspiciousEvent,
  TemporalWindow,
} from '@/types/historical';
import type { AlertSeverity } from '@/types/alert';
import { HistoricalNetworkGraph } from '@/components/historical/HistoricalNetworkGraph';
import { groupHistoricalEvents, significantActivities, SEVERITY_RANK } from '@/lib/activityGrouping';
import { buildHistoricalReport, forensicPartFrom, historicalLimitations, nextSteps } from '@/lib/reportBuilder';
import { deriveRiskEntities, type DashboardEntity } from '@/utils/entityRisk';
import { ActivityList, SeverityPill } from '@/components/activity/ActivityList';
import { SEVERITY_STYLE } from '@/components/activity/severity';
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';
import { ActivityInspector } from '@/components/activity/ActivityInspector';

function tsToTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour12: false });
}
function formatBytes(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}
function formatDuration(s: number): string {
  if (s >= 60) return `${Math.floor(s / 60)}m ${(s % 60).toFixed(0)}s`;
  return `${s.toFixed(1)}s`;
}

// ── Stage labels & icons from current_stage ──────────────────────────────────
const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued…',
  parsing: 'Parsing PCAP…',
  building_flows: 'Building Flows…',
  feature_engineering: 'Feature Engineering…',
  detection: 'Heuristic Detection…',
  timeline: 'Building Timeline…',
  processing: 'Processing…',
  completed: 'Complete',
  failed: 'Failed',
};

const STAGE_ICONS: Record<string, React.ReactNode> = {
  queued: <Clock size={16} color="var(--primary)" />,
  parsing: <FileSearch size={16} color="var(--primary)" />,
  building_flows: <Link2 size={16} color="var(--primary)" />,
  feature_engineering: <BarChart2 size={16} color="var(--primary)" />,
  detection: <Search size={16} color="var(--primary)" />,
  timeline: <Calendar size={16} color="var(--primary)" />,
  processing: <Settings size={16} color="var(--primary)" />,
  completed: <CheckCircle2 size={16} color="var(--color-live)" />,
  failed: <XCircle size={16} color="var(--color-critical)" />,
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function HistoricalAnalysisPage() {
  const navigate = useNavigate();
  const {
    status, progress, packetsProcessed, flowsDetected, currentStage,
    error, result, isDemo, currentJobId, jobMeta,
    uploadPcap, loadDemoJob, clearJob,
  } = useHistoricalStore();

  const view =
    status === 'idle' ? 'upload' :
      status === 'completed' ? 'result' :
        status === 'failed' ? 'error' : 'processing';

  function handleOpenForensic() {
    if (currentJobId) navigate(`/forensic/${currentJobId}`);
  }

  const { saveLocalReport } = useFindingsStore();
  function handleGenerateReport() {
    if (!currentJobId || !result) return;
    const report = buildHistoricalReport({
      jobId: currentJobId,
      filename: jobMeta?.filename ?? '',
      isDemo,
      result,
      activities: groupHistoricalEvents(result.suspicious_events),
      // Include forensic reasoning when it has been run for this capture
      forensic: forensicPartFrom(useForensicStore.getState(), currentJobId),
    });
    navigate(`/reports/${saveLocalReport(report)}`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* ── Header ── */}
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {view !== 'upload' && (
              <button 
                onClick={clearJob} 
                style={{ 
                  marginTop: 2, padding: 6, borderRadius: 8, background: 'var(--bg-card)', 
                  border: '1px solid var(--border-default)', color: 'var(--text-secondary)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                title="Back to Upload"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: 4 }}>
                Historical PCAP Analysis
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Upload a PCAP capture for offline traffic analysis and activity timeline reconstruction.
              </p>
            </div>
          </div>
          {view !== 'upload' && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {currentJobId && (
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)', background: 'rgba(99,102,241,0.08)', padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center' }}>
                  {currentJobId}
                </div>
              )}
              {isDemo && <DemoBadge />}
              {view === 'result' && (
                <>
                  <button
                    id="open-forensic-analysis-btn"
                    onClick={handleOpenForensic}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 700, padding: '7px 16px', borderRadius: 8, border: 'none',
                      background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                      color: 'white', cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Search size={12} /> Open Forensic Analysis
                  </button>
                  <button
                    id="generate-historical-report-btn"
                    onClick={handleGenerateReport}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 700, padding: '7px 16px', borderRadius: 8,
                      background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer',
                    }}
                  >
                    <FileText size={12} /> Generate Report
                  </button>
                  <button 
                    onClick={clearJob} 
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8,
                      background: 'var(--bg-card)', color: 'var(--text-primary)', 
                      border: '1px solid var(--border-default)', cursor: 'pointer', 
                      transition: 'all 0.15s', boxShadow: 'var(--shadow-sm)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-workspace)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-card)'}
                  >
                    <RefreshCw size={12} /> New Analysis
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, paddingTop: 20, overflowY: 'auto' }}>
        {view === 'upload' && <UploadView onUpload={uploadPcap} onDemo={loadDemoJob} />}
        {view === 'processing' && <ProcessingView progress={progress} stage={currentStage} packets={packetsProcessed} flows={flowsDetected} jobId={currentJobId} />}
        {view === 'error' && <ErrorView error={error} onReset={clearJob} />}
        {view === 'result' && result && <ResultView result={result} jobId={currentJobId} filename={jobMeta?.filename ?? ''} isDemo={isDemo} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// UPLOAD VIEW
// ═══════════════════════════════════════════════════════════════════════════

function UploadView({ onUpload, onDemo }: { onUpload: (f: File) => void; onDemo: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function validateFile(file: File): string | null {
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['pcap', 'pcapng', 'cap', 'gz', 'dmp'].includes(ext ?? ''))
      return `Unsupported format: .${ext}. Accepted: .pcap, .pcapng, .cap, .gz, .dmp`;
    if (file.size === 0) return 'File is empty.';
    if (file.size > 50 * 1024 * 1024) return 'File too large (max 50 MB).';
    return null;
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0];
    const err = validateFile(file);
    setFileError(err);
    setSelectedFile(err ? null : file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? 'var(--primary)' : selectedFile ? 'var(--color-live)' : 'var(--border-default)'}`,
          borderRadius: 16, padding: '48px 32px', textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'rgba(99,102,241,0.04)' : selectedFile ? 'rgba(16,185,129,0.02)' : 'var(--bg-card)',
          transition: 'all 0.2s ease',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pcap,.pcapng,.cap,.gz,.dmp"
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          {selectedFile ? <CheckCircle2 size={38} color="var(--color-live)" /> : <UploadCloud size={38} color="var(--primary)" />}
        </div>
        {selectedFile ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-live)', marginBottom: 4 }}>{selectedFile.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatBytes(selectedFile.size)}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Drop a PCAP file here or click to browse
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Supported: .pcap, .pcapng, .cap, .gz, .dmp · Max 50 MB</div>
          </>
        )}
      </div>

      {fileError && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#b91c1c', display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={14} /> {fileError}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={() => selectedFile && onUpload(selectedFile)}
          disabled={!selectedFile || !!fileError}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, border: 'none',
            background: selectedFile && !fileError ? 'var(--primary)' : 'var(--border-default)',
            color: selectedFile && !fileError ? 'white' : 'var(--text-muted)',
            cursor: selectedFile && !fileError ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}
        >
          <Upload size={15} /> Analyze PCAP
        </button>
        <button
          onClick={onDemo}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(6,182,212,0.08))',
            border: '1.5px solid rgba(99,102,241,0.3)', color: 'var(--primary)', cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <Play size={15} /> Load Demo PCAP
        </button>
      </div>

      {/* Info box */}
      <div style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: '14px 16px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Info size={12} /> About Historical Analysis
        </div>
        Uploaded PCAP files are processed in an isolated job — completely separate from the live monitoring workflow.
        Analysis extracts flows, computes temporal features, and applies lightweight heuristics to detect suspicious patterns.
        <br /><br />
        <strong>"Load Demo PCAP"</strong> generates a synthetic dataset to demonstrate the full analysis workflow without requiring a real capture.
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
          <AlertTriangle size={12} color="var(--color-warning)" /> All demo data is clearly labeled as simulated.
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSING VIEW
// ═══════════════════════════════════════════════════════════════════════════

function ProcessingView({ progress, stage, packets, flows, jobId }: {
  progress: number; stage: string; packets: number; flows: number; jobId: string | null;
}) {
  const stageLabel = STAGE_LABELS[stage] ?? `${stage}…`;
  const stageIcon = STAGE_ICONS[stage] ?? <Settings size={18} />;

  return (
    <div style={{ maxWidth: 560, margin: '40px auto', display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', textAlign: 'center' }}>
      {/* Animated ring */}
      <div style={{ position: 'relative', width: 100, height: 100 }}>
        <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke="var(--primary)" strokeWidth="8"
            strokeDasharray={`${(progress / 100) * 263.9} 263.9`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--primary)' }}>{Math.round(progress)}%</span>
        </div>
      </div>

      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          <span style={{ color: 'var(--primary)', display: 'inline-flex' }}>{stageIcon}</span>
          <span>{stageLabel}</span>
        </div>
        {jobId && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{jobId}</div>}
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', background: 'var(--border-subtle)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 999,
          background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
          width: `${progress}%`, transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={statBoxStyle}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{packets.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Packets</div>
        </div>
        <div style={statBoxStyle}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--secondary)' }}>{flows.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Flows</div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
        Processing in an isolated historical job. Live monitoring is unaffected.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR VIEW
// ═══════════════════════════════════════════════════════════════════════════

function ErrorView({ error, onReset }: { error: string | null; onReset: () => void }) {
  return (
    <div style={{ maxWidth: 520, margin: '48px auto', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <AlertCircle size={44} color="var(--color-critical)" />
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-critical)', marginBottom: 10 }}>Analysis Failed</h2>
      <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 12, padding: '14px 18px', fontSize: 12, color: '#b91c1c', marginBottom: 20, textAlign: 'left', lineHeight: 1.6 }}>
        {error ?? 'An unknown error occurred during processing.'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
        This error is shown exactly as reported. The application will never silently substitute fake results for a failed real PCAP parse.
        <br />
        Only <strong>"Load Demo PCAP"</strong> uses synthetic data.
      </div>
      <button onClick={onReset} style={{ ...ghostBtnStyle, fontSize: 13, padding: '10px 24px' }}>
        <RefreshCw size={13} /> Try Again
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RESULT VIEW
// Ordered for an incident responder: A summary → B grouped activities (C deep inspection on click)
// → who is involved → D major events → E relationships → F evidence & limitations.
// Normal traffic is summarised statistically instead of being listed.
// ═══════════════════════════════════════════════════════════════════════════

function ResultView({ result, jobId, filename, isDemo }: {
  result: HistoricalResult; jobId: string | null; filename: string; isDemo: boolean;
}) {
  const activities = useMemo(() => significantActivities(groupHistoricalEvents(result.suspicious_events)), [result]);
  const { entities } = useMemo(() => deriveRiskEntities(activities), [activities]);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const inspected = inspectId ? activities.find(a => a.id === inspectId) ?? null : null;

  const worst = activities.reduce<AlertSeverity | null>((w, a) => (!w || SEVERITY_RANK[a.severity] > SEVERITY_RANK[w] ? a.severity : w), null);
  const highRisk = entities.filter(e => e.riskLevel === 'High').length;
  const keyFindings = [...activities]
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.eventCount - a.eventCount)
    .slice(0, 4);
  const steps = nextSteps(activities);
  const protoTotal = result.protocol_distribution.reduce((s, p) => s + p.count, 0) || 1;
  const suspiciousPairs = result.entity_relationships.filter(r => r.is_suspicious).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 32 }}>
      {isDemo && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={13} /> Built-in demo capture — packets are synthetic, not real network traffic.
        </div>
      )}

      {/* ── A. Summary / key findings ── */}
      <SectionCard title="Summary" subtitle="What happened · who is involved · how severe · what to investigate next">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
          <HistKpi label="Grouped Activities" value={activities.length.toString()} icon={<ShieldAlert size={16} />}
            color={activities.length ? 'var(--color-warning)' : 'var(--color-live)'} sub={`from ${result.suspicious_events.length} detector indicators`} />
          <HistKpi label="Highest Severity" value={worst ?? 'None'} icon={<AlertTriangle size={16} />}
            color={worst ? SEVERITY_STYLE[worst].color : 'var(--color-live)'} sub={`${activities.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH').length} high / critical`} />
          <HistKpi label="Suspicious Entities" value={entities.length.toString()} icon={<Users size={16} />}
            color="var(--primary)" sub={`${highRisk} high risk`} />
          <HistKpi label="Capture" value={result.packet_count.toLocaleString()} icon={<Layers size={16} />}
            color="var(--secondary)" sub={`packets · ${formatDuration(result.duration_seconds)} · ${result.flow_count} flows`} />
        </div>
        {activities.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} color="#059669" /> No suspicious activity was detected in this capture.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <div>
              <div style={subHeading}>Key findings</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {keyFindings.map(a => (
                  <li key={a.id} onClick={() => setInspectId(a.id)} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                    <SeverityPill severity={a.severity} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{a.label}</strong> — {a.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div style={subHeading}>Investigate next</div>
              <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {steps.map((s, i) => <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s}</li>)}
              </ol>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── B. Grouped suspicious activities (click → C. deep inspection) ── */}
      <SectionCard
        title="Suspicious Activities"
        subtitle="Detector indicators grouped by similarity (type, source, protocol, target, port) · click a row for deep inspection"
        badge={activities.length > 0 ? { label: `${activities.length} activities`, color: 'var(--color-warning)', bg: '#fef3c7' } : undefined}
      >
        <ActivityList activities={activities} onSelect={a => setInspectId(a.id)} maxHeight={340}
          emptyText="No suspicious activity detected in this capture." />
      </SectionCard>

      {/* ── Who is involved ── */}
      <SectionCard title="Suspicious Entities" subtitle="Risk scored from grouped activity only — hosts with benign traffic are not listed">
        <EntityRiskTable entities={entities} onSelect={id => setInspectId(id)} />
      </SectionCard>

      {/* ── D. Major chronological events ── */}
      <SectionCard title="Major Events" subtitle="Chronological, activity-level reconstruction · normal traffic summarised below">
        <ActivityTimeline activities={activities} onSelect={a => setInspectId(a.id)} maxHeight={300}
          emptyText="No major suspicious events in this capture." />
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={subHeading}>Traffic volume per {result.window_seconds}s window</div>
          <TrafficTimelineChart windows={result.temporal_windows} events={result.suspicious_events} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
            Normal traffic: {result.packet_count.toLocaleString()} packets over {result.temporal_windows.length} windows ·
            protocol mix {result.protocol_distribution.map(p => `${p.protocol} ${Math.round((p.count / protoTotal) * 100)}%`).join(', ')} ·
            top talkers {result.top_src_ips.slice(0, 3).map(x => x.ip).join(', ')}
          </div>
        </div>
      </SectionCard>

      {/* ── E. Network / entity relationships ── */}
      <SectionCard title="Network Relationships" subtitle={`Observed host connections · ${suspiciousPairs} suspicious host pair${suspiciousPairs === 1 ? '' : 's'} highlighted`}>
        <div style={{ height: 380, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          <ReactFlowProvider>
            <HistoricalNetworkGraph relationships={result.entity_relationships} />
          </ReactFlowProvider>
        </div>
      </SectionCard>

      {/* ── F. Evidence & limitations ── */}
      <SectionCard title="Evidence & Limitations" subtitle="Capture provenance and what this analysis cannot show">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={subHeading}>Capture / source</div>
            {([
              ['Capture file', filename || '—'],
              ['Analysis ID', jobId ?? '—'],
              ['Capture period', `${tsToTime(result.start_timestamp)} — ${tsToTime(result.end_timestamp)}`],
              ['Analysis window', `${result.window_seconds}s`],
              ['Packets / flows', `${result.packet_count.toLocaleString()} / ${result.flow_count.toLocaleString()}`],
              ['Evidence hash', 'Computed in Forensic Analysis'],
            ] as const).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11, padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={subHeading}>Limitations</div>
            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {historicalLimitations({ isDemo, result }).map((l, i) => (
                <li key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{l}</li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>

      {inspected && (
        <ActivityInspector
          activity={inspected}
          allActivities={activities}
          relationships={result.entity_relationships}
          sourceNote="Historical activities group detector indicators; per-indicator packet bytes and payloads are not part of the analysis result."
          onSelect={a => setInspectId(a.id)}
          onClose={() => setInspectId(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CHARTS & DATA COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function TrafficTimelineChart({ windows, events }: { windows: TemporalWindow[]; events: SuspiciousEvent[] }) {
  const data = windows.map(w => ({
    t: tsToTime(w.window_start),
    packets: w.packet_count,
    flows: w.flow_count,
    suspicious: events.filter(e => e.timestamp >= w.window_start && e.timestamp < w.window_end).length,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-pkt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="grad-flow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={35} />
        <Tooltip
          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((value: unknown, name: unknown) => [value ?? 0, name === 'packets' ? 'Packets' : name === 'flows' ? 'Flows' : 'Suspicious indicators']) as any}
        />
        <Area type="monotone" dataKey="packets" stroke="#6366f1" fill="url(#grad-pkt)" strokeWidth={2} name="packets" />
        <Area type="monotone" dataKey="flows" stroke="#06b6d4" fill="url(#grad-flow)" strokeWidth={2} name="flows" />
        <Area type="monotone" dataKey="suspicious" stroke="#f97316" fill="none" strokeWidth={2} strokeDasharray="4 2" name="suspicious" />
        <Legend formatter={v => v === 'packets' ? 'Packets' : v === 'flows' ? 'Flows' : 'Suspicious indicators'} wrapperStyle={{ fontSize: 11 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function EntityRiskTable({ entities, onSelect }: { entities: DashboardEntity[]; onSelect: (activityId: string) => void }) {
  if (entities.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '20px 0' }}>No suspicious entities detected.</div>;
  }
  return (
    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead style={{ position: 'sticky', top: 0 }}>
          <tr style={{ background: 'var(--bg-workspace)' }}>
            {['Entity', 'Risk', 'Status', 'Activities'].map(c => (
              <th key={c} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entities.map(e => (
            <tr key={e.ip} onClick={() => e.activityIds[0] && onSelect(e.activityIds[0])}
              style={{ borderTop: '1px solid var(--border-subtle)', cursor: 'pointer' }}
              onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg-workspace)')}
              onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
              <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{e.ip}</td>
              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 800, color: e.riskLevel === 'High' ? '#b91c1c' : e.riskLevel === 'Medium' ? '#b45309' : '#047857' }}>{e.riskLevel}</span>
                <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{e.riskScore}</span>
              </td>
              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{e.status}</td>
              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 11 }}>{e.reasons.join('; ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function HistKpi({ label, value, icon, color, sub }: { label: string; value: string; icon: React.ReactNode; color: string; sub: string }) {
  return (
    <div style={{ background: 'var(--bg-workspace)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ color, display: 'flex', alignItems: 'center' }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: '-0.5px', marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  );
}

function SectionCard({ title, subtitle, children, badge }: {
  title: string; subtitle?: string; children: React.ReactNode;
  badge?: { label: string; color: string; bg: string };
}) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{title}</h3>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subtitle}</div>}
        </div>
        {badge && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: badge.bg, color: badge.color, border: `1px solid ${badge.color}40` }}>{badge.label}</span>
        )}
      </div>
      <div style={{ padding: '14px 18px' }}>{children}</div>
    </div>
  );
}

function DemoBadge() {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: 'rgba(245,158,11,0.1)', color: '#92400e', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: 5 }}>
      <AlertTriangle size={11} /> DEMO DATA
    </div>
  );
}

// ── Style constants ──────────────────────────────────────────────────────────

const subHeading: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
};

const ghostBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8,
  background: 'var(--bg-workspace)', border: '1px solid var(--border-default)',
  color: 'var(--text-secondary)', cursor: 'pointer',
};

const statBoxStyle: React.CSSProperties = {
  background: 'var(--bg-card)', borderRadius: 12,
  border: '1px solid var(--border-default)', padding: '12px 20px',
  textAlign: 'center', minWidth: 120,
};
