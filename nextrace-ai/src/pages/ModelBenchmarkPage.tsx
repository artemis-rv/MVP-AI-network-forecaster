import type { ReactNode } from 'react';
import {
  BarChart3, Info, GitBranch, ListChecks, Cpu, ShieldCheck, ArrowDown, CheckCircle2, XCircle,
  Clock, Layers, ClipboardCheck,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from 'recharts';

// Measured chronological test-set results. Values are fixed; do not recompute or round differently.
// LSTM + Attention = single model v3a_state5_seq50 (K=5) and v2b_seq50_bce (next flow); no ensemble.
type ModelKey = 'lstm' | 'lr141' | 'lr53';

interface ResultRow {
  task: 'Next 5 flows (K=5)' | 'Next flow';
  model: string;
  modelKey: ModelKey;
  input: string;
  precision: number;
  recall: number;
  f1: number;
  fpr: number;
  rocAuc: number;
  prAuc: number;
}

const RESULTS: ResultRow[] = [
  { task: 'Next 5 flows (K=5)', model: 'LSTM + Attention', modelKey: 'lstm', input: '50 × 141', precision: 50.6, recall: 54.2, f1: 52.4, fpr: 19.7, rocAuc: 0.771, prAuc: 0.551 },
  { task: 'Next 5 flows (K=5)', model: 'Logistic Regression', modelKey: 'lr141', input: '1 × 141', precision: 32.7, recall: 92.7, f1: 48.4, fpr: 70.8, rocAuc: 0.639, prAuc: 0.342 },
  { task: 'Next flow', model: 'LSTM + Attention', modelKey: 'lstm', input: '50 × 141', precision: 29.4, recall: 39.8, f1: 33.8, fpr: 6.8, rocAuc: 0.841, prAuc: 0.348 },
  { task: 'Next flow', model: 'Logistic Regression', modelKey: 'lr53', input: '1 × 53', precision: 13.7, recall: 57.5, f1: 22.1, fpr: 25.8, rocAuc: 0.750, prAuc: 0.130 },
];

const MODEL_STYLE: Record<ModelKey, { color: string; label: string }> = {
  lstm: { color: '#6366f1', label: 'LSTM + Attention (50 × 141)' },
  lr141: { color: '#94a3b8', label: 'Logistic Regression (141 features)' },
  lr53: { color: '#64748b', label: 'Logistic Regression (53 features)' },
};
const TEMPORAL = '#06b6d4';

const METRICS = [
  { key: 'precision', label: 'Precision' },
  { key: 'recall', label: 'Recall' },
  { key: 'f1', label: 'F1' },
  { key: 'fpr', label: 'FPR' },
] as const;

function chartData(task: ResultRow['task']) {
  const rows = RESULTS.filter((r) => r.task === task);
  return METRICS.map((m) => ({
    metric: m.label,
    ...Object.fromEntries(rows.map((r) => [r.modelKey, r[m.key]])),
  }));
}

const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 12,
  padding: 20,
  minWidth: 0,
};

