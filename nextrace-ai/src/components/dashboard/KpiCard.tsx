import { ReactNode, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SparklineChart } from '@/components/ui/SparklineChart';
import { KpiHoverDetails } from '@/data/mockData';

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
  hoverDetails?: KpiHoverDetails;
  popoverAlign?: 'left' | 'right';
  onClick?: () => void;
}

const colorMap = {
  critical: { bg: 'rgba(239,68,68,0.1)', icon: 'var(--color-critical)', badge: 'var(--color-critical-light)', text: 'var(--color-critical)' },
  warning:  { bg: 'rgba(245,158,11,0.1)', icon: 'var(--color-warning)', badge: 'var(--color-warning-light)', text: 'var(--color-warning)' },
  primary:  { bg: 'rgba(99,102,241,0.1)', icon: 'var(--primary)', badge: 'var(--primary-light)', text: 'var(--primary)' },
  secondary:{ bg: 'rgba(6,182,212,0.1)', icon: 'var(--secondary)', badge: 'var(--secondary-light)', text: 'var(--secondary)' },
  live:     { bg: 'rgba(16,185,129,0.1)', icon: 'var(--color-live)', badge: 'var(--color-live-light)', text: 'var(--color-live)' },
};

export function KpiCard({
  label,
  value,
  change,
  changeType,
  comparison,
  color,
  icon,
  sparkline,
  delay = 0,
  hoverDetails,
  onClick,
}: KpiCardProps) {
  const [cardHovered, setCardHovered] = useState(false);
  const [timelineHovered, setTimelineHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const c = colorMap[color];
  const isTooltipActive = timelineHovered || focused;

  const ChangeIcon =
    changeType === 'up' ? TrendingUp :
    changeType === 'down' ? TrendingDown :
    Minus;

  // Display badge text
  const displayChange = change || 'Active';

  // Sync current value with first item of hover details if labels match
  const effectiveHoverDetails = hoverDetails ? {
    ...hoverDetails,
    items: hoverDetails.items.map((item, idx) => {
      if (idx === 0 && (item.label === label || item.label === hoverDetails.title || item.label.startsWith('Total') || item.label.startsWith('High') || item.label.startsWith('Active') || item.label.startsWith('Resolutions'))) {
        return { ...item, value };
      }
      return item;
    }),
  } : undefined;

  const handleTimelineMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setTimelineHovered(true);
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleTimelineMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setTimelineHovered(false);
      setMousePos(null);
    }, 50);
  };

  // Calculate dynamic cursor-following position
  const getTooltipCoords = () => {
    const tooltipWidth = 230;
    const tooltipHeight = 150;
    const margin = 12;

    let x = mousePos ? mousePos.x : 0;
    let y = mousePos ? mousePos.y : 0;

    // Fallback if mousePos not set yet
    if (!mousePos && timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top;
    } else if (!mousePos && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      x = rect.right - 40;
      y = rect.top + 20;
    }

    // Horizontal offset: place slightly right of cursor
    let calculatedLeft = x + 14;
    if (calculatedLeft + tooltipWidth > window.innerWidth - margin) {
      calculatedLeft = x - tooltipWidth - 14;
    }

    let calculatedTop = y - tooltipHeight - 12;
    let isDownwardDirection = false;

    if (calculatedTop < margin) {
      calculatedTop = y + 16;
      isDownwardDirection = true;
    }

    // Clamp coordinates strictly within viewport bounds
    const finalLeft = Math.max(margin, Math.min(calculatedLeft, window.innerWidth - tooltipWidth - margin));
    const finalTop = Math.max(margin, Math.min(calculatedTop, window.innerHeight - tooltipHeight - margin));

    return {
      top: finalTop,
      left: finalLeft,
      isDownwardDirection,
    };
  };

  const coords = isTooltipActive ? getTooltipCoords() : null;
  const tooltipId = `kpi-tooltip-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  return (
    <div
      ref={cardRef}
      className="animate-fade-in-up"
      tabIndex={0}
      role="button"
      aria-label={`${label}: ${value}. ${comparison}`}
      aria-expanded={isTooltipActive}
      aria-describedby={effectiveHoverDetails ? tooltipId : undefined}
      style={{
        position: 'relative',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        border: cardHovered ? `1px solid ${c.icon}` : '1px solid var(--border-default)',
        boxShadow: cardHovered ? 'var(--shadow-card-hover)' : 'var(--shadow-sm)',
        transition: 'border-color var(--transition-base), box-shadow var(--transition-base), transform var(--transition-base)',
        transform: cardHovered ? 'translateY(-2px)' : 'none',
        cursor: onClick ? 'pointer' : 'default',
        animationDelay: `${delay}ms`,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        outline: focused ? `2px solid ${c.icon}` : 'none',
        outlineOffset: '2px',
      }}
      onMouseEnter={() => setCardHovered(true)}
      onMouseLeave={() => setCardHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (onClick) {
            e.preventDefault();
            onClick();
          }
        } else if (e.key === 'Escape') {
          setFocused(false);
          setTimelineHovered(false);
        }
      }}
      onClick={onClick}
    >
      {/* Top row: icon + trend indicator badge */}
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

        {/* Trend Indicator Badge Point */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 9px',
            borderRadius: 999,
            background:
              changeType === 'up' ? 'rgba(239,68,68,0.08)' :
              changeType === 'down' ? 'rgba(16,185,129,0.08)' :
              'rgba(148,163,184,0.12)',
            fontSize: 11,
            fontWeight: 700,
            color:
              changeType === 'up' ? 'var(--color-critical)' :
              changeType === 'down' ? 'var(--color-live)' :
              'var(--text-secondary)',
          }}
        >
          {change && <ChangeIcon size={11} />}
          {displayChange}
        </div>
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

      {/* Sparkline Timeline Container — Popover activates strictly when hovering on this area */}
      {sparkline && (
        <div
          ref={timelineRef}
          style={{
            height: 36,
            borderRadius: 6,
            padding: '2px 4px',
            margin: '-2px -4px',
            transition: 'background 0.15s ease',
            background: timelineHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
            cursor: 'crosshair',
          }}
          onMouseEnter={handleTimelineMouseEnter}
          onMouseMove={handleTimelineMouseMove}
          onMouseLeave={handleTimelineMouseLeave}
        >
          <SparklineChart data={sparkline} color={c.icon} />
        </div>
      )}

      {/* Dynamic Cursor-Following Tooltip Rendered Via Portal */}
      {isTooltipActive && effectiveHoverDetails && coords && createPortal(
        <div
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            zIndex: 9999,
            width: 230,
            pointerEvents: 'none',
            transition: 'top 60ms linear, left 60ms linear',
          }}
        >
          <div
            id={tooltipId}
            role="tooltip"
            aria-label={`${effectiveHoverDetails.title} details`}
            style={{
              position: 'relative',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.2), 0 4px 10px -2px rgba(15, 23, 42, 0.1)',
              padding: '10px 12px',
              backdropFilter: 'blur(8px)',
            }}
          >
            {/* Caret indicator pointing towards cursor */}
            <div
              style={{
                position: 'absolute',
                width: 7,
                height: 7,
                background: 'var(--bg-card)',
                transform: 'rotate(45deg)',
                ...(coords.isDownwardDirection
                  ? { top: -4, left: 16, borderLeft: '1px solid var(--border-default)', borderTop: '1px solid var(--border-default)' }
                  : { bottom: -4, left: 16, borderRight: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }),
              }}
            />

            {/* Compact Metric Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {effectiveHoverDetails.items.map((item, idx) => {
                let valColor = 'var(--text-primary)';
                let valWeight = 600;

                if (item.highlight === 'critical') {
                  valColor = 'var(--color-critical)';
                  valWeight = 700;
                } else if (item.highlight === 'warning') {
                  valColor = 'var(--color-warning)';
                  valWeight = 700;
                } else if (item.highlight === 'live') {
                  valColor = 'var(--color-live)';
                  valWeight = 700;
                } else if (item.highlight === 'primary') {
                  valColor = 'var(--primary)';
                  valWeight = 700;
                } else if (item.highlight === 'muted') {
                  valColor = 'var(--text-muted)';
                  valWeight = 500;
                }

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 11,
                      gap: 10,
                      lineHeight: '1.35',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {item.label}
                    </span>
                    <span
                      style={{
                        color: valColor,
                        fontWeight: valWeight,
                        textAlign: 'right',
                        fontFamily: typeof item.value === 'number' || (typeof item.value === 'string' && /^\d/.test(item.value)) ? 'var(--font-mono)' : 'inherit',
                        wordBreak: 'break-word',
                        maxWidth: '130px',
                      }}
                    >
                      {item.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


