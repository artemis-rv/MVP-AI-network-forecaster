import { useNavigate } from 'react-router-dom';
import { FileText, Calendar, Eye, AlertCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useFindingsStore } from '@/store/findingsStore';
import { generateSecurityReportPdf } from '@/utils/pdfGenerator';
import { apiService } from '@/services/api';

export function ReportsListPage() {
  const navigate = useNavigate();
  const { reportList, fetchReportList } = useFindingsStore();

  useEffect(() => {
    fetchReportList();
  }, [fetchReportList]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Generated Reports</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>View and download forensic investigations and simulation results.</p>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-default)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-workspace)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Report ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Title</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Type</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Date generated</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reportList.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <AlertCircle size={32} color="var(--border-default)" />
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>No reports generated</div>
                    <div style={{ fontSize: 13 }}>Generate a report from Attack Prediction, Historical PCAP Analysis or Forensic Analysis.</div>
                  </div>
                </td>
              </tr>
            ) : (
              reportList.map((r, i) => (
                <tr key={r.report_id} style={{ borderBottom: i === reportList.length - 1 ? 'none' : '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
                  <td style={{ padding: '16px', fontWeight: 700, color: 'var(--primary)' }}>{r.report_id}</td>
                  <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.title || (r.report_type === 'simulation' ? 'Simulation Report' : r.report_type === 'live' ? 'Live Session Report' : 'Historical Analysis Report')}</td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ background: 'var(--bg-workspace)', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {r.report_type === 'live' ? 'live session' : r.report_type}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={14} />
                      {new Date(r.generated_at * 1000).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => navigate(`/reports/${r.report_id}`)}
                        style={{ background: 'var(--bg-workspace)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', padding: '6px 14px', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Eye size={14} /> View
                      </button>
                      <button
                        onClick={async () => {
                          const local = useFindingsStore.getState().localReports[r.report_id];
                          if (local) {
                            generateSecurityReportPdf(local);
                            return;
                          }
                          try {
                            const fullReport = await apiService.getReport(r.report_id);
                            generateSecurityReportPdf(fullReport);
                          } catch (err) {
                            console.error("Failed to fetch full report for PDF:", err);
                            generateSecurityReportPdf({ title: r.title, reportId: r.report_id, generatedAt: r.generated_at });
                          }
                        }}
                        className="btn-export-pdf"
                        style={{ padding: '6px 14px', fontSize: 12 }}
                      >
                        <FileText size={14} /> Export PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
