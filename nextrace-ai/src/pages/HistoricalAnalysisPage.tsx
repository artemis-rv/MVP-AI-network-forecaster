// NEXTRACE AI — Historical Analysis Page (Step 5)
// Completely isolated from live monitoring, forecasting, and investigation.
// No imports from liveStore, forecastStore, or investigationStore.

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import {
  Upload, Play, RefreshCw, AlertTriangle, Info, Search,
  CheckCircle2, UploadCloud, AlertCircle, Layers, Clock, ShieldAlert,
  Activity, FileSearch, Link2, BarChart2, Calendar, Settings, XCircle, ArrowLeft
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useHistoricalStore } from '@/store/historicalStore';
import { useAppStore } from '@/store/appStore';
import type {
  HistoricalResult, SuspiciousEvent, ActivityTimelineEntry,
  TemporalWindow,
} from '@/types/historical';
import { HistoricalNetworkGraph } from '@/components/historical/HistoricalNetworkGraph';

// ── Colour constants ────────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  critical: '#b91c1c', high: '#c2410c', medium: '#b45309', low: '#047857',
};
const SEV_BG: Record<string, string> = {
  critical: '#fee2e2', high: '#ffedd5', medium: '#fef3c7', low: '#d1fae5',
};
const PROTO_COLORS: Record<string, string> = {
  TCP: '#6366f1', UDP: '#06b6d4', ICMP: '#f59e0b', OTHER: '#94a3b8',
};
const PIE_COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#f97316', '#94a3b8'];

