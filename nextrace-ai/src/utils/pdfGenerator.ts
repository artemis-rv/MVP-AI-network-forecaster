// NEXTRACE AI — SOC report PDF
// Renders a Report exactly as the report page shows it: headline figures, executive summary,
// attack stage map, findings, affected assets, recommended actions, then every remaining section.
// Everything printed comes from the report object — no placeholder or demo content — and the
// document grows to as many pages as the data needs.

import { jsPDF } from 'jspdf';
import type { Report, Finding, ReportSection, ReportKpi } from '@/types/report';

export interface SecurityReportData {
  title?: string;
  reportId?: string;
  generatedAt?: number | string;
  findings?: Finding[];
}

// ── Layout constants (mm, A4 portrait) ────────────────────────────────────────
const PAGE_W = 210;
const LEFT = 14;
const RIGHT = 196;
const WIDTH = RIGHT - LEFT;
const TOP = 18;
const BOTTOM = 278;

type RGB = [number, number, number];
const NAVY: RGB = [18, 58, 122];
const BLUE: RGB = [11, 99, 206];
const INK: RGB = [15, 23, 42];
const MUTED: RGB = [100, 116, 139];
const BORDER: RGB = [226, 232, 240];
const PANEL: RGB = [248, 250, 252];
const SEVERITY: Record<string, RGB> = {
  CRITICAL: [185, 28, 28], HIGH: [194, 65, 12], MEDIUM: [180, 83, 9], LOW: [4, 120, 87],
};
const PRIORITY: Record<string, RGB> = { Immediate: [185, 28, 28], Next: [180, 83, 9], 'Follow-up': [100, 116, 139] };

/** Standard PDF fonts only cover Windows-1252; map the few symbols the app uses and drop the rest. */
const PDF_EXTRA = new Set('—–…·•‘’“”×€');