function SectionTitle({ icon, children, sub }: { icon: ReactNode; children: ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon} {children}
      </h2>
      {sub && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function TaskChart({ task, title }: { task: ResultRow['task']; title: string }) {
  const keys = RESULTS.filter((r) => r.task === task).map((r) => r.modelKey);
  return (
    <div style={{ minWidth: 0 }} data-testid={`chart-${task === 'Next flow' ? 'next-flow' : 'k5'}`}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</h3>
      <div style={{ width: '100%', height: 270 }}>
        <ResponsiveContainer>
          <BarChart data={chartData(task)} margin={{ top: 20, right: 8, left: -12, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="metric" tick={{ fontSize: 11.5, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-default)' }} tickLine={false} />
            {/* Fixed 0-100% scale on both panels so bar heights are directly comparable. */}
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--bg-card-hover)' }}
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11 }}
              formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            {keys.map((k) => (
              <Bar key={k} dataKey={k} name={MODEL_STYLE[k].label} fill={MODEL_STYLE[k].color} radius={[4, 4, 0, 0]} maxBarSize={34}>
                <LabelList dataKey={k} position="top" formatter={(v) => `${Number(v).toFixed(1)}`} style={{ fontSize: 9.5, fill: 'var(--text-secondary)' }} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type StageStatus = 'done' | 'current' | 'next' | 'planned';

const STATUS_STYLE: Record<StageStatus, { label: string; color: string; bg: string }> = {
  done: { label: 'IMPLEMENTED', color: 'var(--color-live)', bg: 'var(--color-live-light)' },
  current: { label: 'CURRENT', color: TEMPORAL, bg: 'rgba(6, 182, 212, 0.12)' },
  next: { label: 'NEXT', color: 'var(--color-warning)', bg: 'var(--color-warning-light)' },
  planned: { label: 'PLANNED', color: 'var(--text-muted)', bg: 'var(--bg-input)' },
};

function Pipeline({ stages }: { stages: { name: string; status: StageStatus }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
      {stages.map((s, i) => {
        const st = STATUS_STYLE[s.status];
        const future = s.status === 'next' || s.status === 'planned';
        return (
          <div key={s.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              data-testid={`stage-${s.name}`}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: '8px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                color: future ? 'var(--text-muted)' : 'var(--text-primary)',
                background: future ? 'transparent' : 'var(--bg-card-hover)',
                border: `1px ${future ? 'dashed' : 'solid'} ${future ? 'var(--border-default)' : st.color}`,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {future ? <Clock size={14} /> : <CheckCircle2 size={14} color={st.color} />}
                {s.name}
              </span>
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.6px', color: st.color, background: st.bg, padding: '2px 7px', borderRadius: 999 }}>
                {st.label}
              </span>
            </div>
            {i < stages.length - 1 && <ArrowDown size={13} color="var(--text-muted)" style={{ margin: '2px 0' }} />}
          </div>
        );
      })}
    </div>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
      {items.map((t, i) => (
        <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <span style={{ color: TEMPORAL, flexShrink: 0 }}>•</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

const pct = (v: number) => `${v.toFixed(1)}%`;

export function ModelBenchmarkPage() {
  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' };
  const num: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5 };
  const lstmK5 = RESULTS[0];
  const lr141 = RESULTS[1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <BarChart3 size={24} color="var(--primary)" /> Model Benchmark
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Chronological temporal forecasting benchmark · LSTM + Attention vs Logistic Regression · untouched test set
        </p>
      </div>

      {/* Results table */}
      <section style={card}>
        <SectionTitle
          icon={<ListChecks size={16} color="var(--primary)" />}
          sub="All rows: chronological split, thresholds selected on validation only, evaluated once on the untouched test set. Input = time steps × features per step."
        >
          Benchmark Results
        </SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table data-testid="benchmark-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={th}>Task</th>
                <th style={th}>Model</th>
                <th style={th}>Input</th>
                <th style={{ ...th, textAlign: 'right' }}>Precision</th>
                <th style={{ ...th, textAlign: 'right' }}>Recall</th>
                <th style={{ ...th, textAlign: 'right' }}>F1</th>
                <th style={{ ...th, textAlign: 'right' }}>FPR</th>
                <th style={{ ...th, textAlign: 'right' }}>ROC-AUC</th>
                <th style={{ ...th, textAlign: 'right' }}>PR-AUC</th>
              </tr>
            </thead>
            <tbody>
              {RESULTS.map((r, i) => {
                const firstOfTask = i === 0 || RESULTS[i - 1].task !== r.task;
                return (
                  <tr key={i} style={{ background: r.modelKey === 'lstm' ? 'rgba(99, 102, 241, 0.06)' : undefined, borderTop: firstOfTask && i > 0 ? '2px solid var(--border-default)' : undefined }}>
                    <td style={{ ...td, color: 'var(--text-secondary)', fontWeight: firstOfTask ? 600 : 400 }}>{firstOfTask ? r.task : ''}</td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: r.modelKey === 'lstm' ? 600 : 400 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: MODEL_STYLE[r.modelKey].color }} />
                        {r.model}
                      </span>
                    </td>
                    <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-secondary)' }}>{r.input}</td>
                    <td style={num}>{pct(r.precision)}</td>
                    <td style={num}>{pct(r.recall)}</td>
                    <td style={num}>{pct(r.f1)}</td>
                    <td style={num}>{pct(r.fpr)}</td>
                    <td style={num}>{r.rocAuc.toFixed(3)}</td>
                    <td style={num}>{r.prAuc.toFixed(3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* All metric charts in one card */}
      <section style={card}>
        <SectionTitle
          icon={<BarChart3 size={16} color="var(--primary)" />}
          sub="Precision, recall, F1 and false positive rate for every model, grouped by forecasting task. Both panels share a fixed 0–100% axis; for FPR, lower means fewer false alarms."
        >
          Metric Comparison
        </SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: 24 }}>
          <TaskChart task="Next 5 flows (K=5)" title="Next 5 flows (K=5)" />
          <TaskChart task="Next flow" title="Next flow" />
        </div>
      </section>

      {/* Findings and compliance */}
      <section style={{ ...card, borderLeft: '4px solid var(--primary)' }}>
        <SectionTitle icon={<ClipboardCheck size={16} color="var(--primary)" />}>Findings &amp; Target Compliance</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'var(--color-live-light)', border: '1px solid var(--color-live)', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.6px', color: 'var(--color-live)', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={13} /> LSTM + Attention: target met
              </div>
              {pct(lstmK5.precision)} precision, {pct(lstmK5.recall)} recall, {pct(lstmK5.fpr)} FPR. Precision is only 0.6 points above the threshold.
            </div>
            <div style={{ background: 'var(--color-critical-light)', border: '1px solid var(--color-critical)', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.6px', color: 'var(--color-critical)', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <XCircle size={13} /> Logistic Regression: target not achieved
              </div>
              {pct(lr141.precision)} precision and {pct(lr141.fpr)} FPR. Validation precision never exceeded 36.8% at any threshold.
            </div>
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[
              `With the same 141 features and K=5 target, LSTM + Attention reached ROC-AUC ${lstmK5.rocAuc.toFixed(3)} vs ${lr141.rocAuc.toFixed(3)} and PR-AUC ${lstmK5.prAuc.toFixed(3)} vs ${lr141.prAuc.toFixed(3)}, at ${pct(lstmK5.fpr)} FPR vs ${pct(lr141.fpr)}.`,
              'Logistic Regression receives only the current 141-feature state; LSTM + Attention receives the preceding 50 states. The gain reflects sequence modelling, not a different feature set.',
              'Adding the 88 engineered features barely changed Logistic Regression (PR-AUC 0.342 vs 0.338), so the improvement does not come from the features alone.',
              'For next-flow forecasting, LSTM + Attention raised precision from 13.7% to 29.4% and lowered FPR from 25.8% to 6.8%.',
            ].map((t, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <Info size={14} color={TEMPORAL} style={{ flexShrink: 0, marginTop: 3 }} />
                <span>{t}</span>
              </li>
            ))}
            <li style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.55, paddingLeft: 24 }}>
              Threshold rules (validation only): K=5 LSTM + Attention and 53-feature Logistic Regression, best F1 with precision ≥ 52% and FPR ≤ 30% (best F1 overall if no threshold qualifies); 141-feature Logistic Regression and next-flow rows, best F1. ROC-AUC and PR-AUC are threshold-independent.
            </li>
          </ul>
        </div>
      </section>

      {/* Model details and evaluation protocol */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <div style={{ ...card, borderTop: `3px solid ${MODEL_STYLE.lstm.color}` }}>
          <SectionTitle icon={<Cpu size={16} color={MODEL_STYLE.lstm.color} />}>LSTM + Attention</SectionTitle>
          <Bullets items={[
            'Single model (no ensemble)',
            'Input: 50 flows × 141 features',
            '2-layer LSTM, 128 hidden units',
            'Temporal attention over the 50 steps',
            'Threshold 0.42, selected on validation',
          ]} />
        </div>
        <div style={{ ...card, borderTop: `3px solid ${MODEL_STYLE.lr141.color}` }}>
          <SectionTitle icon={<Cpu size={16} color={MODEL_STYLE.lr141.color} />}>Logistic Regression</SectionTitle>
          <Bullets items={[
            'Non-sequential: current state only',
            'Same-feature baseline: 141 features',
            'Original baseline: 53 features',
            'Class-balanced, chronological training',
            'Threshold selected on validation',
          ]} />
        </div>
        <div style={{ ...card, borderTop: '3px solid var(--color-live)' }} data-testid="data-integrity">
          <SectionTitle icon={<ShieldCheck size={16} color="var(--color-live)" />}>Evaluation protocol</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[
              ['Chronological split', '70 / 15 / 15'],
              ['Train', '1,570,051'],
              ['Validation', '336,440'],
              ['Test', '336,440'],
              ['Threshold selection', 'validation only'],
              ['Final evaluation', 'untouched test set'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: /\d/.test(v) ? 'var(--font-mono)' : undefined, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline status */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div style={card}>
          <SectionTitle icon={<GitBranch size={16} color={TEMPORAL} />} sub="Components used to produce the results above.">
            Current Model Pipeline
          </SectionTitle>
          <Pipeline stages={[
            { name: 'Data', status: 'done' },
            { name: 'Chronological Split', status: 'done' },
            { name: 'Temporal Features', status: 'done' },
            { name: 'LSTM + Attention', status: 'done' },
            { name: 'K=5 Forecasting', status: 'done' },
            { name: 'Benchmark', status: 'done' },
          ]} />
        </div>
        <div style={card}>
          <SectionTitle icon={<Layers size={16} color="var(--color-warning)" />} sub="Future components. Not implemented yet; no results exist for them.">
            Planned Research Pipeline
          </SectionTitle>
          <Pipeline stages={[
            { name: 'Current Benchmark', status: 'current' },
            { name: 'World Model', status: 'next' },
            { name: 'GAT', status: 'planned' },
            { name: 'Hybrid Model', status: 'planned' },
            { name: 'SHAP / Explainability', status: 'planned' },
          ]} />
        </div>
      </section>
    </div>
  );
}
