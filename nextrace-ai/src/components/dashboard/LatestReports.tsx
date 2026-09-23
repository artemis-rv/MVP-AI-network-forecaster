import { latestReports } from '@/data/mockData';
import { ChevronRight, CheckCircle } from 'lucide-react';

export function LatestReports() {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Latest Reports</h3>
        <button
          style={{
            fontSize: 12,
            color: 'var(--primary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          View All <ChevronRight size={13} />
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-workspace)' }}>
              {['Report Name', 'Type', 'Generated At', 'Status'].map((col) => (
                <th
                  key={col}
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.4px',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {latestReports.map((report) => (
              <ReportRow key={report.id} report={report} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportRow({ report }: { report: typeof latestReports[0] }) {
  return (
    <tr
      style={{ borderTop: '1px solid var(--border-subtle)', transition: 'background var(--transition-fast)', cursor: 'pointer' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-workspace)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <td style={{ padding: '13px 16px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
          {report.name}
        </span>
      </td>
      <td style={{ padding: '13px 16px' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 999,
            background: 'var(--primary-light)',
            color: 'var(--primary)',
          }}
        >
          {report.type}
        </span>
      </td>
      <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {report.generatedAt}
      </td>
      <td style={{ padding: '13px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <CheckCircle size={13} color="var(--color-live)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-live)' }}>
            {report.status}
          </span>
        </div>
      </td>
    </tr>
  );
}
