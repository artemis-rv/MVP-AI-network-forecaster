import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  BarChart3, GitBranch, ListChecks, Cpu, ShieldCheck, ArrowDown, CheckCircle2,
  Clock, Layers, Target, Scale, ClipboardCheck,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from 'recharts';

// Measured NF-CICIDS2018-v3 results. Values are fixed; do not recompute or round differently.
// Next 5 flows:   backend/ml/models/cicids2018/*_next5_v1 (threshold = argmax validation F1).
// Next 10 seconds: experiments/next10s_forecasting_v1 (threshold = argmax validation recall - FPR, "Youden";
//                  the F1 rule alerts on ~100% of windows at 82% validation prevalence).
// Percentages are stored to 3 decimals; ROC-AUC and PR-AUC to 6. Every threshold is chosen on validation; test is evaluated once.
type ModelKey = 'lr' | 'lstm' | 'attn' | 'tf';
type Split = 'Test' | 'Validation';
type TaskKey = 'f5' | 'f10';

interface ResultRow {
  split: Split;
  modelKey: ModelKey;
  threshold: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  fpr: number;
  rocAuc: number;
  prAuc: number;
}

interface ModelInfo {
  label: string;
  color: string;
  input: string;
  params: number;
  f5: { bestEpoch: number; epochsRun: number; trainMin: number };
  f10: { bestEpoch: number; epochsRun: number; trainMin: number };
}

const MODELS: Record<ModelKey, ModelInfo> = {
  lr: { label: 'Logistic Regression', color: '#94a3b8', input: '29,850 flat', params: 29851, f5: { bestEpoch: 1, epochsRun: 4, trainMin: 2.9 }, f10: { bestEpoch: 1, epochsRun: 4, trainMin: 4.1 } },
  lstm: { label: 'Simple LSTM', color: '#0ea5e9', input: '50 × 131', params: 280913, f5: { bestEpoch: 2, epochsRun: 5, trainMin: 35.6 }, f10: { bestEpoch: 4, epochsRun: 7, trainMin: 65.6 } },
  attn: { label: 'LSTM + Attention', color: '#6366f1', input: '50 × 131', params: 281042, f5: { bestEpoch: 7, epochsRun: 8, trainMin: 58.0 }, f10: { bestEpoch: 1, epochsRun: 4, trainMin: 38.6 } },
  tf: { label: 'Transformer', color: '#f59e0b', input: '50 × 131', params: 303697, f5: { bestEpoch: 4, epochsRun: 7, trainMin: 74.8 }, f10: { bestEpoch: 4, epochsRun: 7, trainMin: 107.3 } },
};
const MODEL_ORDER: ModelKey[] = ['lr', 'lstm', 'attn', 'tf'];
const BASELINE: ModelKey = 'lr';
const SELECTED: ModelKey = 'attn';

