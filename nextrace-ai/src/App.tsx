import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { ToastContainer } from '@/components/ui/Toast';
import { DashboardPage } from '@/pages/DashboardPage';
import { LiveMonitoringPage } from '@/pages/LiveMonitoringPage';
import { AttackPredictionPage } from '@/pages/AttackPredictionPage';
import { InvestigationPage } from '@/pages/InvestigationPage';
import { HistoricalAnalysisPage } from '@/pages/HistoricalAnalysisPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { ForensicAnalysisPage } from '@/pages/ForensicAnalysisPage';
import { SimulationPage } from '@/pages/SimulationPage';
import { ReportPage } from '@/pages/ReportPage';
import { ReportsListPage } from '@/pages/ReportsListPage';
import { AlertsPage } from '@/pages/AlertsPage';
import { LoginPage } from '@/pages/LoginPage';
import { InvestigationAssistant } from '@/components/dashboard/InvestigationAssistant';
import { useAppStore } from '@/store/appStore';
import {
  FileText, ShieldCheck, Activity,
} from 'lucide-react';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  const { userRole } = useAppStore();

  if (!userRole) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="app-layout">
        <Sidebar />
        <div className="app-main">
          <TopBar />
          <main className="app-content">
            <Routes>
              {/* Shared Routes */}
              <Route path="/" element={<DashboardPage />} />
              <Route path="/reports" element={<ReportsListPage />} />
              <Route path="/reports/:reportId" element={<ReportPage />} />

              {/* SOC Analyst Routes */}
              {userRole === 'soc' && (
                <>
                  <Route path="/live-monitoring" element={<LiveMonitoringPage />} />
                  <Route path="/attack-prediction" element={<AttackPredictionPage />} />
                  <Route path="/alerts" element={<AlertsPage />} />
                  <Route path="/investigation" element={<InvestigationPage />} />
                  <Route path="/historical-pcap" element={<HistoricalAnalysisPage />} />
                  <Route path="/forensic/:jobId" element={<ForensicAnalysisPage />} />
                  <Route path="/simulation" element={<SimulationPage />} />
                </>
              )}

              {/* Admin Routes */}
              {userRole === 'admin' && (
                <>
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
                </>
              )}
            </Routes>
          </main>
        </div>
      </div>
      <InvestigationAssistant />
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
