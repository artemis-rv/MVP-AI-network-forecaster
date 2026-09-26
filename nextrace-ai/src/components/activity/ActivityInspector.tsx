// NEXTRACE AI — Deep inspection drawer for a grouped activity
// Shows only fields that exist in the underlying data. Anything the source does not carry
// (bytes for detector indicators, TCP flags for non-TCP traffic, payload text, …) is labelled
// "not available" instead of being synthesised.

import { X, Search, Info } from 'lucide-react';
import type { EntityRelationship } from '@/types/historical';
import {
  type GroupedActivity, GROUPING, isActivityActive,
  formatActivityBytes, formatActivityDuration,
} from '@/lib/activityGrouping';
import { SeverityPill } from '@/components/activity/ActivityList';
import { SEVERITY_STYLE } from '@/components/activity/severity';

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour12: false });
}

const NA = 'Not available in source data';

export function ActivityInspector({
  activity, allActivities = [], relationships, live = false, sourceNote, onSelect, onInvestigate, onClose,
}: {
  activity: GroupedActivity;
  allActivities?: GroupedActivity[];
  relationships?: EntityRelationship[];
  live?: boolean;
  sourceNote?: string;
  onSelect?: (a: GroupedActivity) => void;
  onInvestigate?: (ip: string) => void;
  onClose: () => void;
}) {
  const a = activity;
  const sev = SEVERITY_STYLE[a.severity];
  const hosts = [...a.sources, ...a.targets.filter(t => !a.sources.includes(t))];
  const related = allActivities.filter(o => o.id !== a.id && o.significant &&
    [...o.sources, ...o.targets].some(h => hosts.includes(h)));
  const pairs = (relationships ?? []).filter(r => a.sources.includes(r.src_ip) && (a.targets.includes(r.dst_ip) || a.targets.includes('multiple_targets')));
  const flags = Object.entries(a.tcpFlags).sort((x, y) => y[1] - x[1]);
  const patterns = Object.entries(a.payloadPatterns).sort((x, y) => y[1] - x[1]);
  const hasTcp = a.protocols.some(p => p.toUpperCase() === 'TCP');

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.25)', zIndex: 999 }} />
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 620, maxWidth: '100vw', zIndex: 1000,
        background: 'var(--bg-card)', borderLeft: '1px solid var(--border-default)', boxShadow: '-4px 0 24px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', animation: 'slide-in-right 0.25s ease-out',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Deep inspection · <span style={{ fontFamily: 'var(--font-mono)' }}>{a.id}</span>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>{a.label}</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 11 }}>
              <SeverityPill severity={a.severity} />
              <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{a.confidence}% confidence</span>
              <span style={{ color: 'var(--text-muted)' }}>· {a.stage}</span>
              {live && <span style={{ fontWeight: 700, color: isActivityActive(a) ? 'var(--color-live)' : 'var(--text-muted)' }}>· {isActivityActive(a) ? 'ongoing' : 'ended'}</span>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', alignSelf: 'flex-start' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {sourceNote && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-workspace)', borderRadius: 8, padding: '8px 10px' }}>
              <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {sourceNote}
            </div>
          )}

          {/* Why flagged */}
          <Block title="Why it was flagged">
            <div style={{ padding: '10px 12px', borderLeft: `3px solid ${sev.color}`, background: `${sev.color}0d`, borderRadius: '0 8px 8px 0', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {a.reason}
            </div>
            {a.detectorReasons.length > 1 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {a.detectorReasons.map((r, i) => <li key={i}>{r.split('(Demo')[0].trim()}</li>)}
              </ul>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
              Grouped because each event scored ≥ {GROUPING.threshold} similarity (activity type, source, protocol, target, port)
              with this group while it was active.
            </div>
          </Block>

          {/* Core facts */}
          <Grid>
            <Fact label="Time range" value={`${clock(a.firstSeen)} – ${clock(a.lastSeen)}`} sub={formatActivityDuration(a.lastSeen - a.firstSeen)} mono />
            <Fact label="Events grouped" value={a.eventCount.toLocaleString()} sub={a.detectorConfirmed ? 'detector indicators' : 'packets'} mono />
            <Fact label="Source" value={a.sources.join(', ')} mono />
            <Fact label={`Target${a.targets.length > 1 ? `s (${a.targets.length})` : ''}`} value={a.targets.join(', ')} mono />
            <Fact label="Protocol(s)" value={a.protocols.join(', ')} />
            <Fact label="Bytes" value={a.bytes !== null ? formatActivityBytes(a.bytes) : NA} muted={a.bytes === null} />
          </Grid>

          <Block title={`Destination ports (${a.portCount})`}>
            {a.ports.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[...a.ports].sort((x, y) => x - y).slice(0, 60).map(p => <Chip key={p}>{p}</Chip>)}
                {a.portCount > 60 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{a.portCount - 60} more</span>}
              </div>
            ) : <Muted>{NA}</Muted>}
          </Block>

          <Block title="TCP flags">
            {flags.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {flags.map(([f, c]) => <Chip key={f}>{f} × {c}</Chip>)}
              </div>
            ) : <Muted>{hasTcp ? 'Not present in captured header metadata' : 'Not applicable (no TCP traffic)'}</Muted>}
          </Block>

          <Block title="Request / payload metadata">
            {patterns.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {patterns.map(([p, c]) => (
                  <div key={p} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-workspace)', borderRadius: 6, padding: '5px 8px' }}>
                    <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{p.replace(/^dns:/, 'DNS query ')}</span>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>×{c}</span>
                  </div>
                ))}
                <Muted>Header summaries as recorded per packet; numbers normalised to “#”. Full payloads are not retained.</Muted>
              </div>
            ) : <Muted>{NA}</Muted>}
          </Block>

          {a.mitre && (
            <Block title="MITRE ATT&CK">
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--primary)', background: 'var(--bg-workspace)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 10px' }}>
                {a.mitre.id} — {a.mitre.name} <span style={{ color: 'var(--text-muted)' }}>({a.mitre.tactic})</span>
              </div>
            </Block>
          )}

          <Block title="Related hosts">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {hosts.map(h => (
                <button key={h} disabled={!onInvestigate || h === 'multiple_targets'} onClick={() => onInvestigate?.(h)}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: onInvestigate ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {onInvestigate && h !== 'multiple_targets' && <Search size={10} />}{h}
                  <span style={{ color: 'var(--text-muted)' }}>{a.sources.includes(h) ? 'src' : 'dst'}</span>
                </button>
              ))}
            </div>
            {pairs.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {pairs.map(p => (
                  <div key={`${p.src_ip}-${p.dst_ip}`} style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {p.src_ip} → {p.dst_ip}: {p.packet_count} pkts · {formatActivityBytes(p.byte_count)}
                    <span style={{ color: 'var(--text-muted)' }}> (all traffic between these hosts)</span>
                  </div>
                ))}
              </div>
            )}
          </Block>

          {related.length > 0 && (
            <Block title="Related activities (shared hosts)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {related.map(o => (
                  <button key={o.id} onClick={() => onSelect?.(o)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, textAlign: 'left', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-workspace)', cursor: onSelect ? 'pointer' : 'default' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{o.label} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{o.id}</span></span>
                    <SeverityPill severity={o.severity} />
                  </button>
                ))}
              </div>
            </Block>
          )}

          <Block title={`Events in this group (latest ${a.samples.length} of ${a.eventCount})`}>
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'auto', maxHeight: 260 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead style={{ position: 'sticky', top: 0 }}>
                  <tr style={{ background: 'var(--bg-workspace)' }}>
                    {['Time', 'Source', 'Destination', 'Proto', 'Size', 'Header / info'].map(c => (
                      <th key={c} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...a.samples].reverse().map((s, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={cell}>{clock(s.ts)}</td>
                      <td style={cell}>{s.src}{s.srcPort ? `:${s.srcPort}` : ''}</td>
                      <td style={cell}>{s.dst}{s.dstPort ? `:${s.dstPort}` : ''}</td>
                      <td style={cell}>{s.protocol}</td>
                      <td style={cell}>{s.bytes !== undefined ? `${s.bytes} B` : '—'}</td>
                      <td style={{ ...cell, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.info}>{s.info ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Block>

          {onInvestigate && (
            <button onClick={() => onInvestigate(a.sources[0])}
              style={{ padding: '10px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Search size={14} /> Investigate source {a.sources[0]}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

const cell: React.CSSProperties = { padding: '5px 8px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' };

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{title}</h3>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>{children}</div>;
}

function Fact({ label, value, sub, mono, muted }: { label: string; value: string; sub?: string; mono?: boolean; muted?: boolean }) {
  return (
    <div style={{ background: 'var(--bg-workspace)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 10px', minWidth: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: muted ? 11 : 12, fontWeight: muted ? 500 : 700, color: muted ? 'var(--text-muted)' : 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'inherit', wordBreak: 'break-word', fontStyle: muted ? 'italic' : 'normal' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '2px 7px', borderRadius: 6, background: 'var(--bg-workspace)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{children}</span>;
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{children}</div>;
}