const RESULTS: Record<TaskKey, ResultRow[]> = {
  f5: [
    { split: 'Test', modelKey: 'lr', threshold: 0.153, accuracy: 66.496, precision: 36.109, recall: 21.428, f1: 26.896, fpr: 15.308, rocAuc: 0.546608, prAuc: 0.328897 },
    { split: 'Test', modelKey: 'lstm', threshold: 0.406, accuracy: 71.763, precision: 57.708, recall: 6.837, f1: 12.225, fpr: 2.023, rocAuc: 0.546136, prAuc: 0.344246 },
    { split: 'Test', modelKey: 'attn', threshold: 0.450, accuracy: 71.457, precision: 51.631, recall: 12.055, f1: 19.546, fpr: 4.560, rocAuc: 0.621515, prAuc: 0.389925 },
    { split: 'Test', modelKey: 'tf', threshold: 0.268, accuracy: 68.902, precision: 29.265, recall: 5.732, f1: 9.586, fpr: 5.593, rocAuc: 0.53627, prAuc: 0.298878 },
    { split: 'Validation', modelKey: 'lr', threshold: 0.153, accuracy: 78.366, precision: 17.600, recall: 37.717, f1: 24.000, fpr: 17.586, rocAuc: 0.659137, prAuc: 0.176299 },
    { split: 'Validation', modelKey: 'lstm', threshold: 0.406, accuracy: 88.525, precision: 33.702, recall: 27.603, f1: 30.349, fpr: 5.408, rocAuc: 0.664363, prAuc: 0.289156 },
    { split: 'Validation', modelKey: 'attn', threshold: 0.450, accuracy: 89.879, precision: 40.755, recall: 25.889, f1: 31.664, fpr: 3.748, rocAuc: 0.696659, prAuc: 0.309596 },
    { split: 'Validation', modelKey: 'tf', threshold: 0.268, accuracy: 86.511, precision: 28.271, recall: 31.836, f1: 29.948, fpr: 8.044, rocAuc: 0.701431, prAuc: 0.300876 },
  ],
  f10: [
    { split: 'Test', modelKey: 'lr', threshold: 0.736, accuracy: 62.945, precision: 88.980, recall: 59.962, f1: 71.644, fpr: 26.436, rocAuc: 0.737439, prAuc: 0.890083 },
    { split: 'Test', modelKey: 'lstm', threshold: 0.799, accuracy: 73.057, precision: 90.055, recall: 73.619, f1: 81.012, fpr: 28.943, rocAuc: 0.804154, prAuc: 0.941351 },
    { split: 'Test', modelKey: 'attn', threshold: 0.680, accuracy: 73.865, precision: 90.500, recall: 74.326, f1: 81.620, fpr: 27.777, rocAuc: 0.806459, prAuc: 0.935241 },
    { split: 'Test', modelKey: 'tf', threshold: 0.965, accuracy: 41.012, precision: 83.282, recall: 30.581, f1: 44.736, fpr: 21.855, rocAuc: 0.592339, prAuc: 0.838498 },
    { split: 'Validation', modelKey: 'lr', threshold: 0.736, accuracy: 52.089, precision: 87.568, recall: 48.780, f1: 62.657, fpr: 32.421, rocAuc: 0.620022, prAuc: 0.885424 },
    { split: 'Validation', modelKey: 'lstm', threshold: 0.799, accuracy: 48.753, precision: 87.759, recall: 43.933, f1: 58.554, fpr: 28.687, rocAuc: 0.610477, prAuc: 0.887187 },
    { split: 'Validation', modelKey: 'attn', threshold: 0.680, accuracy: 48.863, precision: 88.482, recall: 43.617, f1: 58.431, fpr: 26.581, rocAuc: 0.615091, prAuc: 0.888253 },
    { split: 'Validation', modelKey: 'tf', threshold: 0.965, accuracy: 40.100, precision: 92.635, recall: 29.662, f1: 44.936, fpr: 11.040, rocAuc: 0.611666, prAuc: 0.89185 },
  ],
};

interface TaskInfo {
  title: string;
  short: string;
  target: string;
  thresholdRule: string;
  windows: { train: string; val: string; test: string };
  positive: { train: string; val: string; test: string };
  note: string;
}

const TASKS: Record<TaskKey, TaskInfo> = {
  f5: {
    title: 'Next 5 flows',
    short: 'Next 5 flows',
    target: 'y = 1 if any of the 5 flows after the window is an attack',
    thresholdRule: 'argmax validation F1',
    windows: { train: '16,137,599', val: '2,147,083', test: '1,830,307' },
    positive: { train: '17.3%', val: '9.1%', test: '28.8%' },
    note: 'A model that never alerts already reaches 71.2% test accuracy, so accuracy is shown for completeness; compare models on PR-AUC (chance level = positive rate) and ROC-AUC (chance 0.5).',
  },
  f10: {
    title: 'Next 10 seconds',
    short: 'Next 10 s',
    target: 'y = 1 if an attack flow ends within 10 s after the last input flow',
    thresholdRule: 'argmax validation (recall − FPR)',
    windows: { train: '16,137,618', val: '2,147,085', test: '1,830,278' },
    positive: { train: '39.1%', val: '82.4%', test: '78.1%' },
    note: 'Most windows are positive (test 78.1%), so PR-AUC must be read against a chance level of 0.781. The F1 threshold rule alerts on almost every window at this prevalence, so these thresholds maximise recall − FPR on validation instead.',
  },
};

