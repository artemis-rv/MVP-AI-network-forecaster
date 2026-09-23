import { useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { trafficData } from '@/data/mockData';

interface ChartDataPoint {
  time: string;
  total?: number;
  benign?: number;
  suspicious?: number;
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
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: p.color, marginBottom: 2 }}>
          <span>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{p.value.toLocaleString()} pps</span>
        </div>
      ))}
    </div>
  );
};

export function LiveNetworkChart({ data: externalData, isLive: externalIsLive }: { data?: ChartDataPoint[]; isLive?: boolean } = {}) {
  const [range, setRange] = useState('Last 15 min');

  const slice = range === 'Last 5 min' ? 10 : range === 'Last 15 min' ? 20 : 30;
  const data = externalData ?? trafficData.slice(-slice);
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
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Live Network Activity</h3>
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
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 12, fontStyle: 'italic' }}>
        ⚠ Simulated demo data — not real network traffic
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gBenign" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gSuspicious" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
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
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          <Area type="monotone" dataKey="total" name="Total" stroke="#6366f1" strokeWidth={2} fill="url(#gTotal)" dot={false} />
          <Area type="monotone" dataKey="benign" name="Benign" stroke="#10b981" strokeWidth={1.5} fill="url(#gBenign)" dot={false} />
          <Area type="monotone" dataKey="suspicious" name="Suspicious" stroke="#ef4444" strokeWidth={1.5} fill="url(#gSuspicious)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
