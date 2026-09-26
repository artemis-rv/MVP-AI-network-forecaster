// NEXTRACE AI — Report Preview Page (Step 8)
// Route: /reports/:reportId
// Renders findings summary, section cards, and export controls.
// Completely isolated from live, historical, forensic, and simulation pages.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText, Download, ChevronDown, ChevronRight,
  ArrowLeft, Shield, AlertTriangle, Info, CheckCircle,
  XCircle, Activity, BarChart2, Filter,
} from 'lucide-react';
import { useFindingsStore, getFilteredFindings } from '@/store/findingsStore';
import type { Finding, Report, ReportSection, FindingSeverity, FindingCategory } from '@/types/report';
import { generateSecurityReportPdf } from '@/utils/pdfGenerator';
import { StageMap, type StageMapItem } from '@/components/activity/StageMap';

// ── Design tokens (reuse NEXTRACE AI palette) ─────────────────────────────────
const SEV: Record<FindingSeverity, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: '#b91c1c', bg: '#fee2e2',  border: '#fca5a5' },
  HIGH:     { color: '#dc2626', bg: '#fee2e2',  border: '#fca5a5' },
  MEDIUM:   { color: '#d97706', bg: '#fef3c7',  border: '#fcd34d' },
  LOW:      { color: '#059669', bg: '#d1fae5',  border: '#6ee7b7' },
};

function tsLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function safeFilename(s: string): string {
  return s.replace(/[^a-z0-9_\-]/gi, '-').toLowerCase().replace(/-+/g, '-');
}

// ── Export helpers ─────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<Report['report_type'], string> = {
  historical: 'Historical Forensic',
  simulation: 'Simulation',
  live:       'Live Session',
};