const SPLIT_NOTE: Record<Split, string> = {
  Test: 'Test · 03-02 · Bot (unseen)',
  Validation: 'Validation · 03-01 · Infilteration',
};
const TEMPORAL = '#06b6d4';

const METRICS = [
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'precision', label: 'Precision' },
  { key: 'recall', label: 'Recall' },
  { key: 'f1', label: 'F1' },
  { key: 'fpr', label: 'FPR' },
] as const;

function chartData(task: TaskKey, split: Split) {
  const rows = RESULTS[task].filter((r) => r.split === split);
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

const badgeStyle = (color: string, bg: string, border: string): React.CSSProperties => ({
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: '0.5px',
  color,
  background: bg,
  border: `1px solid ${border}`,
  padding: '1px 6px',
  borderRadius: 4,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
});

function ModelBadge({ k }: { k: ModelKey }) {
  if (k === SELECTED) return <span style={badgeStyle('#6366f1', 'rgba(99, 102, 241, 0.18)', 'rgba(99, 102, 241, 0.4)')}>Selected</span>;
  if (k === BASELINE) return <span style={badgeStyle('var(--text-secondary)', 'var(--bg-input)', 'var(--border-default)')}>Baseline</span>;
  return null;
}

function SectionTitle({ icon, children, sub }: { icon: ReactNode; children: ReactNode; sub?: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon} {children}
      </h2>
      {sub && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{sub}</p>}
    </div>
  );
}

function KeyValueList({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ color: 'var(--text-muted)' }}>{k}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: /^[\d,]+$/.test(v) ? 'var(--font-mono)' : undefined, textAlign: 'right' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

const pct = (v: number) => `${v.toFixed(1)}%`;

