import type { ReactNode } from 'react';
import {
  BarChart3, Info, GitBranch, ClipboardCheck, ListChecks,
  Cpu, ShieldCheck, ArrowDown, CheckCircle2, Clock, Layers, Scale,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from 'recharts';

// Measured chronological test-set results. Values are fixed; do not recompute or round differently.
type ModelKey = 'lr' | 'lstm';

interface BenchmarkRow {
  task: string;
  model: string;
  modelKey: ModelKey;
  precision: number;
  recall: number;
  f1: number;
  fpr: number;
  prAuc: number;
}

const BENCHMARK_ROWS: BenchmarkRow[] = [
  { task: 'Next flow', model: 'Logistic Regression', modelKey: 'lr', precision: 13.7, recall: 57.5, f1: 22.1, fpr: 25.8, prAuc: 0.130 },
  { task: 'Next flow', model: 'LSTM + Attention', modelKey: 'lstm', precision: 29.4, recall: 39.8, f1: 33.8, fpr: 6.8, prAuc: 0.348 },
  { task: 'Next 5 flows', model: 'Logistic Regression', modelKey: 'lr', precision: 33.5, recall: 90.4, f1: 48.9, fpr: 66.5, prAuc: 0.338 },
  { task: 'Next 5 flows', model: 'LSTM + Attention Ensemble', modelKey: 'lstm', precision: 50.3, recall: 59.0, f1: 54.3, fpr: 21.7, prAuc: 0.565 },
];

// Same-feature K=5 benchmark: identical 141 features, chronological split, target and 336,386 test rows.
interface SameFeatureRow {
  model: string;
  modelKey: ModelKey;
  features: string;
  precision: number;
  recall: number;
  f1: number;
  fpr: number;
  rocAuc: number;
  prAuc: number;
  meetsTarget: boolean;
}

const SAME_FEATURE_ROWS: SameFeatureRow[] = [
  { model: 'Logistic Regression', modelKey: 'lr', features: '141', precision: 32.7, recall: 92.7, f1: 48.4, fpr: 70.8, rocAuc: 0.639, prAuc: 0.342, meetsTarget: false },
  { model: 'LSTM + Attention Ensemble', modelKey: 'lstm', features: '50 × 141', precision: 50.3, recall: 59.0, f1: 54.3, fpr: 21.7, rocAuc: 0.780, prAuc: 0.565, meetsTarget: true },
];

const SAME_FEATURE_CHART = (['precision', 'recall', 'f1', 'fpr'] as const).map((m) => ({
  metric: { precision: 'Precision', recall: 'Recall', f1: 'F1 Score', fpr: 'False Positive Rate' }[m],
  lr: SAME_FEATURE_ROWS[0][m],
  lstm: SAME_FEATURE_ROWS[1][m],
}));

const MODEL_COLORS: Record<ModelKey, string> = { lr: '#94a3b8', lstm: '#6366f1' };
const TEMPORAL = '#06b6d4';

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

function Note({ tone, icon, children }: { tone: 'info' | 'warning'; icon: ReactNode; children: ReactNode }) {
  const color = tone === 'warning' ? 'var(--color-warning)' : TEMPORAL;
  const bg = tone === 'warning' ? 'var(--color-warning-light)' : 'rgba(6, 182, 212, 0.10)';
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: bg, border: `1px solid ${color}`, borderRadius: 10, padding: '10px 14px', fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
      <span style={{ color, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>{children}</div>
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
                padding: '9px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
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
            {i < stages.length - 1 && <ArrowDown size={14} color="var(--text-muted)" style={{ margin: '3px 0' }} />}
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

function TargetChip({ met }: { met: boolean }) {
  const color = met ? 'var(--color-live)' : 'var(--color-critical)';
  const bg = met ? 'var(--color-live-light)' : 'var(--color-critical-light)';
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', color, background: bg, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {met ? 'MET' : 'NOT MET'}
    </span>
  );
}

function SameFeatureChart() {
  return (
    <div style={{ width: '100%', height: 280 }} data-testid="chart-same-feature">
      <ResponsiveContainer>
        <BarChart data={SAME_FEATURE_CHART} margin={{ top: 20, right: 12, left: -8, bottom: 0 }} barCategoryGap="26%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis dataKey="metric" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-default)' }} tickLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: 'var(--bg-card-hover)' }}
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }}
            formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} itemSorter="dataKey" />
          <Bar dataKey="lr" name="Logistic Regression (141 features)" fill={MODEL_COLORS.lr} radius={[4, 4, 0, 0]} maxBarSize={44}>
            <LabelList dataKey="lr" position="top" formatter={(v) => `${Number(v).toFixed(1)}%`} style={{ fontSize: 10.5, fill: 'var(--text-secondary)' }} />
          </Bar>
          <Bar dataKey="lstm" name="LSTM + Attention Ensemble (50 × 141)" fill={MODEL_COLORS.lstm} radius={[4, 4, 0, 0]} maxBarSize={44}>
            <LabelList dataKey="lstm" position="top" formatter={(v) => `${Number(v).toFixed(1)}%`} style={{ fontSize: 10.5, fill: 'var(--text-secondary)' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ModelBenchmarkPage() {
  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '11px 12px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' };
  const num: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <BarChart3 size={24} color="var(--primary)" /> Model Benchmark
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Chronological temporal forecasting benchmark</p>
      </div>

      {/* Final Same-Feature Benchmark (K=5) Table */}
      <section style={{ ...card, borderTop: `3px solid ${TEMPORAL}` }} data-testid="same-feature-benchmark">
        <SectionTitle
          icon={<Scale size={16} color={TEMPORAL} />}
          sub="Same 141 engineered features · same chronological split · same K=5 target · same 336,386 test rows · thresholds selected on validation only."
        >
          Final Same-Feature Benchmark (K=5)
        </SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table data-testid="same-feature-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
            <thead>
              <tr>
                <th style={th}>Model</th>
                <th style={th}>Features</th>
                <th style={{ ...th, textAlign: 'right' }}>Precision</th>
                <th style={{ ...th, textAlign: 'right' }}>Recall</th>
                <th style={{ ...th, textAlign: 'right' }}>F1</th>
                <th style={{ ...th, textAlign: 'right' }}>FPR</th>
                <th style={{ ...th, textAlign: 'right' }}>ROC-AUC</th>
                <th style={{ ...th, textAlign: 'right' }}>PR-AUC</th>
              </tr>
            </thead>
            <tbody>
              {SAME_FEATURE_ROWS.map((r) => (
                <tr key={r.model}>
                  <td style={td}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: MODEL_COLORS[r.modelKey] }} />
                      {r.model}
                    </span>
                  </td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{r.features}</td>
                  <td style={num}>{pct(r.precision)}</td>
                  <td style={num}>{pct(r.recall)}</td>
                  <td style={num}>{pct(r.f1)}</td>
                  <td style={num}>{pct(r.fpr)}</td>
                  <td style={num}>{r.rocAuc.toFixed(3)}</td>
                  <td style={num}>{r.prAuc.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Task-Level Comparison Table */}
      <section style={card}>
        <SectionTitle icon={<ListChecks size={16} color="var(--primary)" />} sub="Measured on the untouched chronological test set. Logistic Regression rows in this table use the original 53 features.">
          Current Forecasting Benchmark (Under Active Refinement)
        </SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table data-testid="benchmark-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={th}>Task</th>
                <th style={th}>Model</th>
                <th style={{ ...th, textAlign: 'right' }}>Precision</th>
                <th style={{ ...th, textAlign: 'right' }}>Recall</th>
                <th style={{ ...th, textAlign: 'right' }}>F1</th>
                <th style={{ ...th, textAlign: 'right' }}>FPR</th>
                <th style={{ ...th, textAlign: 'right' }}>PR-AUC</th>
              </tr>
            </thead>
            <tbody>
              {BENCHMARK_ROWS.map((r, i) => (
                <tr key={i} style={{ background: i >= 2 ? 'rgba(6, 182, 212, 0.04)' : undefined }}>
                  <td style={{ ...td, color: 'var(--text-secondary)' }}>{r.task}</td>
                  <td style={td}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: MODEL_COLORS[r.modelKey] }} />
                      {r.model}
                    </span>
                  </td>
                  <td style={num}>{pct(r.precision)}</td>
                  <td style={num}>{pct(r.recall)}</td>
                  <td style={num}>{pct(r.f1)}</td>
                  <td style={num}>{pct(r.fpr)}</td>
                  <td style={num}>{r.prAuc.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Visual Comparison - Single Graph Set Comparison */}
      <section style={card}>
        <SectionTitle
          icon={<BarChart3 size={16} color="var(--primary)" />}
          sub="Direct comparison across core classification metrics on identical 141-feature representations (K=5 horizon). Fixed 0–100% axis."
        >
          Visual Comparison
        </SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 20, alignItems: 'start' }}>
          <SameFeatureChart />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Note tone="info" icon={<Info size={15} />}>
              Both models utilize identical 141 engineered features and the same K=5 target. Logistic Regression operates strictly on the current-state representation, whereas LSTM + Attention consumes 50 preceding time steps to capture temporal sequences.
            </Note>

            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              The comparison confirms that sequence-based temporal modeling yields superior forecasting accuracy (ROC-AUC 0.780 vs 0.639) while reducing false alarms from 70.8% down to 21.7%.
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>
              Threshold rules: LR selected at best validation F1; LSTM ensemble at validation F1 with Precision ≥ 52% and FPR ≤ 30%. ROC-AUC and PR-AUC are threshold-independent.
            </div>
          </div>
        </div>
      </section>

      {/* Model status */}
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

      {/* Benchmark Requirement & Compliance */}
      <section style={{ ...card, borderLeft: '4px solid var(--primary)' }}>
        <SectionTitle icon={<ClipboardCheck size={16} color="var(--primary)" />}>
          Benchmark Requirement & Compliance
        </SectionTitle>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
          Operational deployment requires evaluating temporal forecasting against the classical baseline under target criteria: <strong>Precision ≥ 50%</strong>, <strong>Recall ≥ 50%</strong>, and <strong>FPR ≤ 30%</strong>.
        </p>
        <div style={{ background: 'var(--color-live-light)', border: '1px solid var(--color-live)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.6px', color: 'var(--color-live)', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={13} /> Operational Criteria Met
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            The <strong>LSTM + Attention Ensemble</strong> meets all operational criteria (50.3% precision, 59.0% recall, 21.7% FPR). The Logistic Regression baseline fails deployment standards due to an unsustainable 70.8% false positive rate and insufficient precision (32.7%).
          </div>
        </div>
      </section>

      {/* Model details and data integrity */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <div style={{ ...card, borderTop: `3px solid ${MODEL_COLORS.lstm}` }}>
          <SectionTitle icon={<Cpu size={16} color={MODEL_COLORS.lstm} />}>LSTM + Attention Ensemble</SectionTitle>
          <Bullets items={[
            'Temporal sequence length: 50 flows',
            'Multi-head temporal attention mechanism',
            '4-model checkpoint ensemble',
            'Identical K=5 future flow prediction horizon',
            'Validated threshold on held-out split',
          ]} />
        </div>
        <div style={{ ...card, borderTop: `3px solid ${MODEL_COLORS.lr}` }}>
          <SectionTitle icon={<Cpu size={16} color={MODEL_COLORS.lr} />}>Logistic Regression Baseline</SectionTitle>
          <Bullets items={[
            'Chronological training & test split',
            'Validation threshold selection',
            'Standardized 141 engineered features',
            'Current-state input representation (non-sequential)',
            'Identical K=5 future flow prediction horizon',
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
    </div>
  );
}
