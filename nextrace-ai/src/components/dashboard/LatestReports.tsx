import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, CheckCircle, FileText, AlertTriangle } from 'lucide-react';
import { useFindingsStore } from '@/store/findingsStore';
import type { ReportListItem } from '@/types/report';

function tsShort(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export function LatestReports() {
  const navigate = useNavigate();
  const { reportList, fetchReportList } = useFindingsStore();

  // Load reports on mount — non-blocking, silently ignores errors
  useEffect(() => {
    fetchReportList();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasRealReports = reportList.length > 0;

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
          onClick={() => navigate('/reports')}
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
            {hasRealReports ? (
              reportList.slice(0, 5).map((r) => (
                <RealReportRow key={r.report_id} report={r} onClick={() => navigate(`/reports/${r.report_id}`)} />
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                  No reports generated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {hasRealReports && (
          <div style={{ padding: '8px 16px 10px', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <FileText size={11} />
            {reportList.length} generated report{reportList.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

function RealReportRow({ report, onClick }: { report: ReportListItem; onClick: () => void }) {
  const isSim = report.report_type === 'simulation';
  return (
    <tr
      onClick={onClick}
      style={{ borderTop: '1px solid var(--border-subtle)', transition: 'background var(--transition-fast)', cursor: 'pointer' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-workspace)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <td style={{ padding: '13px 16px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
          {report.title.slice(0, 44)}{report.title.length > 44 ? '…' : ''}
        </span>
      </td>
      <td style={{ padding: '13px 16px' }}>
        <span
          style={{
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
            background: isSim ? 'rgba(239,68,68,0.1)' : 'var(--primary-light)',
            color: isSim ? '#dc2626' : 'var(--primary)',
          }}
        >
          {isSim ? 'SIMULATION' : 'HISTORICAL'}
        </span>
      </td>
      <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {tsShort(report.generated_at)}
      </td>
      <td style={{ padding: '13px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {report.status === 'GENERATED'
            ? <CheckCircle size={13} color="var(--color-live)" />
            : <AlertTriangle size={13} color="#d97706" />
          }
          <span style={{ fontSize: 12, fontWeight: 600, color: report.status === 'GENERATED' ? 'var(--color-live)' : '#d97706' }}>
            {report.status}
          </span>
        </div>
      </td>
    </tr>
  );
}

