import type { ReactNode } from 'react';
import {
  BarChart3, GitBranch, ListChecks, Cpu, ShieldCheck, ArrowDown, CheckCircle2,
  Clock, Layers,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from 'recharts';

// Measured NF-CICIDS2018-v3 next-5-flow benchmark results (backend/ml/models/cicids2018/*_next5_v1).
// Values are fixed; do not recompute or round differently. Percentages are stored to 3 decimals.
// One frozen protocol for all four models; each threshold = argmax validation F1, test evaluated once.
type ModelKey = 'lr' | 'lstm' | 'attn' | 'tf';
type Split = 'Test' | 'Validation';

interface ResultRow {
  split: Split;
  modelKey: ModelKey;
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
  threshold: number;
  bestEpoch: number;
  epochsRun: number;
  trainMin: number;
}

const MODELS: Record<ModelKey, ModelInfo> = {
  lr: { label: 'Logistic Regression', color: '#94a3b8', input: '29,850 flat', params: 29851, threshold: 0.153, bestEpoch: 1, epochsRun: 4, trainMin: 2.9 },
  lstm: { label: 'Simple LSTM', color: '#0ea5e9', input: '50 × 131', params: 280913, threshold: 0.406, bestEpoch: 2, epochsRun: 5, trainMin: 35.6 },
  attn: { label: 'LSTM + Attention', color: '#6366f1', input: '50 × 131', params: 281042, threshold: 0.450, bestEpoch: 7, epochsRun: 8, trainMin: 58.0 },
  tf: { label: 'Transformer', color: '#f59e0b', input: '50 × 131', params: 303697, threshold: 0.268, bestEpoch: 4, epochsRun: 7, trainMin: 74.8 },
};
const MODEL_ORDER: ModelKey[] = ['lr', 'lstm', 'attn', 'tf'];

const RESULTS: ResultRow[] = [
  { split: 'Test', modelKey: 'lr', precision: 36.109, recall: 21.428, f1: 26.896, fpr: 15.308, rocAuc: 0.5466, prAuc: 0.3289 },
  { split: 'Test', modelKey: 'lstm', precision: 57.708, recall: 6.837, f1: 12.225, fpr: 2.023, rocAuc: 0.5461, prAuc: 0.3442 },
  { split: 'Test', modelKey: 'attn', precision: 51.631, recall: 12.055, f1: 19.546, fpr: 4.560, rocAuc: 0.6215, prAuc: 0.3899 },
  { split: 'Test', modelKey: 'tf', precision: 29.265, recall: 5.732, f1: 9.586, fpr: 5.593, rocAuc: 0.5363, prAuc: 0.2989 },
  { split: 'Validation', modelKey: 'lr', precision: 17.600, recall: 37.717, f1: 24.000, fpr: 17.586, rocAuc: 0.6591, prAuc: 0.1763 },
  { split: 'Validation', modelKey: 'lstm', precision: 33.702, recall: 27.603, f1: 30.349, fpr: 5.408, rocAuc: 0.6644, prAuc: 0.2892 },
  { split: 'Validation', modelKey: 'attn', precision: 40.755, recall: 25.889, f1: 31.664, fpr: 3.748, rocAuc: 0.6967, prAuc: 0.3096 },
  { split: 'Validation', modelKey: 'tf', precision: 28.271, recall: 31.836, f1: 29.948, fpr: 8.044, rocAuc: 0.7014, prAuc: 0.3009 },
];

const SPLIT_NOTE: Record<Split, string> = {
  Test: 'Test · 03-02 · Bot (unseen)',
  Validation: 'Validation · 03-01 · Infilteration',
};
const TEMPORAL = '#06b6d4';

const METRICS = [
  { key: 'precision', label: 'Precision' },
  { key: 'recall', label: 'Recall' },
  { key: 'f1', label: 'F1' },
  { key: 'fpr', label: 'FPR' },
] as const;

function chartData(split: Split) {
  const rows = RESULTS.filter((r) => r.split === split);
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

function SplitChart({ split }: { split: Split }) {
  return (
    <div style={{ minWidth: 0 }} data-testid={`chart-${split.toLowerCase()}`}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{SPLIT_NOTE[split]}</h3>
      <div style={{ width: '100%', height: 290 }}>
        <ResponsiveContainer>
          <BarChart data={chartData(split)} margin={{ top: 20, right: 8, left: -12, bottom: 0 }} barCategoryGap="18%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="metric" tick={{ fontSize: 11.5, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-default)' }} tickLine={false} />
            {/* Fixed 0-100% scale on both panels so bar heights are directly comparable. */}
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
                maxBarSize={26}
                stroke={k === 'attn' ? '#4f46e5' : undefined}
                strokeWidth={k === 'attn' ? 1.5 : 0}
              >
                <LabelList
                  dataKey={k}
                  position="top"
                  formatter={(v) => `${Number(v).toFixed(1)}`}
                  style={{
                    fontSize: 9,
                    fill: k === 'attn' ? '#6366f1' : 'var(--text-secondary)',
                    fontWeight: k === 'attn' ? 700 : 400,
                  }}
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

const pct = (v: number) => `${v.toFixed(1)}%`;

export function ModelBenchmarkPage() {
  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 9px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '10px 9px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' };
  const num: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <BarChart3 size={24} color="var(--primary)" /> Model Benchmark
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          NF-CICIDS2018-v3 · next-5-flow attack forecasting · Logistic Regression, Simple LSTM, LSTM + Attention, Transformer · one frozen protocol
        </p>
      </div>

      {/* Results table */}
      <section style={card}>
        <SectionTitle
          icon={<ListChecks size={16} color="var(--primary)" />}
          sub="Task: from the previous 50 flows, predict whether any of the next 5 flows is an attack. Chronological session split; each threshold = argmax validation F1, frozen before a single test evaluation. Input = time steps × features per step."
        >
          Benchmark Results
        </SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table data-testid="benchmark-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
            <thead>
              <tr>
                <th style={th}>Split</th>
                <th style={th}>Model</th>
                <th style={th}>Input</th>
                <th style={{ ...th, textAlign: 'right' }}>Params</th>
                <th style={{ ...th, textAlign: 'right' }}>Threshold</th>
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
                const firstOfSplit = i === 0 || RESULTS[i - 1].split !== r.split;
                const m = MODELS[r.modelKey];
                const isAttn = r.modelKey === 'attn';
                return (
                  <tr
                    key={i}
                    style={{
                      borderTop: firstOfSplit && i > 0 ? '2px solid var(--border-default)' : undefined,
                      background: isAttn ? 'rgba(99, 102, 241, 0.10)' : undefined,
                    }}
                  >
                    <td
                      style={{
                        ...td,
                        color: 'var(--text-secondary)',
                        fontWeight: firstOfSplit ? 600 : 400,
                        borderLeft: isAttn ? '3px solid #6366f1' : '3px solid transparent',
                      }}
                    >
                      {firstOfSplit ? SPLIT_NOTE[r.split] : ''}
                    </td>
                    <td style={{ ...td, fontWeight: isAttn ? 700 : 400 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: m.color,
                            boxShadow: isAttn ? `0 0 8px ${m.color}` : undefined,
                          }}
                        />
                        <span style={{ color: isAttn ? '#6366f1' : undefined }}>{m.label}</span>
                        {isAttn && (
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              letterSpacing: '0.5px',
                              color: '#6366f1',
                              background: 'rgba(99, 102, 241, 0.18)',
                              border: '1px solid rgba(99, 102, 241, 0.4)',
                              padding: '1px 6px',
                              borderRadius: 4,
                              textTransform: 'uppercase',
                            }}
                          >
                            Selected
                          </span>
                        )}
                      </span>
                    </td>
                    <td
                      style={{
                        ...td,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12.5,
                        color: isAttn ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: isAttn ? 600 : 400,
                      }}
                    >
                      {m.input}
                    </td>
                    <td style={{ ...num, fontWeight: isAttn ? 700 : 400, color: isAttn ? 'var(--text-primary)' : undefined }}>
                      {m.params.toLocaleString('en-US')}
                    </td>
                    <td style={{ ...num, fontWeight: isAttn ? 700 : 400, color: isAttn ? 'var(--text-primary)' : undefined }}>
                      {m.threshold.toFixed(3)}
                    </td>
                    <td style={{ ...num, fontWeight: isAttn ? 700 : 400, color: isAttn ? 'var(--text-primary)' : undefined }}>
                      {pct(r.precision)}
                    </td>
                    <td style={{ ...num, fontWeight: isAttn ? 700 : 400, color: isAttn ? 'var(--text-primary)' : undefined }}>
                      {pct(r.recall)}
                    </td>
                    <td style={{ ...num, fontWeight: isAttn ? 700 : 400, color: isAttn ? 'var(--text-primary)' : undefined }}>
                      {pct(r.f1)}
                    </td>
                    <td style={{ ...num, fontWeight: isAttn ? 700 : 400, color: isAttn ? 'var(--text-primary)' : undefined }}>
                      {pct(r.fpr)}
                    </td>
                    <td style={{ ...num, fontWeight: isAttn ? 700 : 400, color: isAttn ? 'var(--text-primary)' : undefined }}>
                      {r.rocAuc.toFixed(3)}
                    </td>
                    <td style={{ ...num, fontWeight: isAttn ? 700 : 400, color: isAttn ? 'var(--text-primary)' : undefined }}>
                      {r.prAuc.toFixed(3)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.55 }}>
          Positive rate of the next-5 target: train 17.3%, validation 9.1%, test 28.8%. Neural inputs are 75 numeric features + 56 learned categorical-embedding dims per flow (131);
          Logistic Regression uses the same 50-flow window flattened to 3,750 numeric + 26,100 one-hot features.
        </p>
      </section>

      {/* Metric charts */}
      <section style={card}>
        <SectionTitle
          icon={<BarChart3 size={16} color="var(--primary)" />}
          sub="Precision, recall, F1 and false positive rate at each model's validation-selected threshold. Both panels share a fixed 0–100% axis; for FPR, lower means fewer false alarms."
        >
          Metric Comparison
        </SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: 24 }}>
          <SplitChart split="Test" />
          <SplitChart split="Validation" />
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
          const isAttn = k === 'attn';
          return (
            <div
              key={k}
              style={{
                ...card,
                borderTop: `3px solid ${MODELS[k].color}`,
                border: isAttn ? `2px solid ${MODELS[k].color}` : '1px solid var(--border-default)',
                background: isAttn ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-card)',
                boxShadow: isAttn ? '0 0 16px rgba(99, 102, 241, 0.15)' : undefined,
              }}
            >
              <SectionTitle icon={<Cpu size={16} color={MODELS[k].color} />}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {MODELS[k].label}
                  {isAttn && (
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                        color: '#6366f1',
                        background: 'rgba(99, 102, 241, 0.18)',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        padding: '1px 6px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                      }}
                    >
                      Selected Model
                    </span>
                  )}
                </span>
              </SectionTitle>
              <Bullets
                items={[
                  ...items,
                  `${MODELS[k].params.toLocaleString('en-US')} parameters`,
                  `Best epoch ${MODELS[k].bestEpoch} of ${MODELS[k].epochsRun} run · ${MODELS[k].trainMin.toFixed(1)} min training`,
                  `Threshold ${MODELS[k].threshold.toFixed(3)}, selected on validation`,
                ]}
              />
            </div>
          );
        })}
      </section>

      {/* Evaluation protocol */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div style={{ ...card, borderTop: '3px solid var(--color-live)' }} data-testid="data-integrity">
          <SectionTitle icon={<ShieldCheck size={16} color="var(--color-live)" />}>Evaluation protocol</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[
              ['Dataset', 'NF-CICIDS2018-v3 · 20,115,529 flows'],
              ['Split', 'chronological, by capture session'],
              ['Train windows (02-14 … 02-28)', '16,137,599'],
              ['Validation windows (03-01)', '2,147,083'],
              ['Test windows (03-02)', '1,830,307'],
              ['Window / horizon', '50 flows / next 5 flows'],
              ['Threshold selection', 'validation only (argmax F1)'],
              ['Final evaluation', 'test set, evaluated once'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: /^[\d,]+$/.test(v) ? 'var(--font-mono)' : undefined, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...card, borderTop: `3px solid ${TEMPORAL}` }} data-testid="training-protocol">
          <SectionTitle icon={<ShieldCheck size={16} color={TEMPORAL} />}>Training protocol (identical for all models)</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[
              ['Optimizer', 'Adam, lr 1e-3, weight decay 1e-5'],
              ['Batch size / seed', '2048 / 42'],
              ['Loss', 'BCE with logits, no class weighting'],
              ['Windows per epoch', '6,128,327'],
              ['Epoch sampling', 'all positives + seeded 25% of negatives'],
              ['Epochs', 'max 8, early-stopping patience 3'],
              ['Checkpoint', 'best validation PR-AUC'],
              ['Inputs', 'no labels, no future flows, no raw IPs/timestamps'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: /^[\d,]+$/.test(v) ? 'var(--font-mono)' : undefined, textAlign: 'right' }}>{v}</span>
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
            { name: 'NF-CICIDS2018-v3 Data', status: 'done' },
            { name: 'Leakage-safe Preprocessing', status: 'done' },
            { name: 'Session Split (train / val / test)', status: 'done' },
            { name: 'Causal Host-history Features', status: 'done' },
            { name: 'Next-5-flow Window Loader', status: 'done' },
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
