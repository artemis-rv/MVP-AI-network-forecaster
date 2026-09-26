// NEXTRACE AI — Compact tab strip (replaces long single-column scrolling on analysis pages)

export interface TabDef<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export function Tabs<T extends string>({ tabs, active, onChange, tourId }: {
  tabs: TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  tourId?: string;
}) {
  return (
    <div role="tablist" data-tour={tourId} style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border-default)', overflowX: 'auto' }}>
      {tabs.map(t => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              padding: '9px 14px', fontSize: 13, fontWeight: on ? 700 : 600, whiteSpace: 'nowrap',
              background: 'none', border: 'none', borderBottom: `2px solid ${on ? 'var(--primary)' : 'transparent'}`,
              color: on ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', marginBottom: -1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {t.label}
            {t.count !== undefined && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: on ? 'var(--primary-light)' : 'var(--bg-workspace)', color: on ? 'var(--primary)' : 'var(--text-muted)' }}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
