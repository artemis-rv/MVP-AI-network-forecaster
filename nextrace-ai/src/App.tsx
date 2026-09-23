import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { ToastContainer } from '@/components/ui/Toast';
import { DashboardPage } from '@/pages/DashboardPage';
import { LiveMonitoringPage } from '@/pages/LiveMonitoringPage';
import { AttackPredictionPage } from '@/pages/AttackPredictionPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import {
  Bell, Search, FileSearch,
  FileText, ShieldCheck, Activity,
} from 'lucide-react';

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <div className="app-main">
          <TopBar />
          <main className="app-content">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/live-monitoring" element={<LiveMonitoringPage />} />
              <Route path="/attack-prediction" element={<AttackPredictionPage />} />
              <Route path="/alerts" element={
                <PlaceholderPage
                  title="Alerts"
                  description="Full alert management panel with severity filtering, acknowledgment, and drill-down to entity investigation."
                  icon={<Bell size={36} />}
                />
              } />
              <Route path="/investigation" element={
                <PlaceholderPage
                  title="Investigation"
                  description="Deep entity investigation workflow with evidence review, ATT&CK mapping, behavior analysis, and finding generation."
                  icon={<Search size={36} />}
                />
              } />
              <Route path="/historical-pcap" element={
                <PlaceholderPage
                  title="Historical PCAP Analysis"
                  description="Upload a PCAP to create an independent analysis job. Chronological timeline, attack-path reconstruction, and hypothesis generation."
                  icon={<FileSearch size={36} />}
                />
              } />
              <Route path="/reports" element={
                <PlaceholderPage
                  title="Reports"
                  description="View and generate completed forensic reports from live sessions and PCAP analysis jobs."
                  icon={<FileText size={36} />}
                />
              } />
              <Route path="/admin" element={
                <PlaceholderPage
                  title="Admin"
                  description="Manage SOC analyst accounts, roles and permissions. View reports and inspect data sources."
                  icon={<ShieldCheck size={36} />}
                />
              } />
              <Route path="/system-status" element={
                <PlaceholderPage
                  title="System Status"
                  description="View health of all backend services, storage utilization, and telemetry data sources."
                  icon={<Activity size={36} />}
                />
              } />
            </Routes>
          </main>
        </div>
      </div>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