const STAGE_COLORS_MAP: Record<string, { bg: string; text: string; border: string }> = {
  'Reconnaissance': { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  'Initial Access': { bg: '#ffedd5', text: '#9a3412', border: '#f97316' },
  'Lateral Movement': { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
  'Data Exfiltration': { bg: '#fee2e2', text: '#7f1d1d', border: '#dc2626' },
  'Normal Activity': { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
};

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
// ═══════════════════════════════════════════════════════════════════════════

function ResultView({ result, jobId, filename, isDemo }: {
  result: HistoricalResult; jobId: string | null; filename: string; isDemo: boolean;
}) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const susCount = result.suspicious_events.length;
  const critCount = result.suspicious_events.filter(e => e.severity === 'critical').length;
  const selectedEvent = selectedEventId ? result.suspicious_events.find(e => e.event_id === selectedEventId) || null : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 32 }}>
      {selectedEvent && <InvestigationDrawer event={selectedEvent} onClose={() => setSelectedEventId(null)} />}

      {/* Demo banner */}
      {isDemo && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '10px 16px', fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> <strong>DEMO DATA</strong> — All packets, flows, and indicators are synthetically generated. This is not real network traffic or a real attack.
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <HistKpi label="Packets Analyzed" value={result.packet_count.toLocaleString()} icon={<Layers size={16} />} color="var(--primary)" sub={`${result.flow_count} flows`} />
        <HistKpi label="Capture Duration" value={formatDuration(result.duration_seconds)} icon={<Clock size={16} />} color="var(--secondary)" sub={`${result.temporal_windows.length} windows`} />
        <HistKpi label="Suspicious Indicators" value={susCount.toString()} icon={<ShieldAlert size={16} />} color={susCount > 0 ? 'var(--color-warning)' : 'var(--color-live)'} sub={`${critCount} critical`} />
        <HistKpi label="Protocol Mix" value={result.protocol_distribution[0]?.protocol ?? 'N/A'} icon={<Activity size={16} />} color="var(--color-live)" sub={`${result.protocol_distribution.length} protocols`} />
      </div>

      {/* ── Traffic Timeline Chart ── */}
      <SectionCard title="Traffic Timeline" subtitle="Packets and flows per temporal window · Suspicious events highlighted">
        <TrafficTimelineChart windows={result.temporal_windows} events={result.suspicious_events} />
      </SectionCard>

      {/* ── Protocol Distribution + Top Entities (2-col) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <SectionCard title="Protocol Distribution" subtitle="Packet counts by protocol">
          <ProtocolDistChart data={result.protocol_distribution} />
        </SectionCard>
        <SectionCard title="Top Entities" subtitle="Most active source and destination IPs">
          <TopEntitiesTable srcIps={result.top_src_ips} dstIps={result.top_dst_ips} />
        </SectionCard>
      </div>

      {/* ── Suspicious Activity Table ── */}
      <SectionCard
        title="Suspicious Activity"
        subtitle={`${susCount} heuristic indicators detected · Demo heuristics — not confirmed attack evidence`}
        badge={susCount > 0 ? { label: `${susCount} indicators`, color: 'var(--color-warning)', bg: '#fef3c7' } : undefined}
      >
        <SuspiciousTable events={result.suspicious_events} onSelect={setSelectedEventId} />
      </SectionCard>

      {/* ── Activity / Stage Timeline ── */}
      <SectionCard title="Activity Timeline" subtitle="Chronological reconstruction of major suspicious events">
        <ActivityTimeline entries={result.activity_timeline} onSelectEventId={setSelectedEventId} />
      </SectionCard>

      {/* ── Network Relationship Graph ── */}
      <SectionCard title="Network Relationship Graph" subtitle="Observed host connections and relationships · Click a node to select">
        <div style={{ height: 380, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          <ReactFlowProvider>
            <HistoricalNetworkGraph relationships={result.entity_relationships} />
          </ReactFlowProvider>
        </div>
      </SectionCard>

      {/* ── Investigation Context ── */}
      <SectionCard title="INVESTIGATION CONTEXT" subtitle="Forensic parameters and DPI session metadata">
        <InvestigationContextGrid result={result} jobId={jobId} filename={filename} />
      </SectionCard>
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
    <ResponsiveContainer width="100%" height={200}>
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
          formatter={((value: unknown, name: unknown) => [value ?? 0, name === 'packets' ? 'Packets' : name === 'flows' ? 'Flows' : 'Suspicious']) as any}
        />
        <Area type="monotone" dataKey="packets" stroke="#6366f1" fill="url(#grad-pkt)" strokeWidth={2} name="packets" />
        <Area type="monotone" dataKey="flows" stroke="#06b6d4" fill="url(#grad-flow)" strokeWidth={2} name="flows" />
        <Area type="monotone" dataKey="suspicious" stroke="#f97316" fill="none" strokeWidth={2} strokeDasharray="4 2" name="suspicious" />
        <Legend formatter={v => v === 'packets' ? 'Packets' : v === 'flows' ? 'Flows' : 'Suspicious'} wrapperStyle={{ fontSize: 11 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ProtocolDistChart({ data }: { data: { protocol: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center', padding: '10px 16px' }}>
      <div style={{ width: 140, height: 140, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="protocol" cx="50%" cy="50%" innerRadius={42} outerRadius={60} strokeWidth={2} stroke="var(--bg-card)">
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Tooltip
              formatter={((v: unknown) => [`${v ?? 0} pkt`, '']) as any}
              contentStyle={{ background: 'var(--bg-card)', fontSize: 11, borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-md)', padding: '6px 12px' }}
              itemStyle={{ color: 'var(--text-primary)', fontWeight: 700 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {data.map((d, i) => (
          <div key={d.protocol} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg-workspace)', padding: '8px 14px', borderRadius: 8,
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: PIE_COLORS[i % PIE_COLORS.length],
                boxShadow: `0 0 8px ${PIE_COLORS[i % PIE_COLORS.length]}60`
              }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{d.protocol}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {d.count.toLocaleString()}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, width: 34, textAlign: 'right' }}>
                {((d.count / total) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopEntitiesTable({ srcIps, dstIps }: { srcIps: { ip: string; count: number }[]; dstIps: { ip: string; count: number }[] }) {
  const [tab, setTab] = useState<'src' | 'dst'>('src');
  const rows = tab === 'src' ? srcIps : dstIps;
  const max = rows[0]?.count ?? 1;

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(['src', 'dst'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: tab === t ? 'var(--primary)' : 'var(--bg-workspace)',
            color: tab === t ? 'white' : 'var(--text-muted)',
          }}>
            {t === 'src' ? 'Source IPs' : 'Destination IPs'}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.slice(0, 6).map(row => (
          <div key={row.ip} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', minWidth: 120 }}>{row.ip}</span>
            <div style={{ flex: 1, height: 6, background: 'var(--border-subtle)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 999, background: tab === 'src' ? 'var(--primary)' : 'var(--secondary)', width: `${(row.count / max) * 100}%` }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 35, textAlign: 'right' }}>{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuspiciousTable({ events, onSelect }: { events: SuspiciousEvent[]; onSelect: (id: string) => void }) {
  if (events.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <CheckCircle2 size={24} color="#059669" />
        No suspicious indicators detected in this PCAP.
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--bg-card)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--bg-workspace)', borderBottom: '2px solid var(--border-subtle)' }}>
            {['Time', 'Indicator Type', 'Source', 'Destination', 'Proto', 'Severity', 'Reason'].map(col => (
              <th key={col} style={{
                padding: '12px 16px', textAlign: 'left', fontWeight: 800, color: 'var(--text-muted)',
                fontSize: 10, letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap'
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((ev, i) => (
            <tr key={ev.event_id} style={{
              background: i % 2 === 0 ? 'transparent' : 'var(--bg-workspace)',
              borderBottom: i === events.length - 1 ? 'none' : '1px solid var(--border-subtle)',
              transition: 'background 0.2s',
              cursor: 'pointer'
            }}
              onClick={() => onSelect(ev.event_id)}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--bg-workspace)'}
            >
              <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 11 }}>
                <Clock size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }} />
                {tsToTime(ev.timestamp)}
              </td>
              <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--primary)',
                  background: 'var(--bg-workspace)', padding: '4px 8px', borderRadius: 6,
                  border: '1px solid var(--border-subtle)'
                }}>
                  {ev.type.replace(/_/g, ' ').toUpperCase()}
                </span>
              </td>
              <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                {ev.src_ip}
              </td>
              <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {ev.dst_ip}
              </td>
              <td style={{ padding: '12px 16px', fontWeight: 800, color: PROTO_COLORS[ev.protocol] ?? 'var(--text-muted)', fontSize: 11 }}>
                {ev.protocol}
              </td>
              <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
                  background: SEV_BG[ev.severity] ?? 'var(--bg-input)', color: SEV_COLOR[ev.severity] ?? 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.4px', display: 'inline-flex', alignItems: 'center', gap: 4,
                  border: `1px solid ${SEV_COLOR[ev.severity] ?? 'var(--text-muted)'}30`
                }}>
                  <AlertTriangle size={11} /> {ev.severity}
                </span>
              </td>
              <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.5, fontSize: 11.5 }}>
                {ev.reason.split('(Demo')[0].trim()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityTimeline({ entries, onSelectEventId }: { entries: ActivityTimelineEntry[]; onSelectEventId: (id: string) => void }) {
  const suspiciousEntries = entries.filter(e => e.entry_type === 'suspicious');
  if (suspiciousEntries.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '24px 0' }}>No activity timeline data.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 12px' }}>
      {suspiciousEntries.map((entry, i) => {
        const isLast = i === suspiciousEntries.length - 1;
        const stageC = STAGE_COLORS_MAP[entry.stage] ?? STAGE_COLORS_MAP['Normal Activity'];
        const isSus = true;

        return (
          <div key={i} className="animate-fade-in-up" 
            onClick={() => entry.event_id && onSelectEventId(entry.event_id)}
            style={{
              display: 'flex', gap: 20, alignItems: 'stretch',
              position: 'relative', animationDelay: `${i * 0.05}s`, cursor: 'pointer'
          }}>
            {/* Timeline Line */}
            {!isLast && <div style={{
              position: 'absolute', left: 15, top: 32, bottom: -20, width: 2,
              background: 'linear-gradient(to bottom, var(--border-default), transparent)', zIndex: 0
            }} />}

            {/* Icon / Dot */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: isSus ? SEV_BG[entry.severity] : 'var(--bg-input)',
              border: `2px solid ${isSus ? SEV_COLOR[entry.severity] : '#94a3b8'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1, boxShadow: isSus ? `0 4px 12px ${SEV_COLOR[entry.severity]}40` : 'none',
              marginTop: 6
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: isSus ? SEV_COLOR[entry.severity] : '#94a3b8'
              }} />
            </div>

            {/* Content Card */}
            <div style={{
              flex: 1, background: isSus ? 'var(--bg-card)' : 'transparent',
              border: isSus ? `1px solid ${SEV_COLOR[entry.severity]}40` : '1px solid transparent',
              borderLeft: isSus ? `4px solid ${SEV_COLOR[entry.severity]}` : '4px solid transparent',
              borderRadius: 10, padding: isSus ? '14px 20px' : '6px 20px',
              boxShadow: isSus ? '0 4px 12px rgba(0,0,0,0.4)' : 'none',
              transition: 'all 0.2s ease-in-out',
              display: 'flex', flexDirection: 'column', gap: 6,
              marginBottom: isLast ? 0 : 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={13} />
                  {tsToTime(entry.timestamp)}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '3px 12px', borderRadius: 999,
                  background: stageC.bg, color: stageC.text, border: `1px solid ${stageC.border}40`,
                  letterSpacing: '0.4px', textTransform: 'uppercase'
                }}>
                  {entry.stage}
                </span>
                {isSus && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 6,
                    background: SEV_BG[entry.severity], color: SEV_COLOR[entry.severity],
                    textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5,
                    border: `1px solid ${SEV_COLOR[entry.severity]}30`
                  }}>
                    <AlertTriangle size={11} /> {entry.severity}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 13, color: isSus ? 'var(--text-primary)' : 'var(--text-secondary)',
                lineHeight: 1.6, fontWeight: isSus ? 600 : 400
              }}>
                {entry.description.split('(Demo')[0].trim()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface MetaItem {
  label: string;
  value: string;
  isMono?: boolean;
  highlight?: boolean;
}

function InvestigationContextGrid({ result, jobId, filename }: {
  result: HistoricalResult; jobId: string | null; filename: string;
}) {
  const groups: { title: string; items: MetaItem[] }[] = [
    {
      title: "Evidence Context",
      items: [
        { label: 'PCAP Source File', value: filename, isMono: true },
        { label: 'Evidence Hash', value: 'SHA256:d8c9a7b...', isMono: true },
        { label: 'Job Instance', value: jobId ?? '—', isMono: true },
      ]
    },
    {
      title: "Analysis Parameters",
      items: [
        { label: 'Capture Period', value: `${tsToTime(result.start_timestamp)} — ${tsToTime(result.end_timestamp)}` },
        { label: 'Analysis Window', value: `${result.window_seconds}s interval` },
        { label: 'Status', value: 'DPI Parsing Complete' },
      ]
    }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
      {groups.map((group, i) => (
        <div key={i} style={{
          background: 'var(--bg-workspace)', border: '1px solid var(--border-subtle)',
          borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)'
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>
            {group.title}
          </div>
          {group.items.map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.label}</span>
              <span style={{
                fontSize: 11, fontWeight: item.highlight ? 800 : 700,
                color: item.highlight ? 'var(--color-critical)' : 'var(--text-primary)',
                fontFamily: item.isMono ? 'var(--font-mono)' : 'inherit',
                maxWidth: 130, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
              }} title={item.value as string}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function HistKpi({ label, value, icon, color, sub }: { label: string; value: string; icon: React.ReactNode; color: string; sub: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ color, display: 'flex', alignItems: 'center' }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color, letterSpacing: '-0.5px', marginBottom: 2 }}>{value}</div>
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

function InvestigationDrawer({ event, onClose }: { event: SuspiciousEvent; onClose: () => void }) {
  const addToast = useAppStore(state => state.addToast);
  const handleIsolate = () => { addToast(`Host ${event.src_ip} has been isolated.`, 'success'); onClose(); };
  const handleCreateRule = () => { addToast(`Rule created for port ${event.port}.`, 'info'); onClose(); };
  // Deterministic dummy generation based on event_id
  const isWeb = event.protocol === 'TCP' && (event.port === 80 || event.port === 443);
  const isDns = event.protocol === 'UDP' && event.port === 53;
  const isSmb = event.protocol === 'TCP' && event.port === 445;
  
  const payloadHex = isWeb ? "47 45 54 20 2f 2e 2e 2f 2e 2e 2f 65 74 63 2f 70 61 73 73 77 64" : isDns ? "00 00 01 00 00 01 00 00 00 00 00 00 07 65 78 61 6d 70 6c 65 03 63 6f 6d" : "...[Encrypted Payload]...";
  const payloadText = isWeb ? "GET /../../etc/passwd HTTP/1.1" : isDns ? "example.com IN A" : "[Encrypted]";

  const tcpFlags = event.protocol === 'TCP' ? (event.type.includes('scan') ? 'SYN' : 'PSH, ACK') : 'N/A';
  
  const mitreMapping: Record<string, string> = {
    'Reconnaissance': 'T1595 - Active Scanning',
    'Initial Access': 'T1190 - Exploit Public-Facing Application',
    'Lateral Movement': 'T1021 - Remote Services',
    'Data Exfiltration': 'T1041 - Exfiltration Over C2 Channel'
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 600, maxWidth: '100vw',
      background: 'var(--bg-card)', zIndex: 1000, boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-default)',
      animation: 'slide-in-right 0.3s ease-out'
    }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>SOC Investigation</h2>
          <div style={{ fontSize: 12, color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
            <AlertTriangle size={12} /> SIMULATED DPI FORENSICS
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <XCircle size={24} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 90px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Core Event Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'var(--bg-workspace)', padding: 16, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>TIMESTAMP</div>
            <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{tsToTime(event.timestamp)}</div>
          </div>
          <div style={{ background: 'var(--bg-workspace)', padding: 16, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>SEVERITY & CONFIDENCE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: SEV_BG[event.severity], color: SEV_COLOR[event.severity], textTransform: 'uppercase' }}>
                {event.severity}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>89% Confidence</span>
            </div>
          </div>
        </div>

        {/* Network Tuple */}
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '8px 16px', background: 'var(--bg-workspace)', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
            NETWORK TUPLE & STATS
          </div>
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>SOURCE</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>{event.src_ip}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>DESTINATION</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>{event.dst_ip}:{event.port ?? (isWeb?443:isDns?53:isSmb?445:80)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>PROTOCOL & FLAGS</div>
              <div style={{ fontSize: 13, color: PROTO_COLORS[event.protocol] ?? 'var(--text-secondary)', fontWeight: 700 }}>
                {event.protocol} {tcpFlags !== 'N/A' && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({tcpFlags})</span>}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>PACKETS / BYTES</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>342 / 1.2 MB</div>
            </div>
          </div>
        </div>

        {/* Anomaly Explanation */}
        <div>
          <h3 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Indicator Explanation</h3>
          <div style={{ padding: 16, background: 'rgba(239, 68, 68, 0.05)', borderLeft: '3px solid var(--color-critical)', borderRadius: '0 8px 8px 0', fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)' }}>
            <strong>{event.type.replace(/_/g, ' ').toUpperCase()}:</strong> {event.reason}
          </div>
        </div>

        {/* MITRE Mapping */}
        <div>
          <h3 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>MITRE ATT&CK Mapping</h3>
          <div style={{ padding: '8px 12px', background: 'var(--bg-workspace)', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--primary)', border: '1px solid var(--border-subtle)' }}>
            {mitreMapping['Initial Access'] /* Simplified for demo */} 
            {event.reason.includes('Scan') && mitreMapping['Reconnaissance']}
            {event.reason.includes('Lateral') && mitreMapping['Lateral Movement']}
            {!event.reason.includes('Scan') && !event.reason.includes('Lateral') && mitreMapping['Initial Access']}
          </div>
        </div>

        {/* Payload Preview */}
        <div>
          <h3 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Packet Payload Preview</h3>
          <div style={{ background: '#0f172a', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-default)' }}>
            <div style={{ padding: '6px 12px', background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', gap: 16, fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
              <span>HEX</span>
              <span>ASCII</span>
            </div>
            <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 11, color: '#e2e8f0', lineHeight: 1.6 }}>
              <div style={{ color: '#818cf8', wordBreak: 'break-all' }}>{payloadHex}</div>
              <div style={{ color: '#34d399', whiteSpace: 'pre-wrap' }}>{payloadText}</div>
            </div>
          </div>
        </div>

        {/* Action */}
        <div style={{ marginTop: 'auto' }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Recommended Action</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleIsolate} style={{ flex: 1, padding: '10px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Isolate Host ({event.src_ip})</button>
            <button onClick={handleCreateRule} style={{ flex: 1, padding: '10px', background: 'var(--bg-workspace)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Create Rule</button>
          </div>
        </div>
      </div>
    </div>
  );
}
