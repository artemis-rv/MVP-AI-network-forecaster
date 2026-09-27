// NEXTRACE AI — Forensic Analysis Page (Step 6)
// Route: /forensic/:jobId
// Isolated from live, forecast, and investigation pages.
// No imports from liveStore, forecastStore, or investigationStore.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Shield, AlertTriangle, CheckCircle, XCircle, Copy,
  ChevronDown, ChevronRight, ArrowLeft, Clock, FileText,
  Activity, Search, Info, BarChart2, Globe, Server,
} from 'lucide-react';
import { useForensicStore } from '@/store/forensicStore';
import { useFindingsStore } from '@/store/findingsStore';
import { useHistoricalStore } from '@/store/historicalStore';
import { groupHistoricalEvents } from '@/lib/activityGrouping';
import { buildHistoricalReport, forensicPartFrom } from '@/lib/reportBuilder';
import type {
  EvidenceIntegrity, AntiForensicIndicator,
  Hypothesis, FinalAssessment, EvidenceSummary,
} from '@/types/forensic';

// ── Colour palette (reuses NEXTRACE AI design tokens) ────────────────────────
const SEV_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  HIGH:   { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
  MEDIUM: { color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
  LOW:    { color: '#059669', bg: '#d1fae5', border: '#6ee7b7' },
};
const HYP_STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  SUPPORTED:            { color: '#059669', bg: '#d1fae5' },
  PLAUSIBLE:            { color: '#d97706', bg: '#fef3c7' },
  WEAK:                 { color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  INSUFFICIENT_EVIDENCE:{ color: '#94a3b8', bg: 'var(--bg-input)' },
};
const INTEGRITY_STYLE: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  VERIFIED:   { color: '#059669', bg: '#d1fae5', border: '#6ee7b7', icon: <CheckCircle size={16}/> },
  SIMULATED:  { color: '#d97706', bg: '#fef3c7', border: '#fcd34d', icon: <AlertTriangle size={16}/> },
  UNAVAILABLE:{ color: '#94a3b8', bg: 'var(--bg-input)', border: 'var(--border-subtle)', icon: <XCircle size={16}/> },
};

const STAGE_LABELS: Record<string, string> = {
  queued:               'Queued…',
  building_integrity:   'Building Evidence Integrity…',
  evidence_summary:     'Extracting Evidence Summary…',
  anti_forensic_scan:   'Scanning Anti-Forensic Indicators…',
  hypothesis_evaluation:'Evaluating Hypotheses…',
  final_assessment:     'Generating Final Assessment…',
  completed:            'Complete',
  failed:               'Failed',
};

const STAGE_ICONS: Record<string, React.ReactNode> = {
  queued:               <Clock size={16} />,
  building_integrity:   <Shield size={16} />,
  evidence_summary:     <FileText size={16} />,
  anti_forensic_scan:   <Search size={16} />,
  hypothesis_evaluation:<Activity size={16} />,
  final_assessment:     <BarChart2 size={16} />,
  completed:            <CheckCircle size={16} />,
  failed:               <XCircle size={16} />,
};

