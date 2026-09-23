type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

const CONFIG: Record<Severity, { bg: string; text: string; dot: string }> = {
  Critical: { bg: 'var(--color-critical-light)', text: 'var(--color-critical)', dot: '#ef4444' },
  High:     { bg: 'var(--color-high-light)',     text: 'var(--color-high)',     dot: '#f97316' },
  Medium:   { bg: 'var(--color-medium-light)',   text: 'var(--color-medium)',   dot: '#eab308' },
  Low:      { bg: 'var(--color-low-light)',      text: 'var(--color-low)',      dot: '#10b981' },
};

export function Badge({ severity }: { severity: Severity }) {
  const c = CONFIG[severity];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 999,
        background: c.bg,
        fontSize: 11,
        fontWeight: 700,
        color: c.text,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, display: 'inline-block', flexShrink: 0 }} />
      {severity}
    </span>
  );
}
