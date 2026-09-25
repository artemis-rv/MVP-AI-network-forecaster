// NEXTRACE AI — Related Activity Table (Investigation)

import { useState } from 'react';
import { useLiveStore } from '@/store/liveStore';
import { useInvestigationStore } from '@/store/investigationStore';

type ClassFilter = 'All' | 'benign' | 'suspicious';
type ProtoFilter = 'All' | 'TCP' | 'UDP' | 'ICMP' | 'DNS' | 'HTTP';


export function RelatedActivityTable() {
  const { displayEvents } = useLiveStore();
  const [classFilter, setClassFilter] = useState<ClassFilter>('All');
  const [protoFilter, setProtoFilter] = useState<ProtoFilter>('All');

  const { investigation } = useInvestigationStore();
  const entityIp = investigation?.selectedEntityIp;

  // Build rows based on the selected entity
  type Row = { id: string; timestamp: string; protocol: string; src: string; dst: string; port: number; packets: number; classification: 'benign' | 'suspicious' };
  const allRows: Row[] = displayEvents
    .filter(e => !entityIp || e.src_ip === entityIp || e.dst_ip === entityIp)
    .slice(0, 100)
    .map((e, i) => ({
        id: `live-${i}`,
        timestamp: e.timestamp.slice(11, 19) || e.timestamp,
        protocol: e.protocol,
        src: e.src_ip,
        dst: e.dst_ip,
        port: e.dst_port,
        packets: 1,
        classification: e.classification,
    }));

  const rows = allRows;

  const filtered = rows.filter(r =>
    (classFilter === 'All' || r.classification === classFilter) &&
    (protoFilter === 'All' || r.protocol.toUpperCase() === protoFilter)
  );

  const susCount  = rows.filter(r => r.classification === 'suspicious').length;
  const benCount  = rows.filter(r => r.classification === 'benign').length;

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', overflow: 'hidden', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Related Network Activity</h3>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {susCount} suspicious · {benCount} benign · {rows.length} total
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <FilterPills
            value={classFilter}
            options={['All', 'suspicious', 'benign']}
            onChange={v => setClassFilter(v as ClassFilter)}
            colorMap={{ suspicious: '#ef4444', benign: '#10b981', All: 'var(--primary)' }}
          />
          <FilterPills
            value={protoFilter}
            options={['All', 'TCP', 'UDP', 'ICMP', 'DNS', 'HTTP']}
            onChange={v => setProtoFilter(v as ProtoFilter)}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-workspace)', zIndex: 1 }}>
            <tr>
              {['Timestamp', 'Protocol', 'Source', 'Destination', 'Port', 'Pkts', 'Class'].map(col => (
                <th key={col} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 10, letterSpacing: '0.4px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: 12 }}>No matching events</td></tr>
            ) : filtered.map((row, i) => (
              <tr key={row.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-workspace)', borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{row.timestamp}</td>
                <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{row.protocol}</td>
                <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{row.src}</td>
                <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{row.dst}</td>
                <td style={{ padding: '6px 10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{row.port || '—'}</td>
                <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{row.packets}</td>
                <td style={{ padding: '6px 10px' }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, letterSpacing: '0.3px',
                    background: row.classification === 'suspicious' ? '#fee2e2' : '#d1fae5',
                    color: row.classification === 'suspicious' ? '#b91c1c' : '#065f46',
                  }}>
                    {row.classification.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterPills({ value, options, onChange, colorMap }: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  colorMap?: Record<string, string>;
}) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {options.map(opt => {
        const active = value === opt;
        const color = colorMap?.[opt] ?? 'var(--primary)';
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: active ? color : 'var(--bg-workspace)',
              color: active ? 'white' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
