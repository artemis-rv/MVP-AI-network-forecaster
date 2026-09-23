// NEXTRACE AI — Historical Analysis Page (Step 5)
// Completely isolated from live monitoring, forecasting, and investigation.
// No imports from liveStore, forecastStore, or investigationStore.

import { useState, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import {
  Upload, Play, RefreshCw, AlertTriangle, Info,
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useHistoricalStore } from '@/store/historicalStore';
import type {
  HistoricalResult, SuspiciousEvent, ActivityTimelineEntry,
  TemporalWindow,
} from '@/types/historical';
import { HistoricalNetworkGraph } from '@/components/historical/HistoricalNetworkGraph';

// ── Colour constants ────────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  critical: '#dc2626', high: '#f97316', medium: '#f59e0b', low: '#10b981',
};
const SEV_BG: Record<string, string> = {
  critical: '#fee2e2', high: '#ffedd5', medium: '#fef3c7', low: '#d1fae5',
};
const PROTO_COLORS: Record<string, string> = {
  TCP: '#6366f1', UDP: '#06b6d4', ICMP: '#f59e0b', OTHER: '#94a3b8',
};
const PIE_COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#f97316', '#94a3b8'];

const STAGE_COLORS_MAP: Record<string, { bg: string; text: string; border: string }> = {
  'Reconnaissance':    { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  'Initial Access':    { bg: '#ffedd5', text: '#9a3412', border: '#f97316' },
  'Lateral Movement':  { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
  'Data Exfiltration': { bg: '#fee2e2', text: '#7f1d1d', border: '#dc2626' },
  'Normal Activity':   { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
};

function tsToTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour12: false });
}
function formatBytes(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1024)      return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}
function formatDuration(s: number): string {
  if (s >= 60) return `${Math.floor(s / 60)}m ${(s % 60).toFixed(0)}s`;
  return `${s.toFixed(1)}s`;
}

