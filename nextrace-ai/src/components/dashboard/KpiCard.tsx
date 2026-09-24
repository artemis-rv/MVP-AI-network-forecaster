import { ReactNode, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SparklineChart } from '@/components/ui/SparklineChart';

interface KpiCardProps {
  label: string;
  value: number | string;
  change?: string | null;
  changeType: 'up' | 'down' | 'neutral';
  comparison: string;
  color: 'critical' | 'warning' | 'primary' | 'secondary' | 'live';
  icon: ReactNode;
  sparkline?: number[];
  delay?: number;
  onClick?: () => void;
}

const colorMap = {
  critical: { bg: 'rgba(239,68,68,0.1)', icon: 'var(--color-critical)', badge: 'var(--color-critical-light)', text: 'var(--color-critical)' },
  warning:  { bg: 'rgba(245,158,11,0.1)', icon: 'var(--color-warning)', badge: 'var(--color-warning-light)', text: 'var(--color-warning)' },
  primary:  { bg: 'rgba(99,102,241,0.1)', icon: 'var(--primary)', badge: 'var(--primary-light)', text: 'var(--primary)' },
  secondary:{ bg: 'rgba(6,182,212,0.1)', icon: 'var(--secondary)', badge: 'var(--secondary-light)', text: 'var(--secondary)' },
  live:     { bg: 'rgba(16,185,129,0.1)', icon: 'var(--color-live)', badge: 'var(--color-live-light)', text: 'var(--color-live)' },
};

export function KpiCard({ label, value, change, changeType, comparison, color, icon, sparkline, delay = 0, onClick }: KpiCardProps) {
  const [hovered, setHovered] = useState(false);
  const c = colorMap[color];

  const ChangeIcon =
    changeType === 'up' ? TrendingUp :
    changeType === 'down' ? TrendingDown :
    Minus;

  return (
    <div
      className="animate-fade-in-up"
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        border: '1px solid var(--border-default)',
        boxShadow: hovered ? 'var(--shadow-card-hover)' : 'var(--shadow-sm)',
        transition: 'all var(--transition-base)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        cursor: onClick ? 'pointer' : 'default',
        animationDelay: `${delay}ms`,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {/* Top row: icon + change badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: c.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: c.icon,
          }}
        >
          {icon}
        </div>
        {change && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 999,
              background:
                changeType === 'up' ? 'rgba(239,68,68,0.08)' :
                changeType === 'down' ? 'rgba(16,185,129,0.08)' :
                'rgba(148,163,184,0.1)',
              fontSize: 11,
              fontWeight: 700,
              color:
                changeType === 'up' ? 'var(--color-critical)' :
                changeType === 'down' ? 'var(--color-live)' :
                'var(--text-muted)',
            }}
          >
            <ChangeIcon size={11} />
            {change}
          </div>
        )}
      </div>

      {/* Value + Label */}
      <div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: 'var(--text-primary)',
            lineHeight: 1,
            letterSpacing: '-1px',
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
          {comparison}
        </div>
      </div>

      {/* Sparkline */}
      {sparkline && (
        <div style={{ height: 36 }}>
          <SparklineChart data={sparkline} color={c.icon} />
        </div>
      )}
    </div>
  );
}