function exportJSON(report: Report) {
  const prefix = `nextrace-${report.report_type}-${report.source_id}`;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${safeFilename(prefix)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mdValue(key: string, val: any): string[] {
  const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  if (val === null || val === undefined || val === '') return [];
  if (typeof val !== 'object') return [`**${label}:** ${String(val)}`, ''];
  if (!Array.isArray(val)) return [`**${label}:**`, '', '```json', JSON.stringify(val, null, 2), '```', ''];
  if (val.length === 0) return [];
  if (val.every(v => typeof v !== 'object' || v === null)) return [`**${label}:**`, '', ...val.map(v => `- ${String(v)}`), ''];
  const cols = Array.from(new Set(val.flatMap(v => Object.keys(v))));
  const cell = (v: unknown) => (Array.isArray(v) ? v.join(', ') : v === null || v === undefined ? '—' : String(v)).replace(/\|/g, '\\|');
  return [
    `**${label}:**`, '',
    `| ${cols.join(' | ')} |`,
    `| ${cols.map(() => '---').join(' | ')} |`,
    ...val.map(v => `| ${cols.map(c => cell(v[c])).join(' | ')} |`),
    '',
  ];
}

function exportMarkdown(report: Report) {
  const sevCount = (s: FindingSeverity) => report.findings.filter(f => f.severity === s).length;
  const lines: string[] = [
    `# ${report.title}`,
    `**Type:** ${TYPE_LABEL[report.report_type]} | **Generated:** ${tsLabel(report.generated_at)} | **ID:** \`${report.report_id}\``,
    '',
  ];
  if (report.metadata.kpis?.length) {
    lines.push(`| ${report.metadata.kpis.map(k => k.label).join(' | ')} |`);
    lines.push(`| ${report.metadata.kpis.map(() => '---').join(' | ')} |`);
    lines.push(`| ${report.metadata.kpis.map(k => k.value).join(' | ')} |`, '');
  }
  lines.push(
    '## Findings',
    `Critical ${sevCount('CRITICAL')} · High ${sevCount('HIGH')} · Medium ${sevCount('MEDIUM')} · Low ${sevCount('LOW')}`,
    '',
    '| Severity | Category | Confidence | Finding |',
    '|---|---|---|---|',
    ...report.findings.map(f => `| ${f.severity} | ${f.category} | ${f.confidence}% | **${f.title}** — ${f.summary.replace(/\n/g, ' ').replace(/\|/g, '\\|')} |`),
    '',
  );
  for (const sec of [...report.sections].sort((a, b) => a.order - b.order)) {
    lines.push(`## ${sec.order}. ${sec.title}`, '');
    for (const [k, v] of Object.entries(sec.content)) lines.push(...mdValue(k, v));
    if (sec.evidence_refs.length) lines.push(`_Evidence: ${sec.evidence_refs.join(', ')}_`, '');
  }
  lines.push('---', '', `> ${report.disclaimer}`, '');

  const md   = lines.join('\n');
  const prefix = `nextrace-${report.report_type}-${report.source_id}`;
  const blob = new Blob([md], { type: 'text/markdown' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${safeFilename(prefix)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export function ReportPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate     = useNavigate();
  const {
    report, loading, error,
    filterSeverity, filterCategory,
    selectedFindingId,
    fetchReport, setFilterSeverity, setFilterCategory, selectFinding, clearFindings,
  } = useFindingsStore();

  useEffect(() => {
    if (reportId) fetchReport(reportId);
    return () => clearFindings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const storeSnapshot = useFindingsStore.getState();
  const filtered      = report ? getFilteredFindings({
    ...storeSnapshot,
    findings: report.findings,
    filterSeverity,
    filterCategory,
  }) : [];

  const isSim        = report?.report_type === 'simulation';

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState error={error} onBack={() => navigate(-1)} />;
  if (!report) return <NotFoundState onBack={() => navigate(-1)} />;

  const total    = report.findings.length;
  const critical = report.findings.filter(f => f.severity === 'CRITICAL').length;
  const high     = report.findings.filter(f => f.severity === 'HIGH').length;
  const medium   = report.findings.filter(f => f.severity === 'MEDIUM').length;
  const low      = report.findings.filter(f => f.severity === 'LOW').length;

  const selectedFinding = report.findings.find(f => f.id === selectedFindingId) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Header ── */}
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button onClick={() => navigate(-1)} style={ghostBtnStyle}>
              <ArrowLeft size={12} /> Back
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                {report.title}
              </h1>
              {isSim && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
                  background: 'rgba(239,68,68,0.12)', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.3)' }}>
                  SIMULATION ONLY
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Mono>{report.report_id}</Mono>
              <TypeBadge type={report.report_type} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Generated: {tsLabel(report.generated_at)}
              </span>
              <StatusBadge status={report.status} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, paddingTop: 4 }}>
            <button id="export-json-btn" onClick={() => exportJSON(report)} className="btn-export">
              <Download size={13} /> Export JSON
            </button>
            <button id="export-md-btn" onClick={() => exportMarkdown(report)} className="btn-export">
              <Download size={13} /> Export MD
            </button>
            <button id="export-pdf-btn" onClick={() => generateSecurityReportPdf(report)} className="btn-export-pdf">
              <Download size={13} /> Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── Simulation disclaimer banner ── */}
      {isSim && (
        <div style={{ margin: '16px 0', padding: '12px 18px', borderRadius: 10,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} color="#dc2626" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
            SIMULATION ONLY — NO REAL NETWORK TRAFFIC WAS GENERATED. All data is synthetic.
          </span>
        </div>
      )}

      {/* ── Metadata card ── */}
      <div style={{ ...card, marginTop: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
          Report Metadata
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <MetaItem label="Source ID"       value={<Mono>{report.source_id}</Mono>} />
          <MetaItem label="Source Type"     value={TYPE_LABEL[report.report_type]} />
          <MetaItem label="Generated"       value={tsLabel(report.generated_at)} />
          <MetaItem label="Analysis Status" value={report.metadata.analysis_status ?? report.metadata.status ?? 'completed'} />
          {report.metadata.investigation_id && (
            <MetaItem label="Investigation" value={<Mono>{report.metadata.investigation_id}</Mono>} />
          )}
          {report.metadata.entity_ip && (
            <MetaItem label="Entity" value={<Mono>{report.metadata.entity_ip}</Mono>} />
          )}
          {report.metadata.capture_source && (
            <MetaItem label="Capture Source" value={report.metadata.capture_source} />
          )}
          {report.metadata.filename && (
            <MetaItem label="File" value={report.metadata.filename} />
          )}
          {report.metadata.scenario && (
            <MetaItem label="Scenario" value={report.metadata.scenario} />
          )}
          {report.metadata.k !== undefined && (
            <MetaItem label="K (stages)" value={String(report.metadata.k)} />
          )}
          {report.metadata.forensic_id && (
            <MetaItem label="Forensic ID" value={<Mono>{report.metadata.forensic_id}</Mono>} />
          )}
        </div>
      </div>

      {/* ── Headline figures from the analysed data ── */}
      {report.metadata.kpis && report.metadata.kpis.length > 0 && (
        <div data-tour="report-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[...report.metadata.kpis, { label: 'Findings', value: `${total} (${critical + high} high+)`, tone: undefined }].map(k => (
            <div key={k.label} style={{ ...card, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2, color: k.tone === 'critical' ? '#b91c1c' : k.tone === 'high' ? '#c2410c' : 'var(--text-primary)' }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Findings Summary KPI cards (reports without headline figures, e.g. backend-generated) ── */}
      {!report.metadata.kpis?.length && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Total Findings" value={total}    color="var(--primary)"    icon={<BarChart2 size={18}/>} />
        <KpiCard label="High / Critical" value={critical + high} color="#dc2626" icon={<Shield size={18}/>} />
        <KpiCard label="Medium"          value={medium}  color="#d97706"           icon={<AlertTriangle size={18}/>} />
        <KpiCard label="Low"             value={low}     color="#059669"           icon={<CheckCircle size={18}/>} />
      </div>}

      {/* ── Findings Table ── */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Findings ({filtered.length} of {total})
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Filter size={13} color="var(--text-muted)" />
            <select
              value={filterSeverity}
              onChange={e => setFilterSeverity(e.target.value as FindingSeverity | 'ALL')}
              style={selectStyle}
              id="filter-severity-select"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as FindingCategory | 'ALL')}
              style={selectStyle}
              id="filter-category-select"
            >
              <option value="ALL">All Categories</option>
              <option value="Network Activity">Network Activity</option>
              <option value="Suspicious Activity">Suspicious Activity</option>
              <option value="Attack Progression">Attack Progression</option>
              <option value="Evidence Integrity">Evidence Integrity</option>
              <option value="Anti-Forensic Indicator">Anti-Forensic</option>
              <option value="Hypothesis">Hypothesis</option>
              <option value="Forecast">Forecast</option>
              <option value="Simulation">Simulation</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-workspace)' }}>
                {['Severity', 'Category', 'Finding', 'Confidence', 'Source'].map(col => (
                  <th key={col} style={thStyle}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No findings match the current filters.
                </td></tr>
              )}
              {filtered.map(f => (
                <FindingRow
                  key={f.id}
                  finding={f}
                  isSelected={selectedFindingId === f.id}
                  onClick={() => selectFinding(selectedFindingId === f.id ? null : f.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Finding Detail Panel ── */}
      {selectedFinding && (
        <FindingDetailPanel
          finding={selectedFinding}
          onClose={() => selectFinding(null)}
        />
      )}

      {/* ── Report Sections ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Report Sections
        </h2>
        {report.sections.map(s => (
          <SectionCard key={s.order} section={s} />
        ))}
      </div>

      {/* ── Disclaimer ── */}
      <div style={{
        marginBottom: 32, padding: '16px 20px', borderRadius: 10,
        background: isSim ? 'rgba(239,68,68,0.06)' : 'rgba(99,102,241,0.06)',
        border: `1px solid ${isSim ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.25)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          {isSim
            ? <AlertTriangle size={15} color="#dc2626" />
            : <Info size={15} color="var(--primary)" />
          }
          <span style={{ fontSize: 12, fontWeight: 700, color: isSim ? '#dc2626' : 'var(--primary)' }}>
            {isSim ? 'SIMULATION DISCLAIMER' : report.report_type === 'live' ? 'PROTOTYPE SESSION DISCLAIMER' : 'PROTOTYPE FORENSIC DISCLAIMER'}
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          {report.disclaimer}
        </p>
      </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function FindingRow({
  finding, isSelected, onClick,
}: { finding: Finding; isSelected: boolean; onClick: () => void }) {
  const s = SEV[finding.severity] ?? SEV.LOW;
  return (
    <tr
      onClick={onClick}
      style={{
        borderTop: '1px solid var(--border-subtle)',
        background: isSelected ? 'rgba(99,102,241,0.06)' : 'transparent',
        cursor: 'pointer',
        transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-workspace)'; }}
      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <td style={{ padding: '10px 14px' }}>
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
          background: s.bg, color: s.color, border: `1px solid ${s.border}`,
        }}>
          {finding.severity}
        </span>
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {finding.category}
      </td>
      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, maxWidth: 340 }}>
        {finding.title}
        {isSelected && <ChevronDown size={11} style={{ marginLeft: 6, color: 'var(--primary)' }} />}
        {!isSelected && <ChevronRight size={11} style={{ marginLeft: 6, color: 'var(--text-muted)' }} />}
      </td>
      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
        <ConfidencePill value={finding.confidence} />
      </td>
      <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
        {finding.source_type} / {finding.source_id.slice(0, 16)}
      </td>
    </tr>
  );
}

function FindingDetailPanel({ finding, onClose }: { finding: Finding; onClose: () => void }) {
  const s = SEV[finding.severity] ?? SEV.LOW;
  return (
    <div style={{
      ...card,
      marginBottom: 16,
      border: `1px solid ${s.border}`,
      background: s.bg + '33',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
            {finding.severity}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-workspace)', padding: '2px 8px', borderRadius: 999, border: '1px solid var(--border-subtle)' }}>
            {finding.category}
          </span>
          <ConfidencePill value={finding.confidence} />
        </div>
        <button onClick={onClose} style={{ ...ghostBtnStyle, padding: '4px 10px', fontSize: 11 }}>
          <XCircle size={12} /> Close
        </button>
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
        {finding.title}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
        {finding.summary}
      </p>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Evidence References
        </div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {finding.evidence.filter(Boolean).map((e, i) => (
            <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, fontFamily: e.startsWith('Source:') || e.startsWith('Simulation') ? 'var(--font-mono)' : undefined }}>
              {e}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const OPEN_BY_DEFAULT = new Set(['Investigation Scope', 'Attack Stage Map', 'Affected Assets', 'Recommended Actions']);

function SectionCard({ section }: { section: ReportSection }) {
  const [expanded, setExpanded] = useState(section.order <= 2 || OPEN_BY_DEFAULT.has(section.title));

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', textAlign: 'left', padding: '14px 20px',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: expanded ? '1px solid var(--border-subtle)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
            background: 'var(--primary-light)', color: 'var(--primary)',
            minWidth: 22, textAlign: 'center',
          }}>
            {section.order}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {section.title}
          </span>
        </div>
        {expanded ? <ChevronDown size={15} color="var(--text-muted)" /> : <ChevronRight size={15} color="var(--text-muted)" />}
      </button>

      {expanded && (
        <div style={{ padding: '16px 20px' }}>
          <SectionContent content={section.content} />
          {section.evidence_refs.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Evidence References
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {section.evidence_refs.map((ref, i) => (
                  <span key={i} style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 999,
                    background: 'var(--bg-workspace)', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                  }}>
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SectionContent({ content }: { content: Record<string, any> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Object.entries(content).map(([key, val]) => {
        if (val === null || val === undefined) return null;
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        if (typeof val === 'string') {
          if (val.length === 0) return null;
          return (
            <div key={key}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {label}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {val}
              </div>
            </div>
          );
        }

        if (typeof val === 'number' || typeof val === 'boolean') {
          return (
            <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {label}:
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, fontFamily: typeof val === 'number' ? 'var(--font-mono)' : undefined }}>
                {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : val.toLocaleString()}
              </span>
            </div>
          );
        }

        if (key === 'stage_map' && Array.isArray(val)) {
          return <StageMap key={key} items={val as StageMapItem[]} />;
        }
        if (key === 'assets' && Array.isArray(val)) {
          if (val.length === 0) return null;
          return <AssetTable key={key} rows={val} />;
        }
        if (key === 'actions' && Array.isArray(val)) {
          if (val.length === 0) return null;
          return <ActionList key={key} rows={val} />;
        }

        if (Array.isArray(val)) {
          if (val.length === 0) return null;
          const isStringArray = val.every(v => typeof v === 'string');

          if (isStringArray) {
            return (
              <div key={key}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  {label} ({val.length})
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {(val as string[]).slice(0, 10).map((v, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>{v}</li>
                  ))}
                  {val.length > 10 && (
                    <li style={{ fontSize: 12, color: 'var(--text-muted)' }}>… and {val.length - 10} more</li>
                  )}
                </ul>
              </div>
            );
          }

          // Array of objects — show as JSON snippet
          return (
            <div key={key}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {label} ({val.length} items)
              </div>
              <pre style={{
                fontSize: 11, background: 'var(--bg-workspace)', border: '1px solid var(--border-subtle)',
                borderRadius: 6, padding: '10px 14px', overflow: 'auto',
                maxHeight: 240, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', margin: 0,
              }}>
                {JSON.stringify(val.slice(0, 5), null, 2)}
                {val.length > 5 ? `\n// … ${val.length - 5} more items` : ''}
              </pre>
            </div>
          );
        }

        // Object
        return (
          <div key={key}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {label}
            </div>
            <pre style={{
              fontSize: 11, background: 'var(--bg-workspace)', border: '1px solid var(--border-subtle)',
              borderRadius: 6, padding: '10px 14px', overflow: 'auto',
              maxHeight: 200, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', margin: 0,
            }}>
              {JSON.stringify(val, null, 2)}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

const PRIORITY_COLOR: Record<string, string> = { Immediate: '#b91c1c', Next: '#b45309', 'Follow-up': 'var(--text-muted)' };

function AssetTable({ rows }: { rows: { ip: string; role: string; impact: string; severity: FindingSeverity; activities: string[] }[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-workspace)' }}>
            {['Asset', 'Role', 'Impact', 'Severity', 'Activities'].map(c => <th key={c} style={thStyle}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.ip} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{r.ip}</td>
              <td style={tdStyle}>{r.role}</td>
              <td style={tdStyle}>{r.impact}</td>
              <td style={tdStyle}><span style={{ fontSize: 10, fontWeight: 800, color: SEV[r.severity]?.color }}>{r.severity}</span></td>
              <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.activities.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionList({ rows }: { rows: { priority: string; action: string; rationale: string; activities: string[] }[] }) {
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((r, i) => (
        <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-workspace)' }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: PRIORITY_COLOR[r.priority], border: `1px solid ${PRIORITY_COLOR[r.priority]}`, borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap', marginTop: 2 }}>
            {r.priority.toUpperCase()}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45 }}>{r.action}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {r.rationale} <span style={{ fontFamily: 'var(--font-mono)' }}>· {r.activities.join(', ')}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Utility components ────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 14 }}>
      <Activity size={32} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading report…</span>
    </div>
  );
}

function ErrorState({ error, onBack }: { error: string; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 14 }}>
      <XCircle size={32} color="#dc2626" />
      <span style={{ fontSize: 14, color: '#dc2626', fontWeight: 600 }}>Failed to load report</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 400, textAlign: 'center' }}>{error}</span>
      <button onClick={onBack} style={ghostBtnStyle}><ArrowLeft size={12} /> Go back</button>
    </div>
  );
}

function NotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 14 }}>
      <FileText size={32} color="var(--text-muted)" />
      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>No report generated yet.</span>
      <button onClick={onBack} style={ghostBtnStyle}><ArrowLeft size={12} /> Go back</button>
    </div>
  );
}

function KpiCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)',
      padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </span>
        <span style={{ color }}>{icon}</span>
      </div>
      <span style={{ fontSize: 26, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--primary)', background: 'rgba(99,102,241,0.08)', padding: '2px 8px', borderRadius: 4 }}>
      {children}
    </code>
  );
}

