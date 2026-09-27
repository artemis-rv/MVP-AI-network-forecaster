import { Tour } from '@/components/tour/Tour';
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
import { AdminDashboardPage } from '@/pages/AdminDashboardPage';
import { ForensicAnalysisPage } from '@/pages/ForensicAnalysisPage';
import { SimulationPage } from '@/pages/SimulationPage';
import { ReportPage } from '@/pages/ReportPage';
import { UserManagementPage } from '@/pages/UserManagementPage';
import { SystemHealthPage } from '@/pages/SystemHealthPage';
import { ReportsListPage } from '@/pages/ReportsListPage';
import { AlertsPage } from '@/pages/AlertsPage';
import { LoginPage } from '@/pages/LoginPage';
import { ModelBenchmarkPage } from '@/pages/ModelBenchmarkPage';
import { InvestigationAssistant } from '@/components/dashboard/InvestigationAssistant';
import { useAppStore } from '@/store/appStore';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  const { userRole, sidebarCollapsed } = useAppStore();

  if (!userRole) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <ScrollToTop />
      <div
        className="app-layout"
        style={{ '--sidebar-width': sidebarCollapsed ? '72px' : '240px' } as React.CSSProperties}
      >
        <Sidebar />
        <div className="app-main">
          <TopBar />
          <main className="app-content">
            <Routes>
              {/* Shared Routes */}
              <Route path="/" element={userRole === 'admin' ? <AdminDashboardPage /> : <DashboardPage />} />
              <Route path="/reports" element={<ReportsListPage />} />
              <Route path="/reports/:reportId" element={<ReportPage />} />
              <Route path="/model-benchmark" element={<ModelBenchmarkPage />} />

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
                  <Route path="/admin" element={<UserManagementPage />} />
                  <Route path="/system-status" element={<SystemHealthPage />} />
                </>
              )}
            </Routes>
          </main>
        </div>
      </div>
      <InvestigationAssistant />
      <ToastContainer />
      <Tour />
    </BrowserRouter>
  );
}

export default App;
