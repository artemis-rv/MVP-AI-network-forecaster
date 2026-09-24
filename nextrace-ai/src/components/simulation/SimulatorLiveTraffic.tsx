import { Activity, ArrowRight, Circle } from 'lucide-react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { SimEvent, SyntheticFeatureProfile } from '@/types/simulator';

function fmtBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function SimulatorLiveTraffic({
  event, features, history, status, currentStep, totalSteps,
}: {
  event: SimEvent | null;
  features: SyntheticFeatureProfile | null;
  history: SimEvent[];
  status: string;
  currentStep: number;
  totalSteps: number;
}) {
  if (!event) {
    return (
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 18, color: 'var(--text-muted)', fontSize: 12 }}>
        Live traffic will appear when the simulation reaches its first step.
      </div>
    );
  }

  const suspiciousRatio = features?.suspicious_ratio ?? event.synthetic_feature_profile.suspicious_ratio;
  const stats = [
    ['Packets', event.packet_count.toLocaleString()],
    ['Bytes', fmtBytes(event.byte_count)],
    ['Connections', event.connection_count.toLocaleString()],
    ['Suspicious ratio', `${(suspiciousRatio * 100).toFixed(0)}%`],
  ];
  const chartData = history.map(stepEvent => ({
    step: `Step ${stepEvent.step + 1}`,
    packets: stepEvent.packet_count,
    bytes: stepEvent.byte_count,
    connections: stepEvent.connection_count,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Circle size={9} fill="#dc2626" color="#dc2626" />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#b91c1c', letterSpacing: '0.5px' }}>CURRENT / LIVE TRAFFIC</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Step {currentStep + 1} of {totalSteps}</span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{status}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {stats.map(([label, value]) => (
          <div key={label} style={{ background: 'var(--bg-workspace)', borderRadius: 9, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color: label === 'Suspicious ratio' && suspiciousRatio > 0.3 ? 'var(--color-critical)' : 'var(--text-primary)' }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Traffic Trend</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Packets / connections · bytes</span>
        </div>
        <div style={{ width: '100%', height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <XAxis dataKey="step" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="counts" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={42} />
              <YAxis yAxisId="bytes" orientation="right" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={42} tickFormatter={fmtBytes} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}
                formatter={(value, name) => {
                  const metric = String(name);
                  const numericValue = Number(value ?? 0);
                  return [metric === 'bytes' ? fmtBytes(numericValue) : numericValue.toLocaleString(), metric === 'bytes' ? 'Bytes' : metric === 'packets' ? 'Packets' : 'Connections'];
                }}
              />
              <Line yAxisId="counts" type="monotone" dataKey="packets" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 4 }} />
              <Line yAxisId="counts" type="monotone" dataKey="connections" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 4 }} />
              <Line yAxisId="bytes" type="monotone" dataKey="bytes" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
          <span style={{ color: '#6366f1' }}>● Packets</span>
          <span style={{ color: '#06b6d4' }}>● Connections</span>
          <span style={{ color: '#f59e0b' }}>● Bytes</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'var(--bg-workspace)', borderRadius: 9, padding: '10px 12px' }}>
        <Activity size={14} color="var(--primary)" />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{event.source}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{event.source_label}:{event.source_port}</span>
        <ArrowRight size={14} color="var(--primary)" />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{event.destination}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{event.destination_label}:{event.destination_port}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', color: 'var(--primary)' }}>{event.protocol}</span>
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)' }}>
        <span>Current stage: <strong style={{ color: 'var(--text-primary)' }}>{event.stage}</strong></span>
        <span>Current step: <strong style={{ color: 'var(--text-primary)' }}>{event.step + 1}</strong></span>
      </div>
    </div>
  );
}