function TypeBadge({ type }: { type: Report['report_type'] }) {
  const isSim = type === 'simulation';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
      background: isSim ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
      color: isSim ? '#dc2626' : 'var(--primary)',
      border: `1px solid ${isSim ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}`,
    }}>
      {TYPE_LABEL[type].toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === 'GENERATED';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600,
      color: ok ? 'var(--color-live)' : '#dc2626',
    }}>
      {ok ? <CheckCircle size={11} /> : <XCircle size={11} />}
      {status}
    </span>
  );
}

function ConfidencePill({ value }: { value: number }) {
  const color = value >= 65 ? '#059669' : value >= 45 ? '#d97706' : '#94a3b8';
  const bg    = value >= 65 ? '#d1fae5' : value >= 45 ? '#fef3c7' : 'var(--bg-input)';
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: bg, color, border: `1px solid ${color}40` }}>
      {value}% conf.
    </span>
  );
}

// ── Style constants ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)', padding: '16px 20px',
};

const ghostBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8,
  background: 'var(--bg-workspace)', border: '1px solid var(--border-default)',
  color: 'var(--text-secondary)', cursor: 'pointer',
};

const thStyle: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: 11,
  fontWeight: 600, color: 'var(--text-muted)',
  letterSpacing: '0.4px', textTransform: 'uppercase', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', verticalAlign: 'top',
};

const selectStyle: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border-default)',
  background: 'var(--bg-workspace)', color: 'var(--text-primary)', fontSize: 12,
  fontFamily: 'var(--font-sans)', cursor: 'pointer',
};
