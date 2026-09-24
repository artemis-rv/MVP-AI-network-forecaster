import { useNavigate } from 'react-router-dom';
import { FileText, Download, Eye, Calendar, ShieldCheck } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';

export function ReportsListPage() {
  const navigate = useNavigate();

  const mockReports = [
    { id: 'REP-9921', title: 'Suspicious Lateral Movement Detected (10.0.0.50)', date: 'Sep 24, 2026', type: 'Historical PCAP', status: 'Completed', author: 'SOC Auto-Forensic' },
    { id: 'REP-9920', title: 'Data Exfiltration Simulation Results (Fixed-K)', date: 'Sep 23, 2026', type: 'Attack Simulation', status: 'Completed', author: 'Admin' },
    { id: 'REP-9919', title: 'Daily Network Threat Summary', date: 'Sep 22, 2026', type: 'Daily Summary', status: 'Completed', author: 'System' },
  ];

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
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
            {mockReports.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i === mockReports.length - 1 ? 'none' : '1px solid var(--border-subtle)', background: 'white' }}>
                <td style={{ padding: '16px', fontWeight: 700, color: 'var(--primary)' }}>{r.id}</td>
                <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</td>
                <td style={{ padding: '16px' }}>
                  <span style={{ background: 'var(--bg-workspace)', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {r.type}
                  </span>
                </td>
                <td style={{ padding: '16px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} />
                    {r.date}
                  </div>
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button
                    onClick={() => navigate(`/reports/${r.id}`)}
                    style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Eye size={14} /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
