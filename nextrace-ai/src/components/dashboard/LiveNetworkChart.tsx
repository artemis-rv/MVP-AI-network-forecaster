import { useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { trafficData } from '@/data/mockData';
import { AlertTriangle } from 'lucide-react';

interface ChartDataPoint {
  time: string;
  total?: number;
  events?: number;
  // mock fields
  [key: string]: unknown;
}

const TIME_RANGES = ['Last 5 min', 'Last 15 min', 'Last 30 min'];

interface TooltipPayload {
  color: string;
  name: string;
  value: number;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: 'var(--shadow-md)',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: p.color }}>
            <span>{p.name}:</span>
            <span style={{ fontWeight: 700 }}>
              {p.value.toLocaleString()} {p.name === 'Events' ? 'occurrences' : 'pps'}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, maxWidth: 200, whiteSpace: 'normal' }}>
            {p.name === 'Events' ? 'Number of suspicious activities or attacks flagged by AI heuristics.' : 'Volume of raw network packets processed per second.'}
          </div>
        </div>
      ))}
    </div>
  );
};

export function LiveNetworkChart({ data: externalData, isLive: externalIsLive }: { data?: ChartDataPoint[]; isLive?: boolean } = {}) {
  const [range, setRange] = useState('Last 15 min');

  const slice = range === 'Last 5 min' ? 10 : range === 'Last 15 min' ? 20 : 30;
  const sourceData = externalData ?? trafficData;
  const data = sourceData.slice(-slice);
  const isLiveDisplay = externalIsLive ?? true;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sm)',
        height: '100%',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Traffic &amp; Security Events</h3>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.5px',
              color: isLiveDisplay ? 'var(--color-live)' : 'var(--text-muted)',
              background: isLiveDisplay ? 'rgba(16,185,129,0.1)' : 'var(--bg-input)',
              border: `1px solid ${isLiveDisplay ? 'rgba(16,185,129,0.25)' : 'var(--border-default)'}`,
              borderRadius: 999,
              padding: '2px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {isLiveDisplay && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-live)', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />}
            {isLiveDisplay ? 'LIVE' : 'DEMO'}
          </span>
        </div>
        {/* Time range */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: range === r ? 'var(--primary)' : 'var(--border-default)',
                background: range === r ? 'var(--primary-light)' : 'white',
                color: range === r ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Demo label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)', marginBottom: 12, fontStyle: 'italic' }}>
        <AlertTriangle size={11} style={{ flexShrink: 0 }} />
        <span>Simulated demo data — not real network traffic</span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--text-muted)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="var(--text-muted)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gEvents" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            interval={Math.floor(data.length / 4)}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: '#ef4444' }}
            tickLine={false}
            axisLine={false}
            hide={true}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          <Area yAxisId="left" type="monotone" dataKey="total" name="Total Traffic" stroke="var(--text-muted)" strokeWidth={1} fill="url(#gTotal)" dot={false} />
          <Area yAxisId="right" type="step" dataKey="events" name="Events" stroke="#ef4444" strokeWidth={2} fill="url(#gEvents)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      
      {/* Simple Explanation Below Graph */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center', lineHeight: 1.4 }}>
        This graph shows the total volume of network traffic (packets per second) versus the number of suspicious security events detected over time. A spike in the red line indicates a potential attack or anomalous behavior.
      </div>
    </div>
  );
}