// ── Stage label from current_stage ─────────────────────────────────────────
const STAGE_LABELS: Record<string, string> = {
  queued:              '⏳ Queued…',
  parsing:             '📂 Parsing PCAP…',
  building_flows:      '🔗 Building Flows…',
  feature_engineering: '📊 Feature Engineering…',
  detection:           '🔍 Heuristic Detection…',
  timeline:            '📅 Building Timeline…',
  processing:          '⚙️ Processing…',
  completed:           '✅ Complete',
  failed:              '❌ Failed',
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function HistoricalAnalysisPage() {
  const {
    status, progress, packetsProcessed, flowsDetected, currentStage,
    error, result, isDemo, currentJobId, jobMeta,
    uploadPcap, loadDemoJob, clearJob,
  } = useHistoricalStore();

  const view =
    status === 'idle' ? 'upload' :
    status === 'completed' ? 'result' :
    status === 'failed' ? 'error' : 'processing';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: 'calc(100vh - 60px)' }}>
      {/* ── Header ── */}
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: 4 }}>
              Historical PCAP Analysis
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Upload a PCAP capture for offline traffic analysis and activity timeline reconstruction.
            </p>
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
                <button onClick={clearJob} style={ghostBtnStyle}>
                  <RefreshCw size={12} /> New Analysis
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, paddingTop: 20 }}>
        {view === 'upload'     && <UploadView onUpload={uploadPcap} onDemo={loadDemoJob} />}
        {view === 'processing' && <ProcessingView progress={progress} stage={currentStage} packets={packetsProcessed} flows={flowsDetected} jobId={currentJobId} />}
        {view === 'error'      && <ErrorView error={error} onReset={clearJob} />}
        {view === 'result'     && result && <ResultView result={result} jobId={currentJobId} filename={jobMeta?.filename ?? ''} isDemo={isDemo} />}
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
    if (!['pcap', 'pcapng', 'cap'].includes(ext ?? ''))
      return `Unsupported format: .${ext}. Accepted: .pcap, .pcapng, .cap`;
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
          accept=".pcap,.pcapng,.cap"
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
        <div style={{ fontSize: 40, marginBottom: 12 }}>{selectedFile ? '✅' : '📂'}</div>
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
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Supported: .pcap, .pcapng, .cap · Max 50 MB</div>
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
        ⚠ All demo data is clearly labeled as simulated.
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
  const stageLabel = STAGE_LABELS[stage] ?? `⚙️ ${stage}…`;

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
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{stageLabel}</div>
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
      <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
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
  const susCount   = result.suspicious_events.length;
  const critCount  = result.suspicious_events.filter(e => e.severity === 'critical').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 32 }}>

      {/* Demo banner */}
      {isDemo && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '10px 16px', fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> <strong>DEMO DATA</strong> — All packets, flows, and indicators are synthetically generated. This is not real network traffic or a real attack.
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <HistKpi label="Packets Analyzed" value={result.packet_count.toLocaleString()} icon="📦" color="var(--primary)" sub={`${result.flow_count} flows`} />
        <HistKpi label="Capture Duration" value={formatDuration(result.duration_seconds)} icon="⏱" color="var(--secondary)" sub={`${result.temporal_windows.length} windows`} />
        <HistKpi label="Suspicious Indicators" value={susCount.toString()} icon="⚠️" color={susCount > 0 ? 'var(--color-warning)' : 'var(--color-live)'} sub={`${critCount} critical`} />
        <HistKpi label="Protocol Mix" value={result.protocol_distribution[0]?.protocol ?? 'N/A'} icon="🔌" color="var(--color-live)" sub={`${result.protocol_distribution.length} protocols`} />
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
        <SuspiciousTable events={result.suspicious_events} />
      </SectionCard>

      {/* ── Activity / Stage Timeline ── */}
      <SectionCard title="Activity Timeline" subtitle="Chronological reconstruction of observed events and suspicious indicators">
        <ActivityTimeline entries={result.activity_timeline} />
      </SectionCard>

      {/* ── Network Relationship Graph ── */}
      <SectionCard title="Network Relationship Graph" subtitle="Observed host connections and relationships · Click a node to select">
        <div style={{ height: 380, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          <ReactFlowProvider>
            <HistoricalNetworkGraph relationships={result.entity_relationships} />
          </ReactFlowProvider>
        </div>
      </SectionCard>

      {/* ── Processing Metadata ── */}
      <SectionCard title="Processing Metadata" subtitle="Job details and analysis parameters">
        <MetadataGrid result={result} jobId={jobId} filename={filename} isDemo={isDemo} />
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CHARTS & DATA COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function TrafficTimelineChart({ windows, events }: { windows: TemporalWindow[]; events: SuspiciousEvent[] }) {
  const data = windows.map(w => ({
    t:       tsToTime(w.window_start),
    packets: w.packet_count,
    flows:   w.flow_count,
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
        <Area type="monotone" dataKey="flows"   stroke="#06b6d4" fill="url(#grad-flow)" strokeWidth={2} name="flows" />
        <Area type="monotone" dataKey="suspicious" stroke="#f97316" fill="none" strokeWidth={2} strokeDasharray="4 2" name="suspicious" />
        <Legend formatter={v => v === 'packets' ? 'Packets' : v === 'flows' ? 'Flows' : 'Suspicious'} wrapperStyle={{ fontSize: 11 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ProtocolDistChart({ data }: { data: { protocol: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <ResponsiveContainer width="50%" height={160}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="protocol" cx="50%" cy="50%" outerRadius={60} strokeWidth={1.5}>
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Tooltip formatter={((v: unknown) => [`${v ?? 0} (${(((v as number ?? 0) / total) * 100).toFixed(1)}%)`, '']) as any} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border-default)' }} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((d, i) => (
          <div key={d.protocol} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 50 }}>{d.protocol}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{d.count.toLocaleString()}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{((d.count / total) * 100).toFixed(0)}%</span>
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

function SuspiciousTable({ events }: { events: SuspiciousEvent[] }) {
  if (events.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '24px 0' }}>No suspicious indicators detected.</div>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: 'var(--bg-workspace)' }}>
            {['Time', 'Type', 'Source', 'Destination', 'Protocol', 'Severity', 'Reason'].map(col => (
              <th key={col} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 10, letterSpacing: '0.4px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((ev, i) => (
            <tr key={ev.event_id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-workspace)', borderTop: '1px solid var(--border-subtle)' }}>
              <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{tsToTime(ev.timestamp)}</td>
              <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--primary)', whiteSpace: 'nowrap', fontSize: 10 }}>{ev.type.replace(/_/g, ' ').toUpperCase()}</td>
              <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{ev.src_ip}</td>
              <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{ev.dst_ip}</td>
              <td style={{ padding: '7px 10px', fontWeight: 700, color: PROTO_COLORS[ev.protocol] ?? 'var(--text-muted)' }}>{ev.protocol}</td>
              <td style={{ padding: '7px 10px' }}>
                <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: SEV_BG[ev.severity] ?? '#f1f5f9', color: SEV_COLOR[ev.severity] ?? '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  {ev.severity}
                </span>
              </td>
              <td style={{ padding: '7px 10px', color: 'var(--text-secondary)', maxWidth: 320, lineHeight: 1.4 }}>{ev.reason.split('(Demo')[0].trim()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityTimeline({ entries }: { entries: ActivityTimelineEntry[] }) {
  if (entries.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '24px 0' }}>No activity timeline data.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 400, overflowY: 'auto' }}>
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1;
        const stageC = STAGE_COLORS_MAP[entry.stage] ?? STAGE_COLORS_MAP['Normal Activity'];
        const isSus  = entry.entry_type === 'suspicious';

        return (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: isLast ? 0 : 4 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 3 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: isSus ? SEV_COLOR[entry.severity] ?? '#f59e0b' : 'var(--color-live)',
                boxShadow: isSus ? `0 0 6px ${SEV_COLOR[entry.severity] ?? '#f59e0b'}50` : 'none',
              }} />
              {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--border-subtle)', minHeight: 18, marginTop: 3 }} />}
            </div>
            <div style={{ paddingBottom: isLast ? 0 : 10, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{tsToTime(entry.timestamp)}</span>
                <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: stageC.bg, color: stageC.text, border: `1px solid ${stageC.border}30`, letterSpacing: '0.3px' }}>{entry.stage}</span>
                {isSus && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: SEV_BG[entry.severity], color: SEV_COLOR[entry.severity], textTransform: 'uppercase' }}>{entry.severity}</span>}
              </div>
              <div style={{ fontSize: 12, color: isSus ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1.4, fontWeight: isSus ? 500 : 400 }}>
                {entry.description.split('(Demo')[0].trim()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetadataGrid({ result, jobId, filename, isDemo }: {
  result: HistoricalResult; jobId: string | null; filename: string; isDemo: boolean;
}) {
  const rows = [
    ['Job ID',          jobId ?? '—'],
    ['Filename',        filename],
    ['Data Source',     isDemo ? 'Demo (Synthetic)' : 'Uploaded PCAP'],
    ['Packets',         result.packet_count.toLocaleString()],
    ['Flows',           result.flow_count.toLocaleString()],
    ['Duration',        formatDuration(result.duration_seconds)],
    ['Temporal Window', `${result.window_seconds}s`],
    ['Windows',         result.temporal_windows.length.toString()],
    ['Suspicious',      result.suspicious_events.length.toString()],
    ['Start',           tsToTime(result.start_timestamp)],
    ['End',             tsToTime(result.end_timestamp)],
    ['Isolation',       'Isolated historical job — live state unmodified'],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: k === 'Job ID' || k === 'Filename' ? 'var(--font-mono)' : 'inherit', maxWidth: 160, textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function HistKpi({ label, value, icon, color, sub }: { label: string; value: string; icon: string; color: string; sub: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
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
    <div style={{ fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: 'rgba(245,158,11,0.1)', color: '#92400e', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
      ⚠ DEMO DATA
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