function ResultsTable({ task }: { task: TaskKey }) {
  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 9px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '10px 9px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' };
  const num: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5 };
  const rows = RESULTS[task];
  const groupHead = (label: string): React.CSSProperties => ({
    ...th, textAlign: 'center', fontSize: 10, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4,
    color: label === 'rank' ? 'var(--primary)' : 'var(--text-muted)',
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table data-testid={`benchmark-table-${task}`} style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
        <thead>
          <tr>
            <th style={{ ...th, borderBottom: 'none' }} colSpan={3} />
            <th style={groupHead('threshold')} colSpan={5}>At the validation-selected threshold</th>
            <th style={groupHead('rank')} colSpan={2}>Threshold-free</th>
          </tr>
          <tr>
            <th style={th}>Split</th>
            <th style={th}>Model</th>
            <th style={{ ...th, textAlign: 'right' }}>Threshold</th>
            <th style={{ ...th, textAlign: 'right' }}>Accuracy</th>
            <th style={{ ...th, textAlign: 'right' }}>Precision</th>
            <th style={{ ...th, textAlign: 'right' }}>Recall</th>
            <th style={{ ...th, textAlign: 'right' }}>F1</th>
            <th style={{ ...th, textAlign: 'right' }}>FPR</th>
            <th style={{ ...th, textAlign: 'right' }}>ROC-AUC</th>
            <th style={{ ...th, textAlign: 'right' }}>PR-AUC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const firstOfSplit = i === 0 || rows[i - 1].split !== r.split;
            const m = MODELS[r.modelKey];
            const isSel = r.modelKey === SELECTED;
            const strong: React.CSSProperties = { ...num, fontWeight: isSel ? 700 : 400 };
            return (
              <tr
                key={`${r.split}-${r.modelKey}`}
                style={{
                  borderTop: firstOfSplit && i > 0 ? '2px solid var(--border-default)' : undefined,
                  background: isSel ? 'rgba(99, 102, 241, 0.10)' : undefined,
                }}
              >
                <td style={{ ...td, color: 'var(--text-secondary)', fontWeight: firstOfSplit ? 600 : 400, borderLeft: isSel ? '3px solid #6366f1' : '3px solid transparent' }}>
                  {firstOfSplit ? SPLIT_NOTE[r.split] : ''}
                </td>
                <td style={{ ...td, fontWeight: isSel ? 700 : 400 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color, boxShadow: isSel ? `0 0 8px ${m.color}` : undefined }} />
                    <span style={{ color: isSel ? '#6366f1' : undefined }}>{m.label}</span>
                    <ModelBadge k={r.modelKey} />
                  </span>
                </td>
                <td style={strong}>{r.threshold.toFixed(3)}</td>
                <td style={strong}>{pct(r.accuracy)}</td>
                <td style={strong}>{pct(r.precision)}</td>
                <td style={strong}>{pct(r.recall)}</td>
                <td style={strong}>{pct(r.f1)}</td>
                <td style={strong}>{pct(r.fpr)}</td>
                <td style={strong}>{r.rocAuc.toFixed(3)}</td>
                <td style={strong}>{r.prAuc.toFixed(3)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TaskSection({ task, index }: { task: TaskKey; index: number }) {
  const t = TASKS[task];
  return (
    <section style={{ ...card, borderTop: `3px solid ${task === 'f5' ? 'var(--primary)' : TEMPORAL}` }} data-testid={`section-${task}`}>
      <SectionTitle
        icon={<ListChecks size={16} color={task === 'f5' ? 'var(--primary)' : TEMPORAL} />}
        sub={<>Target: {t.target}. Threshold rule: {t.thresholdRule}, frozen before a single test evaluation.</>}
      >
        Table {index} · Forecasting target: {t.title}
      </SectionTitle>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {[
          ['Train windows', t.windows.train, t.positive.train],
          ['Validation windows', t.windows.val, t.positive.val],
          ['Test windows', t.windows.test, t.positive.test],
        ].map(([k, v, p]) => (
          <span key={k} style={{ fontSize: 11.5, color: 'var(--text-secondary)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '4px 9px' }}>
            {k}: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>{v}</span> · {p} positive
          </span>
        ))}
      </div>
      <ResultsTable task={task} />
      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.55 }}>{t.note}</p>
    </section>
  );
}

function SplitChart({ task, split }: { task: TaskKey; split: Split }) {
  return (
    <div style={{ minWidth: 0 }} data-testid={`chart-${task}-${split.toLowerCase()}`}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{SPLIT_NOTE[split]}</h3>
      <div style={{ width: '100%', height: 290 }}>
        <ResponsiveContainer>
          <BarChart data={chartData(task, split)} margin={{ top: 20, right: 8, left: -12, bottom: 0 }} barCategoryGap="16%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="metric" tick={{ fontSize: 11.5, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-default)' }} tickLine={false} />
            {/* Fixed 0-100% scale on every panel so bar heights are directly comparable. */}
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--bg-card-hover)' }}
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11 }}
              formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
            />
            <Legend itemSorter={null} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            {MODEL_ORDER.map((k) => (
              <Bar
                key={k}
                dataKey={k}
                name={MODELS[k].label}
                fill={MODELS[k].color}
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                stroke={k === SELECTED ? '#4f46e5' : undefined}
                strokeWidth={k === SELECTED ? 1.5 : 0}
              >
                <LabelList
                  dataKey={k}
                  position="top"
                  formatter={(v) => `${Number(v).toFixed(0)}`}
                  style={{ fontSize: 8.5, fill: k === SELECTED ? '#6366f1' : 'var(--text-secondary)', fontWeight: k === SELECTED ? 700 : 400 }}
                />
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

export function ModelBenchmarkPage() {
  const [chartTask, setChartTask] = useState<TaskKey>('f5');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <BarChart3 size={24} color="var(--primary)" /> Model Benchmark
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          NF-CICIDS2018-v3 · attack forecasting over two horizons (next 5 flows, next 10 seconds) · Logistic Regression baseline vs Simple LSTM, LSTM + Attention, Transformer · one frozen protocol
        </p>
      </div>

      {/* Setup: target, baseline, protocol */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }} data-testid="benchmark-setup">
        <div style={{ ...card, borderTop: '3px solid var(--primary)' }} data-testid="setup-target">
          <SectionTitle icon={<Target size={16} color="var(--primary)" />}>Forecasting targets</SectionTitle>
          <Bullets items={[
            <>Input: the <b>50 most recent flows</b> (75 numeric + 6 categorical features each); no labels, future flows, raw IPs or timestamps.</>,
            <><b>Next 5 flows</b>: alert if any of the 5 flows after the window is an attack (median span 59 ms on the test day).</>,
            <><b>Next 10 seconds</b>: alert if any attack flow ends within 10 s after the last input flow (median 712 flows on the test day).</>,
            'One probability per window; an alert is raised when it reaches the model’s threshold.',
          ]} />
        </div>
        <div style={{ ...card, borderTop: `3px solid ${MODELS.lr.color}` }} data-testid="setup-baseline">
          <SectionTitle icon={<Scale size={16} color={MODELS.lr.color} />}>Baseline model</SectionTitle>
          <Bullets items={[
            <><b>Logistic Regression</b> is the classical baseline: logit = wᵀx + b on the same 50-flow window, flattened to 29,850 features.</>,
            'Trained with exactly the same data, sampling, optimiser and threshold rule as the three neural models.',
            'A neural model is only useful if it beats this baseline on PR-AUC and ROC-AUC on the unseen test day.',
            <><b>Selected model</b>: LSTM + Attention, the best next-5-flow ranking and level with the Simple LSTM for next 10 seconds.</>,
          ]} />
        </div>
        <div style={{ ...card, borderTop: '3px solid var(--color-live)' }} data-testid="setup-protocol">
          <SectionTitle icon={<ClipboardCheck size={16} color="var(--color-live)" />}>Evaluation protocol</SectionTitle>
          <KeyValueList rows={[
            ['Split', 'chronological, by capture session'],
            ['Train', '02-14 … 02-28 (8 sessions)'],
            ['Validation', '03-01 · Infilteration'],
            ['Test', '03-02 · Bot (never seen in training)'],
            ['Threshold', 'chosen on validation only, frozen'],
            ['Test evaluation', 'once, after the threshold is frozen'],
            ['Primary metrics', 'PR-AUC and ROC-AUC (threshold-free)'],
          ]} />
        </div>
      </section>

      {/* Results tables, one per target */}
      <TaskSection task="f5" index={1} />
      <TaskSection task="f10" index={2} />

      {/* Metric charts */}
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <SectionTitle
            icon={<BarChart3 size={16} color="var(--primary)" />}
            sub="Accuracy, precision, recall, F1 and false positive rate at each model's validation-selected threshold, on a fixed 0–100% axis. For FPR, lower means fewer false alarms."
          >
            Metric Comparison
          </SectionTitle>
          <div role="tablist" style={{ display: 'flex', gap: 4, background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 3 }}>
            {(['f5', 'f10'] as TaskKey[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={chartTask === k}
                data-testid={`chart-tab-${k}`}
                onClick={() => setChartTask(k)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: chartTask === k ? 'var(--bg-card)' : 'transparent',
                  color: chartTask === k ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: chartTask === k ? '0 1px 2px rgba(0,0,0,0.15)' : undefined,
                }}
              >
                {TASKS[k].short}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: 24 }}>
          <SplitChart task={chartTask} split="Test" />
          <SplitChart task={chartTask} split="Validation" />
        </div>
      </section>

      {/* Model details */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }} data-testid="model-cards">
        {([
          ['lr', ['Classical linear baseline: logit = wᵀx + b', 'Same 50-flow window, flattened', '3,750 numeric + 26,100 one-hot = 29,850 features', 'L2 via weight decay 1e-5']],
          ['lstm', ['2-layer LSTM, 128 hidden units, dropout 0.2', 'Final hidden state → 128 → 64 → 1', 'No attention', 'Categorical embeddings: 56 dims']],
          ['attn', ['Same LSTM as Simple LSTM', 'Temporal attention over all 50 outputs', 'Linear(128 → 1) scorer, softmax over time', 'Context vector → 128 → 64 → 1']],
          ['tf', ['Encoder-only, 2 layers, d_model 128, 4 heads', 'Feed-forward 256, dropout 0.2, GELU', '[CLS] token + learned positions (51)', 'CLS output → 128 → 64 → 1']],
        ] as [ModelKey, string[]][]).map(([k, items]) => {
          const isSel = k === SELECTED;
          const m = MODELS[k];
          return (
            <div
              key={k}
              style={{
                ...card,
                borderTop: `3px solid ${m.color}`,
                border: isSel ? `2px solid ${m.color}` : '1px solid var(--border-default)',
                background: isSel ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-card)',
                boxShadow: isSel ? '0 0 16px rgba(99, 102, 241, 0.15)' : undefined,
              }}
            >
              <SectionTitle icon={<Cpu size={16} color={m.color} />}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {m.label}
                  <ModelBadge k={k} />
                </span>
              </SectionTitle>
              <Bullets
                items={[
                  ...items,
                  `${m.params.toLocaleString('en-US')} parameters · input ${m.input}`,
                  `Next 5 flows: best epoch ${m.f5.bestEpoch} of ${m.f5.epochsRun} · ${m.f5.trainMin.toFixed(1)} min`,
                  `Next 10 s: best epoch ${m.f10.bestEpoch} of ${m.f10.epochsRun} · ${m.f10.trainMin.toFixed(1)} min`,
                ]}
              />
            </div>
          );
        })}
      </section>

      {/* Training protocol */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div style={{ ...card, borderTop: `3px solid ${TEMPORAL}` }} data-testid="training-protocol">
          <SectionTitle icon={<ShieldCheck size={16} color={TEMPORAL} />}>Training protocol (identical for all models and targets)</SectionTitle>
          <KeyValueList rows={[
            ['Optimizer', 'Adam, lr 1e-3, weight decay 1e-5'],
            ['Batch size / seed', '2048 / 42'],
            ['Loss', 'BCE with logits, no class weighting'],
            ['Epoch sampling', 'all positives + seeded 25% of negatives'],
            ['Windows per epoch', '6,128,327 (5 flows) · 8,769,158 (10 s)'],
            ['Epochs', 'max 8, early-stopping patience 3'],
            ['Checkpoint', 'best validation PR-AUC'],
          ]} />
        </div>
        <div style={{ ...card, borderTop: '3px solid var(--color-live)' }} data-testid="data-integrity">
          <SectionTitle icon={<ShieldCheck size={16} color="var(--color-live)" />}>Data and leakage controls</SectionTitle>
          <KeyValueList rows={[
            ['Dataset', 'NF-CICIDS2018-v3 · 20,115,529 flows'],
            ['Ordering', 'flow end time, fixed tie-break'],
            ['Scaler and encoders', 'fitted on training sessions only'],
            ['Host-history features', 'computed from past flows only'],
            ['Windows and horizons', 'never cross a session or split'],
            ['Incomplete horizons', 'excluded, never labelled 0'],
            ['Test labels', 'not used for any selection'],
          ]} />
        </div>
      </section>

      {/* Pipeline status */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div style={card}>
          <SectionTitle icon={<GitBranch size={16} color={TEMPORAL} />} sub="Components used to produce the results above.">
            Current Model Pipeline
          </SectionTitle>
          <Pipeline stages={[
            { name: 'NF-CICIDS2018-v3 Data', status: 'done' },
            { name: 'Leakage-safe Preprocessing', status: 'done' },
            { name: 'Session Split (train / val / test)', status: 'done' },
            { name: 'Causal Host-history Features', status: 'done' },
            { name: 'Next-5-flow and Next-10-second Targets', status: 'done' },
            { name: 'Four-model Benchmark', status: 'done' },
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