function tsToDateTime(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}
function formatBytes(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b === 0) return '0 B (demo)';
  return `${b} B`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export function ForensicAnalysisPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate  = useNavigate();
  const {
    status, progress, currentStage, error,
    integrity, evidenceSummary, antiForensicIndicators,
    hypotheses, finalAssessment, isDemo,
    forensicId, startAnalysis, reset,
  } = useForensicStore();

  useEffect(() => {
    if (!jobId) return;
    // Only start if we don't already have a result for this job
    const store = useForensicStore.getState();
    if (
      store.selectedHistoricalJobId !== jobId ||
      store.status === 'idle' ||
      store.status === 'failed'
    ) {
      startAnalysis(jobId);
    }
    return () => { /* keep state alive for navigation back */ };
  }, [jobId]);  // eslint-disable-line react-hooks/exhaustive-deps

  function handleBack() {
    reset();
    navigate('/historical-pcap');
  }

  const { generateHistoricalReport, saveLocalReport, loading: reportLoading } = useFindingsStore();
  const [reportError, setReportError] = useState<string | null>(null);

  async function handleGenerateReport() {
    if (!jobId) return;
    setReportError(null);
    // Preferred: one structured report from the grouped evidence + forensic reasoning shown in the app.
    const hist = useHistoricalStore.getState();
    if (hist.currentJobId === jobId && hist.result) {
      const report = buildHistoricalReport({
        jobId,
        filename: hist.jobMeta?.filename ?? integrity?.filename ?? '',
        isDemo: hist.isDemo,
        result: hist.result,
        activities: groupHistoricalEvents(hist.result.suspicious_events),
        forensic: forensicPartFrom(useForensicStore.getState(), jobId),
      });
      navigate(`/reports/${saveLocalReport(report)}`);
      return;
    }
    // Fallback (e.g. page reloaded, historical result no longer in memory): backend-built report.
    const reportId = await generateHistoricalReport(jobId);
    if (reportId) {
      navigate(`/reports/${reportId}`);
    } else {
      const storeErr = useFindingsStore.getState().error;
      setReportError(storeErr || 'Report generation failed. Please try again.');
    }
  }

  const normalizedStatus = String(status || '').toLowerCase();
  const isCompleted = normalizedStatus === 'completed';
  const isFailed = normalizedStatus === 'failed';

  const view =
    isCompleted ? 'result' :
    isFailed    ? 'error'  : 'processing';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minHeight: 0 }}>
      {/* ── Header ── */}
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button onClick={handleBack} style={ghostBtnStyle}>
              <ArrowLeft size={12}/> Historical Analysis
            </button>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: 4, marginTop: 10 }}>
              Forensic Analysis
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Forensic evidence summary, integrity verification, and prototype reasoning.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'flex-start', paddingTop: 4 }}>
            {jobId && (
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)', background: 'rgba(99,102,241,0.08)', padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.2)' }}>
                {jobId}
              </div>
            )}
            {forensicId && (
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', background: 'var(--bg-workspace)', padding: '5px 10px', borderRadius: 999, border: '1px solid var(--border-subtle)' }}>
                {forensicId}
              </div>
            )}
            {isDemo && <SimulatedBadge/>}
            {isCompleted && (
              <button
                id="generate-report-btn"
                onClick={handleGenerateReport}
                disabled={reportLoading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 8,
                  background: reportLoading ? 'var(--bg-workspace)' : 'var(--primary)',
                  border: '1px solid var(--primary)', color: 'white', cursor: reportLoading ? 'not-allowed' : 'pointer',
                  opacity: reportLoading ? 0.7 : 1,
                }}
              >
                <FileText size={13} />
                {reportLoading ? 'Generating…' : 'Generate Report'}
              </button>
            )}
            {reportError && (
              <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>{reportError}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Prototype Disclaimer Banner ── */}
      <div style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, padding: '10px 16px', fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 16 }}>
        <Info size={14} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }}/>
        <span>
          <strong style={{ color: 'var(--primary)' }}>Prototype forensic reasoning</strong> — deterministic heuristics over the historical analysis.
          Not legally admissible; expert review is required before acting on any finding.
          {isDemo && <> Evidence comes from the synthetic demo capture.</>}
        </span>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, paddingTop: 20 }}>
        {view === 'processing' && (
          <ForensicProcessingView progress={progress} stage={currentStage} jobId={jobId ?? null}/>
        )}
        {view === 'error' && (
          <ForensicErrorView error={error} onBack={handleBack}/>
        )}
        {view === 'result' && integrity && evidenceSummary && finalAssessment && (
          <ForensicResultView
            integrity={integrity}
            evidenceSummary={evidenceSummary}
            indicators={antiForensicIndicators}
            hypotheses={hypotheses}
            finalAssessment={finalAssessment}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSING VIEW
// ═══════════════════════════════════════════════════════════════════════════

function ForensicProcessingView({ progress, stage, jobId }: {
  progress: number; stage: string; jobId: string | null;
}) {
  const label = STAGE_LABELS[stage] ?? `${stage}…`;
  const icon = STAGE_ICONS[stage] ?? <Activity size={18} />;
  return (
    <div style={{ maxWidth: 520, margin: '40px auto', display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 100, height: 100 }}>
        <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-subtle)" strokeWidth="8"/>
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--primary)" strokeWidth="8"
            strokeDasharray={`${(progress / 100) * 263.9} 263.9`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s ease' }}/>
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--primary)' }}>{Math.round(progress)}%</span>
        </div>
      </div>
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          <span style={{ color: 'var(--primary)', display: 'inline-flex' }}>{icon}</span>
          {label}
        </div>
        {jobId && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Historical Job: {jobId}</div>}
      </div>
      <div style={{ width: '100%', background: 'var(--border-subtle)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, var(--primary), var(--secondary))', width: `${progress}%`, transition: 'width 0.4s ease' }}/>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
        Running deterministic forensic reasoning. Historical and live state unaffected.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR VIEW
// ═══════════════════════════════════════════════════════════════════════════

function ForensicErrorView({ error, onBack }: { error: string | null; onBack: () => void }) {
  return (
    <div style={{ maxWidth: 520, margin: '48px auto', textAlign: 'center' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-critical)', margin: '0 auto 16px auto' }}>
        <AlertTriangle size={32} />
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-critical)', marginBottom: 10 }}>Forensic Analysis Failed</h2>
      <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 12, padding: '14px 18px', fontSize: 12, color: '#b91c1c', marginBottom: 20, textAlign: 'left', lineHeight: 1.6 }}>
        {error ?? 'Unknown error. Forensic analysis requires a completed historical job.'}
      </div>
      <button onClick={onBack} style={{ ...ghostBtnStyle, fontSize: 13, padding: '10px 24px' }}>
        <ArrowLeft size={13}/> Back to Historical Analysis
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RESULT VIEW — assembles all sections
// ═══════════════════════════════════════════════════════════════════════════

function ForensicResultView({
  integrity, evidenceSummary, indicators,
  hypotheses, finalAssessment,
}: {
  integrity: EvidenceIntegrity;
  evidenceSummary: EvidenceSummary;
  indicators: AntiForensicIndicator[];
  hypotheses: Hypothesis[];
  finalAssessment: FinalAssessment;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
      {/* Ordered for the responder: conclusion first, then reasoning, evidence, limitations, provenance. */}

      {/* 1 — Assessment (what happened, how confident) */}
      <ForensicSection
        title="Forensic Assessment"
        icon={<CheckCircle size={16}/>}
        subtitle="Overall conclusion, confidence and the evidence it rests on"
      >
        <FinalAssessmentSection assessment={finalAssessment}/>
      </ForensicSection>

      {/* 2 — Hypotheses (why) */}
      <ForensicSection
        title="Forensic Hypotheses"
        icon={<Activity size={16}/>}
        subtitle="Evidence-weighted hypotheses · expand for supporting and contradicting evidence"
        badge={hypotheses.length > 0 ? { label: `${hypotheses.length} hypothes${hypotheses.length === 1 ? 'is' : 'es'}`, color: 'var(--primary)', bg: 'rgba(99,102,241,0.1)' } : undefined}
      >
        <div data-tour="hypotheses"><HypothesesSection hypotheses={hypotheses}/></div>
      </ForensicSection>

      {/* 3 — Evidence (what supports it) */}
      <ForensicSection title="Evidence Summary" icon={<FileText size={16}/>} subtitle="Network, temporal and entity evidence derived from the historical analysis">
        <EvidenceSummarySection summary={evidenceSummary}/>
      </ForensicSection>

      {/* 4 — Limitations */}
      <ForensicSection
        title="Evidence Limitations & Anti-Forensic Indicators"
        icon={<Search size={16}/>}
        subtitle="Coverage gaps and patterns that limit or complicate the conclusions"
        badge={indicators.length > 0 ? { label: `${indicators.length} indicator${indicators.length !== 1 ? 's' : ''}`, color: '#d97706', bg: '#fef3c7' } : undefined}
      >
        <AntiForensicSection indicators={indicators}/>
      </ForensicSection>

      {/* 5 — Provenance */}
      <ForensicSection title="Evidence Integrity" icon={<Shield size={16}/>} subtitle="Capture provenance and hash for chain of custody">
        <EvidenceIntegritySection integrity={integrity}/>
      </ForensicSection>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — EVIDENCE INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════

function EvidenceIntegritySection({ integrity }: { integrity: EvidenceIntegrity }) {
  const [copied, setCopied] = useState(false);
  const style = INTEGRITY_STYLE[integrity.status] ?? INTEGRITY_STYLE['UNAVAILABLE'];

  function handleCopy() {
    if (!integrity.sha256) return;
    navigator.clipboard.writeText(integrity.sha256).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const metaRows: [string, string, boolean?][] = [
    ['Historical Job ID',    integrity.historical_job_id,                           true],
    ['Filename',             integrity.filename,                                     true],
    ['File Size',            formatBytes(integrity.file_size)],
    ['Packet Count',         integrity.packet_count.toLocaleString()],
    ['Flow Count',           integrity.flow_count.toLocaleString()],
    ['Upload / Acquisition', tsToDateTime(integrity.upload_timestamp)],
    ['Processing Start',     tsToDateTime(integrity.processing_start)],
    ['Processing Completed', tsToDateTime(integrity.processing_completed)],
    ['Analysis Status',      integrity.analysis_status.toUpperCase()],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px',
          borderRadius: 999, border: `1.5px solid ${style.border}`,
          background: style.bg, color: style.color, fontWeight: 800, fontSize: 13,
        }}>
          {style.icon} {integrity.status}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: 500, lineHeight: 1.5 }}>
          {integrity.disclaimer}
        </div>
      </div>

      {/* SHA-256 hash */}
      <div style={{ background: 'var(--bg-workspace)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '12px 16px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>SHA-256</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <code style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: integrity.is_demo ? '#d97706' : 'var(--text-primary)', wordBreak: 'break-all', flex: 1, lineHeight: 1.5 }}>
            {integrity.sha256 ?? 'UNAVAILABLE'}
          </code>
          {integrity.sha256 && (
            <button
              onClick={handleCopy}
              title="Copy SHA-256"
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-default)', background: copied ? '#d1fae5' : 'var(--bg-card)', color: copied ? '#059669' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
            >
              <Copy size={11}/> {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      </div>

      {/* Metadata grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
        {metaRows.map(([k, v, mono]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'inherit', maxWidth: 200, textAlign: 'right', wordBreak: 'break-all' }}>
              {v || '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — EVIDENCE SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

function EvidenceSummarySection({ summary }: { summary: EvidenceSummary }) {
  const groups: { title: string; icon: React.ReactNode; items: string[]; color: string }[] = [
    { title: 'Network Evidence',  icon: <Globe size={16} />, items: summary.network_evidence,  color: 'var(--primary)' },
    { title: 'Temporal Evidence', icon: <Clock size={16} />,  items: summary.temporal_evidence, color: 'var(--secondary)' },
    { title: 'Entity Evidence',   icon: <Server size={16} />,  items: summary.entity_evidence,   color: '#10b981' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
      {groups.map(({ title, icon, items, color }) => (
        <div key={title} style={{ background: 'var(--bg-workspace)', borderRadius: 12, border: '1px solid var(--border-subtle)', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ color, display: 'inline-flex' }}>{icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color }}>{title}</span>
          </div>
          {items.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>No evidence items in this category.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((item, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5 }}/>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — ANTI-FORENSIC INDICATORS
// ═══════════════════════════════════════════════════════════════════════════

function AntiForensicSection({ indicators }: { indicators: AntiForensicIndicator[] }) {
  if (indicators.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
        <CheckCircle size={28} color="var(--color-live)" style={{ margin: '0 auto 8px auto', display: 'block' }} />
        No evidence-limitation or anti-forensic indicators detected.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Indicator note */}
      <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#92400e', lineHeight: 1.5 }}>
        <AlertTriangle size={11} style={{ display: 'inline', marginRight: 4 }}/>
        These are <strong>evidence-limitation indicators only</strong>. They do not confirm attacker intent. Each requires human expert assessment.
      </div>

      {/* Indicator cards */}
      {indicators.map((ind) => {
        const sevStyle = SEV_STYLE[ind.severity] ?? SEV_STYLE['LOW'];
        return (
          <div key={ind.id} style={{ background: 'var(--bg-card)', border: `1px solid ${sevStyle.border}`, borderLeft: `3px solid ${sevStyle.color}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: sevStyle.color }}>{ind.type}</span>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: sevStyle.bg, color: sevStyle.color, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  {ind.severity}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                {ind.timestamp !== null && (
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    <Clock size={9} style={{ display: 'inline', marginRight: 3 }}/>{tsToDateTime(ind.timestamp)}
                  </span>
                )}
                <ConfidencePill value={ind.confidence}/>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>{ind.description}</div>

            {(ind.source !== '—' || ind.destination !== '—') && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                {ind.source !== '—' && <IPTag label="Source" ip={ind.source}/>}
                {ind.destination !== '—' && <IPTag label="Destination" ip={ind.destination}/>}
              </div>
            )}

            <div style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-workspace)', borderRadius: 6, padding: '6px 10px', lineHeight: 1.5 }}>
              <strong>Evidence basis:</strong> {ind.evidence_basis}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — HYPOTHESES
// ═══════════════════════════════════════════════════════════════════════════

/** Checks an analyst runs to confirm or refute each hypothesis type (H1–H5 from the forensic engine). */
const VALIDATION_STEPS: Record<string, string[]> = {
  H1: [
    'Confirm the source is not an authorised vulnerability scanner (asset inventory / change calendar).',
    'In the capture, count distinct destination ports per source: many ports and few completed handshakes indicates a scan.',
  ],
  H2: [
    'Check the target host login logs (e.g. /var/log/auth.log, Windows 4625/4624) for failures, and for any success from the source.',
    'Confirm the connections are short-lived (few packets each). Long sessions suggest a successful login.',
  ],
  H3: [
    'Check the target for network logons from the source (Windows 4624 type 3/10) and new services (7045).',
    'Confirm the admin traffic does not come from an approved management host.',
  ],
  H4: [
    'Compare the outbound volume with this host\'s normal baseline.',
    'Identify who owns the destination (WHOIS / threat intel), and check proxy or DLP logs for the files involved.',
  ],
  H5: [
    'Measure the interval between connections. Regular timing (beaconing) supports C2.',
    'Look up the destinations or domains in threat intelligence.',
  ],
};

function validationSteps(h: Hypothesis): string[] {
  return VALIDATION_STEPS[h.title.slice(0, 2)] ?? ['Re-examine each supporting item in the raw capture before acting on this hypothesis.'];
}

/** Wireshark display filter for the hosts named in the evidence, so the analyst can verify it in the raw PCAP. */
function wiresharkFilter(h: Hypothesis): string | null {
  const text = [...h.supporting_evidence, h.description].join(' ');
  const ips = Array.from(new Set(text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) ?? [])).slice(0, 4);
  const ports = Array.from(new Set((text.match(/\bport[s]?\s+(\d{1,5})/gi) ?? []).map(m => m.replace(/\D/g, '')))).slice(0, 3);
  if (ips.length === 0) return null;
  const ipPart = ips.map(ip => `ip.addr == ${ip}`).join(' || ');
  const portPart = ports.length ? ` && (${ports.map(pt => `tcp.port == ${pt} || udp.port == ${pt}`).join(' || ')})` : '';
  return ips.length > 1 && portPart ? `(${ipPart})${portPart}` : `${ipPart}${portPart}`;
}

/** The engine's score, decomposed: base + 5 per supporting − 8 per contradicting − 3 per limitation, capped 0–90. */
function scoreBreakdown(h: Hypothesis): string {
  const s = h.supporting_evidence.length, c = h.contradicting_evidence.length, l = h.limitations.length;
  const base = h.confidence - 5 * s + 8 * c + 3 * l;
  const capped = h.confidence === 90 || h.confidence === 0;
  return `${capped ? '≈' : ''}base ${base} + ${s}×5 supporting − ${c}×8 contradicting − ${l}×3 limitations = ${h.confidence}%${capped ? ' (capped)' : ''}`;
}

const VERDICT_STYLE: Record<string, { color: string; bg: string }> = {
  Confirmed: { color: '#047857', bg: '#d1fae5' },
  Rejected: { color: '#b91c1c', bg: '#fee2e2' },
  'Needs more data': { color: '#b45309', bg: '#fef3c7' },
};

function HypothesesSection({ hypotheses }: { hypotheses: Hypothesis[] }) {
  const { expandedHypothesisId, toggleHypothesis, validations, validateHypothesis } = useForensicStore();
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (hypotheses.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
        No hypotheses generated — insufficient evidence to form an activity hypothesis.
      </div>
    );
  }

  const validated = hypotheses.filter(h => validations[h.id]).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        <span>
          <Info size={11} style={{ display: 'inline', marginRight: 4, color: 'var(--primary)' }}/>
          The engine <strong>proposes</strong> a verdict from the evidence weighting. You <strong>validate</strong> it with the checks listed for each hypothesis.
        </span>
        <span style={{ fontWeight: 700, color: validated === hypotheses.length ? '#047857' : 'var(--text-secondary)' }}>
          {validated}/{hypotheses.length} validated
        </span>
      </div>

      {hypotheses.map((hyp) => {
        const isExpanded = expandedHypothesisId === hyp.id;
        const statusStyle = HYP_STATUS_STYLE[hyp.status] ?? HYP_STATUS_STYLE['INSUFFICIENT_EVIDENCE'];
        const v = validations[hyp.id];
        const filter = wiresharkFilter(hyp);

        return (
          <div key={hyp.id} style={{ background: 'var(--bg-card)', border: `1px solid ${v ? VERDICT_STYLE[v.verdict].color + '55' : 'var(--border-default)'}`, borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <button
              onClick={() => toggleHypothesis(hyp.id)}
              aria-expanded={isExpanded}
              style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              {isExpanded ? <ChevronDown size={14} style={{ flexShrink: 0, marginTop: 3, color: 'var(--primary)' }}/> : <ChevronRight size={14} style={{ flexShrink: 0, marginTop: 3, color: 'var(--text-muted)' }}/>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{hyp.title}</span>
                  <span title="Engine verdict" style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: statusStyle.bg, color: statusStyle.color, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Engine: {hyp.status.replace('_', ' ')}
                  </span>
                  {v && (
                    <span title={v.note || 'Analyst validation'} style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: VERDICT_STYLE[v.verdict].bg, color: VERDICT_STYLE[v.verdict].color, textTransform: 'uppercase' }}>
                      Analyst: {v.verdict}
                    </span>
                  )}
                </div>
                {/* The claim is readable without expanding */}
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>{hyp.description}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, fontWeight: 600 }}>
                  <span style={{ color: '#059669' }}>+{hyp.supporting_evidence.length} supporting</span>
                  <span style={{ color: '#dc2626' }}>−{hyp.contradicting_evidence.length} contradicting</span>
                  <span style={{ color: '#b45309' }}>{hyp.limitations.length} gap{hyp.limitations.length === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div style={{ width: 90, flexShrink: 0, textAlign: 'right' }}>
                <ConfidencePill value={hyp.confidence}/>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-input)', marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${hyp.confidence}%`, height: '100%', background: statusStyle.color }} />
                </div>
              </div>
            </button>

            {isExpanded && (
              <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingTop: 10, fontFamily: 'var(--font-mono)' }}>
                  How the confidence was scored: {scoreBreakdown(hyp)}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                  <EvidenceColumn title="Supporting" items={hyp.supporting_evidence} sign="+" tone={{ fg: '#065f46', head: '#059669', bg: '#f0fdf4', border: '#bbf7d0' }} empty="No supporting evidence." icon={<CheckCircle size={12}/>} />
                  <EvidenceColumn title="Contradicting" items={hyp.contradicting_evidence} sign="−" tone={{ fg: '#991b1b', head: '#dc2626', bg: '#fef2f2', border: '#fecaca' }} empty="No contradicting evidence identified." icon={<XCircle size={12}/>} />
                  <EvidenceColumn title="Evidence gaps" items={hyp.limitations} sign="•" tone={{ fg: '#78350f', head: '#b45309', bg: '#fefce8', border: '#fde68a' }} empty="No gaps recorded." icon={<AlertTriangle size={12}/>} />
                </div>

                {/* Validation checklist */}
                <div style={{ background: 'var(--bg-workspace)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>How to validate</div>
                  <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {validationSteps(hyp).map((step, i) => <li key={i} style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{step}</li>)}
                  </ol>
                  {filter && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Wireshark filter:</span>
                      <code style={{ fontSize: 11, background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '2px 8px', fontFamily: 'var(--font-mono)' }}>{filter}</code>
                      <button type="button" onClick={() => navigator.clipboard?.writeText(filter)} style={{ ...ghostBtnStyle, padding: '3px 8px', fontSize: 11 }}>
                        <Copy size={11}/> Copy
                      </button>
                    </div>
                  )}
                </div>

                {/* Analyst verdict */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Analyst validation</div>
                  <input
                    type="text"
                    maxLength={500}
                    placeholder="Note (optional) — e.g. 'auth.log shows 0 successful logins'"
                    value={notes[hyp.id] ?? v?.note ?? ''}
                    onChange={e => setNotes(n => ({ ...n, [hyp.id]: e.target.value }))}
                    style={{ padding: '6px 10px', fontSize: 12, border: '1px solid var(--border-default)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(['Confirmed', 'Rejected', 'Needs more data'] as const).map(verdict => (
                      <button
                        key={verdict}
                        type="button"
                        onClick={() => validateHypothesis(hyp.id, verdict, notes[hyp.id] ?? v?.note ?? '')}
                        style={{
                          ...ghostBtnStyle, padding: '5px 12px', fontSize: 12,
                          ...(v?.verdict === verdict ? { background: VERDICT_STYLE[verdict].bg, color: VERDICT_STYLE[verdict].color, borderColor: VERDICT_STYLE[verdict].color } : {}),
                        }}
                      >
                        {verdict}
                      </button>
                    ))}
                    {v && (
                      <button type="button" onClick={() => validateHypothesis(hyp.id, null)} style={{ ...ghostBtnStyle, padding: '5px 12px', fontSize: 12 }}>
                        Clear
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    The validation is included in the generated report. A rejected hypothesis is left out of the report findings.
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EvidenceColumn({ title, items, sign, tone, empty, icon }: {
  title: string; items: string[]; sign: string; empty: string; icon: React.ReactNode;
  tone: { fg: string; head: string; bg: string; border: string };
}) {
  return (
    <div style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: tone.head, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
        {icon} {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>{empty}</div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((ev, i) => <li key={i} style={{ fontSize: 11.5, color: tone.fg, lineHeight: 1.5 }}>{sign} {ev}</li>)}
        </ul>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — FINAL ASSESSMENT
// ═══════════════════════════════════════════════════════════════════════════

function FinalAssessmentSection({ assessment }: { assessment: FinalAssessment }) {
  const conf = assessment.overall_confidence;
  const confColor = conf >= 65 ? '#059669' : conf >= 45 ? '#d97706' : '#94a3b8';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Prototype label */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: 'rgba(99,102,241,0.08)', color: 'var(--primary)', border: '1px solid rgba(99,102,241,0.2)', alignSelf: 'flex-start' }}>
        <Activity size={12} /> {assessment.prototype_label}
      </div>

      {/* Assessment text + confidence */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
        <div style={{ background: 'var(--bg-workspace)', borderRadius: 12, border: '1px solid var(--border-subtle)', padding: '16px' }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, fontWeight: 500 }}>
            {assessment.assessment_text}
          </div>
        </div>

        {/* Confidence gauge */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, padding: '16px', minWidth: 120, textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 8px' }}>
            <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border-subtle)" strokeWidth="7"/>
              <circle cx="40" cy="40" r="32" fill="none" stroke={confColor} strokeWidth="7"
                strokeDasharray={`${(conf / 100) * 201.1} 201.1`} strokeLinecap="round"/>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 900, color: confColor }}>{conf}%</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Confidence
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
            Heuristic estimate
          </div>
        </div>
      </div>

      {/* Key evidence */}
      {assessment.key_evidence.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Key Evidence</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {assessment.key_evidence.map((ev, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 5 }}/>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ev}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Limitations */}
      {assessment.limitations.length > 0 && (
        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#b45309', marginBottom: 10 }}>
            <AlertTriangle size={14} /> Limitations
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {assessment.limitations.map((lim, i) => (
              <li key={i} style={{ fontSize: 11, color: '#78350f', lineHeight: 1.5 }}>• {lim}</li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function ForensicSection({
  title, icon, subtitle, children, badge,
}: {
  title: string;
  icon: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  badge?: { label: string; color: string; bg: string };
}) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ color: 'var(--primary)' }}>{icon}</span>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
          </div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 24 }}>{subtitle}</div>}
        </div>
        {badge && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: badge.bg, color: badge.color, border: `1px solid ${badge.color}40` }}>
            {badge.label}
          </span>
        )}
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  );
}

function ConfidencePill({ value }: { value: number }) {
  const color = value >= 65 ? '#059669' : value >= 45 ? '#d97706' : '#94a3b8';
  const bg    = value >= 65 ? '#d1fae5' : value >= 45 ? '#fef3c7' : 'var(--bg-input)';
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: bg, color, border: `1px solid ${color}40`, flexShrink: 0 }}>
      {value}% conf.
    </span>
  );
}

function IPTag({ label, ip }: { label: string; ip: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}:</span>
      <code style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--primary)', background: 'rgba(99,102,241,0.08)', padding: '1px 6px', borderRadius: 4 }}>{ip}</code>
    </div>
  );
}

function SimulatedBadge() {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: 'rgba(245,158,11,0.1)', color: '#92400e', border: '1px solid rgba(245,158,11,0.4)', display: 'flex', alignItems: 'center', gap: 5 }}>
      <AlertTriangle size={12} /> SIMULATED EVIDENCE
    </div>
  );
}

// ── Style constants ────────────────────────────────────────────────────────────

const ghostBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8,
  background: 'var(--bg-workspace)', border: '1px solid var(--border-default)',
  color: 'var(--text-secondary)', cursor: 'pointer',
};