function pdfText(v: unknown): string {
  const mapped = String(v ?? '')
    .replace(/→/g, '->').replace(/←/g, '<-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/✓/g, 'OK');
  let out = '';
  for (const ch of mapped) {
    const c = ch.codePointAt(0) ?? 0;
    if (c === 9 || c === 10 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || PDF_EXTRA.has(ch)) out += ch;
  }
  return out;
}

function label(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

class PdfWriter {
  doc: jsPDF;
  y = TOP;
  constructor(private headerRight: string) {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    this.header();
  }

  private header() {
    const d = this.doc;
    d.setFillColor(...NAVY); d.rect(0, 0, PAGE_W, 11, 'F');
    d.setFillColor(...BLUE); d.rect(0, 11, PAGE_W, 1.2, 'F');
    d.setTextColor(255, 255, 255); d.setFont('helvetica', 'bold'); d.setFontSize(7.5);
    d.text('NEXTRACE AI — SOC REPORT', LEFT, 7.5);
    d.setFont('helvetica', 'normal'); d.setFontSize(6.8);
    d.text(pdfText(this.headerRight), RIGHT, 7.5, { align: 'right' });
    this.y = TOP;
  }

  ensure(h: number) {
    if (this.y + h > BOTTOM) { this.doc.addPage(); this.header(); }
  }

  lines(text: string, width: number, size: number): string[] {
    this.doc.setFontSize(size);
    return this.doc.splitTextToSize(pdfText(text), width) as string[];
  }

  section(title: string) {
    this.ensure(16);
    this.y += 3;
    const d = this.doc;
    d.setFillColor(...NAVY); d.rect(LEFT, this.y, WIDTH, 7.5, 'F');
    d.setTextColor(255, 255, 255); d.setFont('helvetica', 'bold'); d.setFontSize(9.5);
    d.text(pdfText(title.toUpperCase()), LEFT + 4, this.y + 5.2);
    this.y += 11;
  }

  subheading(text: string) {
    this.ensure(10);
    const d = this.doc;
    this.y += 1.5;
    d.setFont('helvetica', 'bold'); d.setFontSize(7.5); d.setTextColor(...MUTED);
    // Baseline below the cursor, so the heading never overlaps the line above it.
    d.text(pdfText(text.toUpperCase()), LEFT, this.y + 3);
    this.y += 5.5;
  }

  paragraph(text: string, opts: { size?: number; bold?: boolean; color?: RGB; indent?: number } = {}) {
    const size = opts.size ?? 8.5;
    const indent = opts.indent ?? 0;
    const ls = this.lines(text, WIDTH - indent, size);
    const lh = size * 0.42;
    const d = this.doc;
    for (const line of ls) {
      this.ensure(lh + 1);
      d.setFont('helvetica', opts.bold ? 'bold' : 'normal'); d.setFontSize(size); d.setTextColor(...(opts.color ?? INK));
      d.text(line, LEFT + indent, this.y + lh * 0.8);
      this.y += lh;
    }
    this.y += 1.5;
  }

  bullet(text: string, color: RGB = BLUE) {
    const size = 8;
    const ls = this.lines(text, WIDTH - 6, size);
    const lh = size * 0.42;
    this.ensure(lh + 1);
    this.doc.setFillColor(...color); this.doc.circle(LEFT + 1.5, this.y + lh * 0.55, 0.7, 'F');
    for (const line of ls) {
      this.ensure(lh + 1);
      this.doc.setFont('helvetica', 'normal'); this.doc.setFontSize(size); this.doc.setTextColor(...INK);
      this.doc.text(line, LEFT + 5, this.y + lh * 0.8);
      this.y += lh;
    }
    this.y += 1;
  }

  keyValue(k: string, v: string) {
    const size = 8;
    const ls = this.lines(v, WIDTH - 50, size);
    const lh = size * 0.42;
    this.ensure(lh * ls.length + 1);
    const d = this.doc;
    d.setFont('helvetica', 'bold'); d.setFontSize(7.5); d.setTextColor(...MUTED);
    d.text(pdfText(k), LEFT, this.y + lh * 0.8);
    d.setFont('helvetica', 'normal'); d.setFontSize(size); d.setTextColor(...INK);
    ls.forEach((line, i) => d.text(line, LEFT + 50, this.y + lh * 0.8 + i * lh));
    this.y += lh * ls.length + 1.2;
  }

  /** Simple bordered table; each row grows to fit its wrapped cells. */
  table(cols: string[], widths: number[], rows: string[][], rowColor?: (r: number) => RGB | null) {
    const d = this.doc;
    const size = 7.5;
    const lh = size * 0.42;
    const drawHead = () => {
      this.ensure(7);
      d.setFillColor(...PANEL); d.rect(LEFT, this.y, WIDTH, 6, 'F');
      d.setFont('helvetica', 'bold'); d.setFontSize(7); d.setTextColor(...MUTED);
      let x = LEFT + 2;
      cols.forEach((c, i) => { d.text(pdfText(c.toUpperCase()), x, this.y + 4); x += widths[i]; });
      this.y += 6;
    };
    drawHead();
    rows.forEach((row, r) => {
      const wrapped = row.map((cell, i) => this.lines(cell, widths[i] - 3, size));
      const h = Math.max(...wrapped.map(w => w.length)) * lh + 3;
      if (this.y + h > BOTTOM) { d.addPage(); this.header(); drawHead(); }
      d.setDrawColor(...BORDER); d.line(LEFT, this.y + h, RIGHT, this.y + h);
      const stripe = rowColor?.(r);
      if (stripe) { d.setFillColor(...stripe); d.rect(LEFT, this.y, 1.2, h, 'F'); }
      let x = LEFT + 2;
      wrapped.forEach((ls, i) => {
        d.setFont('helvetica', i === 0 ? 'bold' : 'normal'); d.setFontSize(size); d.setTextColor(...INK);
        ls.forEach((line, j) => d.text(line, x, this.y + 2 + lh * 0.8 + j * lh));
        x += widths[i];
      });
      this.y += h;
    });
    this.y += 3;
  }

  footers() {
    const d = this.doc;
    const n = d.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      d.setPage(i);
      d.setDrawColor(...BORDER); d.line(LEFT, 283, RIGHT, 283);
      d.setFont('helvetica', 'normal'); d.setFontSize(8); d.setTextColor(...MUTED);
      d.text('CONFIDENTIAL — SOC SECURITY REPORT | FOR INTERNAL USE ONLY', LEFT, 288);
      d.text(`Page ${i} of ${n}`, RIGHT, 288, { align: 'right' });
    }
  }
}

// ── Section helpers ───────────────────────────────────────────────────────────

const RENDERED_FIRST = new Set(['Executive Summary', 'Attack Stage Map', 'Affected Assets', 'Recommended Actions']);

function sectionByTitle(report: Report, title: string): ReportSection | undefined {
  return report.sections.find(s => s.title === title);
}

function envLabel(report: Report | null): string {
  if (!report) return 'REPORT';
  if (report.report_type === 'simulation') return 'SIMULATION';
  if (report.report_type === 'live') return 'LIVE SESSION (SIMULATED TRAFFIC)';
  return report.metadata.is_demo ? 'HISTORICAL PCAP (DEMO DATASET)' : 'HISTORICAL PCAP';
}

/** Headline figures: from the report builder, or derived from backend-generated report sections. */
function kpisOf(report: Report): ReportKpi[] {
  if (report.metadata.kpis?.length) return report.metadata.kpis;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pick = (...keys: string[]): any => {
    for (const s of report.sections) for (const k of keys) if (s.content?.[k] !== undefined && s.content[k] !== null) return s.content[k];
    return undefined;
  };
  const kpis: ReportKpi[] = [];
  const packets = pick('packet_count', 'total_packets', 'packets');
  const flows = pick('flow_count', 'total_flows', 'flows');
  const duration = pick('duration_seconds');
  if (packets !== undefined) kpis.push({ label: 'Packets', value: Number(packets).toLocaleString() });
  if (flows !== undefined) kpis.push({ label: 'Flows', value: Number(flows).toLocaleString() });
  if (duration !== undefined) kpis.push({ label: 'Duration', value: `${Number(duration).toFixed(1)}s` });
  kpis.push({ label: 'Findings', value: String(report.findings.length) });
  kpis.push({ label: 'Critical', value: String(report.findings.filter(f => f.severity === 'CRITICAL').length), tone: 'critical' });
  kpis.push({ label: 'High', value: String(report.findings.filter(f => f.severity === 'HIGH').length), tone: 'high' });
  return kpis.slice(0, 6);
}

function renderKpis(w: PdfWriter, kpis: ReportKpi[]) {
  const d = w.doc;
  const gap = 2;
  const bw = (WIDTH - gap * (kpis.length - 1)) / kpis.length;
  w.ensure(16);
  kpis.forEach((k, i) => {
    const x = LEFT + i * (bw + gap);
    d.setFillColor(...PANEL); d.rect(x, w.y, bw, 14, 'F');
    d.setDrawColor(...BORDER); d.rect(x, w.y, bw, 14, 'S');
    d.setFont('helvetica', 'bold'); d.setFontSize(6.5); d.setTextColor(...MUTED);
    d.text(pdfText(k.label.toUpperCase()), x + 3, w.y + 5);
    d.setFontSize(11.5);
    d.setTextColor(...(k.tone === 'critical' ? SEVERITY.CRITICAL : k.tone === 'high' ? SEVERITY.HIGH : BLUE));
    d.text(pdfText(k.value), x + 3, w.y + 11);
  });
  w.y += 18;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderStageMap(w: PdfWriter, items: any[]) {
  const d = w.doc;
  const gap = 3;
  const bw = (WIDTH - gap * (items.length - 1)) / items.length;
  const h = 18;
  w.ensure(h + 4);
  items.forEach((m, i) => {
    const x = LEFT + i * (bw + gap);
    const observed = m.status === 'observed';
    const predicted = m.status === 'predicted';
    const color: RGB = observed ? (SEVERITY[m.severity] ?? BLUE) : predicted ? [217, 119, 6] : BORDER;
    d.setFillColor(...(observed ? color : PANEL)); d.rect(x, w.y, bw, h, 'F');
    d.setDrawColor(...color);
    if (predicted) d.setLineDashPattern([1, 1], 0);
    d.rect(x, w.y, bw, h, 'S');
    d.setLineDashPattern([], 0);
    d.setFont('helvetica', 'bold'); d.setFontSize(6);
    d.setTextColor(...(observed ? [255, 255, 255] as RGB : predicted ? color : MUTED));
    d.text(observed ? 'OBSERVED' : predicted ? 'PREDICTED' : 'NOT SEEN', x + 2, w.y + 4);
    d.setFontSize(7.2);
    const name = d.splitTextToSize(pdfText(m.stage), bw - 4) as string[];
    name.slice(0, 2).forEach((ln, j) => d.text(ln, x + 2, w.y + 8.5 + j * 3.2));
    if (m.activities?.length) {
      d.setFont('helvetica', 'normal'); d.setFontSize(5.8);
      d.text(pdfText(m.activities.slice(0, 2).join(', ') + (m.activities.length > 2 ? ' +' : '')), x + 2, w.y + 16);
    }
  });
  w.y += h + 5;
}

function renderFindings(w: PdfWriter, findings: Finding[]) {
  const d = w.doc;
  const order: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const sorted = [...findings].sort((a, b) => (order[b.severity] ?? 0) - (order[a.severity] ?? 0));
  if (sorted.length === 0) {
    w.paragraph('No findings — no suspicious activity met the detection thresholds.', { color: MUTED });
    return;
  }
  for (const f of sorted) {
    const summary = w.lines(f.summary, WIDTH - 12, 7.8);
    const evidence = f.evidence.slice(0, 4).flatMap(e => w.lines(`• ${e}`, WIDTH - 12, 7.2));
    const h = 10 + summary.length * 3.3 + evidence.length * 3.1 + 3;
    w.ensure(h + 2);
    const color = SEVERITY[f.severity] ?? BLUE;
    const top = w.y;
    d.setFillColor(255, 255, 255); d.rect(LEFT, top, WIDTH, h, 'F');
    d.setDrawColor(...BORDER); d.rect(LEFT, top, WIDTH, h, 'S');
    d.setFillColor(...color); d.rect(LEFT, top, 2.5, h, 'F');
    d.setFont('helvetica', 'bold'); d.setFontSize(8.8); d.setTextColor(...INK);
    d.text((d.splitTextToSize(pdfText(f.title), 128) as string[])[0], LEFT + 6, top + 5.5);
    d.setFillColor(...color); d.rect(RIGHT - 34, top + 2, 32, 5, 'F');
    d.setFontSize(6.8); d.setTextColor(255, 255, 255);
    d.text(`${f.severity} · ${f.confidence}%`, RIGHT - 18, top + 5.4, { align: 'center' });
    d.setFont('helvetica', 'normal'); d.setFontSize(6.8); d.setTextColor(...MUTED);
    d.text(pdfText(`${f.category} · ${f.id}`), LEFT + 6, top + 9.3);
    let y = top + 13;
    d.setFontSize(7.8); d.setTextColor(...INK);
    summary.forEach(line => { d.text(line, LEFT + 6, y); y += 3.3; });
    d.setFontSize(7.2); d.setTextColor(...MUTED);
    evidence.forEach(line => { d.text(line, LEFT + 6, y); y += 3.1; });
    w.y = top + h + 2.5;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderGeneric(w: PdfWriter, content: Record<string, any>) {
  for (const [k, v] of Object.entries(content)) {
    if (v === null || v === undefined || v === '') continue;
    if (typeof v !== 'object') { w.keyValue(label(k), String(typeof v === 'number' ? v.toLocaleString() : v)); continue; }
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      w.subheading(`${label(k)} (${v.length})`);
      for (const item of v.slice(0, 40)) {
        w.bullet(typeof item === 'object' && item !== null
          ? Object.entries(item).map(([ik, iv]) => `${label(ik)}: ${Array.isArray(iv) ? iv.join(', ') : iv}`).join(' · ')
          : String(item));
      }
      if (v.length > 40) w.paragraph(`… and ${v.length - 40} more`, { color: MUTED, size: 7.5 });
      continue;
    }
    w.subheading(label(k));
    for (const [ik, iv] of Object.entries(v)) w.keyValue(label(ik), Array.isArray(iv) ? iv.join(', ') : String(iv));
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function generateSecurityReportPdf(customData?: SecurityReportData | Report | null): void {
  const report = customData && 'sections' in customData ? (customData as Report) : null;
  const summary = report ? null : (customData as SecurityReportData | null | undefined);
  const generated = report
    ? new Date(report.generated_at * 1000)
    : new Date(typeof summary?.generatedAt === 'number' ? summary.generatedAt * 1000 : summary?.generatedAt ?? Date.now());
  const dateLabel = generated.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const env = envLabel(report);
  const w = new PdfWriter(`ENV: ${env}  |  GENERATED: ${dateLabel}`);
  const d = w.doc;

  const title = report?.title ?? customData?.title ?? 'Security Report';
  const reportId = report?.report_id ?? (customData as SecurityReportData)?.reportId ?? 'unknown';
  const source = report?.metadata.filename ?? report?.metadata.session_id ?? report?.source_id ?? '—';

  // Title banner
  d.setFillColor(...PANEL); d.rect(LEFT, w.y, WIDTH, 24, 'F');
  d.setDrawColor(...BORDER); d.rect(LEFT, w.y, WIDTH, 24, 'S');
  d.setTextColor(...BLUE); d.setFont('helvetica', 'bold'); d.setFontSize(14);
  d.text('NEXTRACE AI', LEFT + 4, w.y + 7);
  d.setTextColor(...NAVY); d.setFontSize(10);
  d.text((d.splitTextToSize(pdfText(title.toUpperCase()), 110) as string[])[0], LEFT + 4, w.y + 13);
  d.setTextColor(...MUTED); d.setFont('helvetica', 'italic'); d.setFontSize(8.5);
  d.text('Predict. Trace. Secure.', LEFT + 4, w.y + 19);
  d.setFont('helvetica', 'normal'); d.setFontSize(7.8); d.setTextColor(...INK);
  d.text(pdfText(`Report ID: ${reportId}`), RIGHT - 4, w.y + 7, { align: 'right' });
  d.text(pdfText(`Source: ${source}`), RIGHT - 4, w.y + 12, { align: 'right' });
  d.text(pdfText(`Status: ${env}`), RIGHT - 4, w.y + 17, { align: 'right' });
  w.y += 28;

  if (!report) {
    w.section('Report content');
    w.paragraph('The full report could not be loaded, so only its title is available. Open the report page and export again.', { color: MUTED });
    w.footers();
    d.save(`nextrace-report-${reportId}.pdf`);
    return;
  }

  renderKpis(w, kpisOf(report));

  let n = 1;
  const exec = sectionByTitle(report, 'Executive Summary');
  if (exec) {
    w.section(`${n++}. Executive Summary`);
    const c = exec.content;
    if (c.summary) w.paragraph(String(c.summary), { size: 9 });
    if (c.overall_severity) w.keyValue('Overall severity', String(c.overall_severity));
    if (Array.isArray(c.in_plain_language) && c.in_plain_language.length) {
      w.subheading('In plain language');
      c.in_plain_language.forEach((t: string) => w.bullet(t));
    }
    if (c.forensic_assessment) w.keyValue('Forensic assessment', String(c.forensic_assessment));
    if (Array.isArray(c.what_to_investigate_next) && c.what_to_investigate_next.length) {
      w.subheading('What to investigate next');
      c.what_to_investigate_next.forEach((t: string) => w.bullet(t, SEVERITY.HIGH));
    }
    const rest = Object.fromEntries(Object.entries(c).filter(([k]) =>
      !['summary', 'overall_severity', 'in_plain_language', 'forensic_assessment', 'what_to_investigate_next'].includes(k)));
    renderGeneric(w, rest);
  }

  const stage = sectionByTitle(report, 'Attack Stage Map');
  if (stage && Array.isArray(stage.content.stage_map)) {
    w.section(`${n++}. Attack Stage Map`);
    if (stage.content.progression) w.keyValue('Observed progression', String(stage.content.progression));
    renderStageMap(w, stage.content.stage_map);
  }

  w.section(`${n++}. Findings (${report.findings.length})`);
  renderFindings(w, report.findings);

  const assets = sectionByTitle(report, 'Affected Assets');
  if (assets) {
    w.section(`${n++}. Affected Assets`);
    if (assets.content.summary) w.paragraph(String(assets.content.summary), { color: MUTED });
    const rows = (assets.content.assets ?? []) as { ip: string; role: string; impact: string; severity: string; activities: string[] }[];
    if (rows.length) {
      w.table(['Asset', 'Role', 'Impact', 'Severity', 'Activities'], [30, 24, 70, 20, 38],
        rows.map(r => [r.ip, r.role, r.impact, r.severity, r.activities.join(', ')]),
        i => SEVERITY[rows[i].severity] ?? null);
    }
  }

  const actions = sectionByTitle(report, 'Recommended Actions');
  if (actions) {
    w.section(`${n++}. Recommended Actions`);
    if (actions.content.summary) w.paragraph(String(actions.content.summary), { color: MUTED });
    const rows = (actions.content.actions ?? []) as { priority: string; action: string; rationale: string; activities: string[] }[];
    if (rows.length) {
      w.table(['Priority', 'Action', 'Why', 'Ref'], [22, 82, 56, 22],
        rows.map(r => [r.priority, r.action, r.rationale, r.activities.join(', ')]),
        i => PRIORITY[rows[i].priority] ?? null);
    }
  }

  for (const s of [...report.sections].sort((a, b) => a.order - b.order)) {
    if (RENDERED_FIRST.has(s.title)) continue;
    w.section(`${n++}. ${s.title}`);
    renderGeneric(w, s.content);
    if (s.evidence_refs.length) w.paragraph(`Evidence: ${s.evidence_refs.slice(0, 30).join(', ')}`, { size: 7, color: MUTED });
  }

  w.section('Disclaimer');
  w.paragraph(report.disclaimer, { size: 8, color: MUTED });

  w.footers();
  d.save(`nextrace-${report.report_type}-${report.report_id}.pdf`.replace(/[^a-z0-9._-]/gi, '-'));
}
