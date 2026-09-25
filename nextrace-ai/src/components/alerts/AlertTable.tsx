import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/Badge';
import type { Alert } from '@/types/alert';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface AlertTableProps {
  alerts: Alert[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const severityMap: Record<string, 'Critical' | 'High' | 'Medium' | 'Low'> = {
  CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low'
};

export function AlertTable({ alerts, selectedId, onSelect }: AlertTableProps) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to first page whenever alerts list or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [alerts.length, pageSize]);

  function handleInvestigate(alert: Alert, e: React.MouseEvent) {
    e.stopPropagation();
    if (!alert.source_ip) return;
    const params = new URLSearchParams({
      ip: alert.source_ip,
      source: 'alert',
      alertId: alert.id,
    });
    navigate(`/investigation?${params.toString()}`);
  }

  function formatTime(ts: string) {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? ts : d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  }

  if (alerts.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No alerts match the current filters.
      </div>
    );
  }

  // Calculate pagination bounds
  const totalPages = Math.max(1, Math.ceil(alerts.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, alerts.length);
  const currentAlerts = alerts.slice(startIndex, endIndex);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Table Content */}
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-workspace)', borderBottom: '1px solid var(--border-subtle)' }}>
              {['Severity', 'Alert', 'Category', 'Source', 'Dest', 'Confidence', 'Events', 'Status', 'Last Seen', 'Actions'].map((col) => (
                <th
                  key={col}
                  style={{
                    padding: '12px 16px', textAlign: 'left', fontSize: 11,
                    fontWeight: 600, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap'
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentAlerts.map((alert) => {
              const isSelected = selectedId === alert.id;
              return (
                <tr
                  key={alert.id}
                  onClick={() => onSelect(alert.id)}
                  style={{
                    background: isSelected ? 'var(--sidebar-active-bg)' : 'transparent',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'background var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg-workspace)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <Badge severity={severityMap[alert.severity] || 'Low'} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{alert.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{alert.id}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {alert.category}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {alert.source_ip || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {alert.destination_ip || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {alert.confidence}%
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {alert.event_count}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                      background: alert.status === 'OPEN' ? 'rgba(245,158,11,0.1)' : 
                                 alert.status === 'RESOLVED' ? 'rgba(16,185,129,0.1)' : 'var(--bg-workspace)',
                      color: alert.status === 'OPEN' ? '#d97706' : 
                             alert.status === 'RESOLVED' ? '#059669' : 'var(--text-secondary)'
                    }}>
                      {alert.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatTime(alert.last_seen)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={(e) => handleInvestigate(alert, e)}
                      disabled={!alert.source_ip}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
                        background: 'var(--primary-light)', color: 'var(--primary)',
                        border: '1px solid var(--primary)', cursor: alert.source_ip ? 'pointer' : 'not-allowed',
                        opacity: alert.source_ip ? 1 : 0.5, whiteSpace: 'nowrap'
                      }}
                    >
                      Investigate
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-card)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* Summary & Page Size Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span>
            Showing <strong style={{ color: 'var(--text-primary)' }}>{alerts.length > 0 ? startIndex + 1 : 0}</strong>–
            <strong style={{ color: 'var(--text-primary)' }}>{endIndex}</strong> of{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{alerts.length}</strong> alerts
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                padding: '3px 8px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--border-default)',
                background: 'var(--bg-workspace)',
                color: 'var(--text-primary)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {[5, 10, 20, 50].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* First Page */}
          <button
            onClick={() => setCurrentPage(1)}
            disabled={validPage === 1}
            title="First Page"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: 6,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-workspace)',
              color: validPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: validPage === 1 ? 'not-allowed' : 'pointer',
              opacity: validPage === 1 ? 0.4 : 1,
            }}
          >
            <ChevronsLeft size={14} />
          </button>

          {/* Prev Page */}
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={validPage === 1}
            title="Previous Page"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: 6,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-workspace)',
              color: validPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: validPage === 1 ? 'not-allowed' : 'pointer',
              opacity: validPage === 1 ? 0.4 : 1,
            }}
          >
            <ChevronLeft size={14} />
          </button>

          {/* Page Number Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - validPage) <= 1)
              .map((p, idx, arr) => {
                const prevNum = arr[idx - 1];
                const showEllipsis = prevNum && p - prevNum > 1;

                return (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {showEllipsis && (
                      <span style={{ padding: '0 4px', color: 'var(--text-muted)', fontSize: 11 }}>…</span>
                    )}
                    <button
                      onClick={() => setCurrentPage(p)}
                      style={{
                        minWidth: 30,
                        height: 30,
                        padding: '0 6px',
                        borderRadius: 6,
                        border: p === validPage ? '1px solid var(--primary)' : '1px solid var(--border-default)',
                        background: p === validPage ? 'var(--primary-light)' : 'var(--bg-workspace)',
                        color: p === validPage ? 'var(--primary)' : 'var(--text-primary)',
                        fontWeight: p === validPage ? 700 : 500,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {p}
                    </button>
                  </div>
                );
              })}
          </div>

          {/* Next Page */}
          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={validPage === totalPages}
            title="Next Page"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: 6,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-workspace)',
              color: validPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: validPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: validPage === totalPages ? 0.4 : 1,
            }}
          >
            <ChevronRight size={14} />
          </button>

          {/* Last Page */}
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={validPage === totalPages}
            title="Last Page"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: 6,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-workspace)',
              color: validPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: validPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: validPage === totalPages ? 0.4 : 1,
            }}
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

