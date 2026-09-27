import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutGrid, Radar, TrendingUp, Bell, Search,
  Database, FileText, ShieldCheck, Activity, Zap, Target,
  ChevronDown, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useAlertStore } from '@/store/alertStore';

export function Sidebar() {
  const { setActivePage, userRole, sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const { stats, alerts, fetchStats, fetchAlerts } = useAlertStore();

  useEffect(() => {
    fetchStats();
    fetchAlerts();
    const interval = setInterval(() => {
      fetchStats();
      fetchAlerts();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchAlerts]);

  const activeAlertsBadge = alerts.length > 0
    ? alerts.filter(a => a.status === 'OPEN' || a.status === 'IN_PROGRESS').length
    : (stats?.open ?? 0) + (stats?.in_progress ?? 0);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    live: true,
    historical: true,
    system: true,
    adminOperations: true,
  });

  const filteredNavGroups = userRole === 'admin'
    ? [
      {
        id: 'adminOperations',
        title: 'Admin Operations',
        items: [
          { id: 'overview', label: 'Dashboard', icon: LayoutGrid, path: '/' },
          { id: 'reports', label: 'View Reports', icon: FileText, path: '/reports' },
        ]
      },
      {
        id: 'system',
        title: 'System Management',
        items: [
          { id: 'admin', label: 'User Management', icon: ShieldCheck, path: '/admin' },
          { id: 'system-status', label: 'System Health', icon: Activity, path: '/system-status' },
        ]
      }
    ]
    : [
      {
        id: 'live',
        title: 'Live Operations',
        items: [
          { id: 'overview', label: 'Dashboard', icon: LayoutGrid, path: '/' },
          { id: 'live-monitoring', label: 'Live Monitoring', icon: Radar, path: '/live-monitoring' },
          { id: 'investigation', label: 'Investigation', icon: Search, path: '/investigation' },
          { id: 'attack-prediction', label: 'Attack Prediction', icon: TrendingUp, path: '/attack-prediction' },
          { id: 'path-forecaster', label: 'Attack Path Forecaster', icon: Target, path: '/simulation' },
          { id: 'alerts', label: 'Alerts', icon: Bell, path: '/alerts', badge: activeAlertsBadge > 0 ? activeAlertsBadge : undefined },
        ]
      },
      {
        id: 'historical',
        title: 'Forensic & Historical',
        items: [
          { id: 'historical-pcap', label: 'Historical PCAP', icon: Database, path: '/historical-pcap' },
          { id: 'reports', label: 'Reports', icon: FileText, path: '/reports' },
        ]
      }
    ];

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside
      data-tour="sidebar"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: 'var(--sidebar-width)',
        background: 'var(--sidebar-bg)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        borderRight: '1px solid var(--sidebar-border)',
        transition: 'width var(--transition-base)',
      }}
    >
      {/* Brand & Header */}
      <div
        style={{
          padding: sidebarCollapsed ? '20px 4px' : '20px 16px',
          borderBottom: '1px solid var(--sidebar-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '77px', // Fixed height to prevent any layout shifts
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: sidebarCollapsed ? 0 : '10px' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
            }}
          >
            <Zap size={20} color="white" strokeWidth={1.5} />
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            opacity: sidebarCollapsed ? 0 : 1,
            width: sidebarCollapsed ? 0 : 120,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)'
          }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: 'white',
                letterSpacing: '-0.3px',
                lineHeight: 1.2,
              }}
            >
              NEXTRACE AI
            </div>
            <div style={{ fontSize: 9, color: '#6366f1', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              Predict. Trace. Secure.
            </div>
          </div>
        </div>

        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            width: 24,
            height: 24,
            borderRadius: '6px',
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--sidebar-text)',
            padding: 0,
            flexShrink: 0,
            transition: 'all var(--transition-fast)'
          }}
        >
          {sidebarCollapsed ? <ChevronRight size={14} strokeWidth={2} /> : <ChevronLeft size={14} strokeWidth={2} />}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{
        flex: 1,
        padding: '12px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        gap: '20px'
      }}>
        {filteredNavGroups.map((group) => (
          <div key={group.id} style={{ marginBottom: 12 }}>
            <div
              onClick={() => toggleGroup(group.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 12px',
                cursor: 'pointer',
                marginBottom: 4,
              }}
            >
              <span style={{
                fontSize: 10, color: '#4a5568', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase',
                opacity: sidebarCollapsed ? 0 : 1,
                width: sidebarCollapsed ? 0 : 'auto',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transition: 'all var(--transition-fast)'
              }}>
                {group.title}
              </span>
              {!sidebarCollapsed && (
                <ChevronDown
                  size={14}
                  color="#4a5568"
                  style={{
                    transition: 'transform var(--transition-fast)',
                    transform: expandedGroups[group.id] ? 'rotate(0deg)' : 'rotate(-90deg)',
                  }}
                />
              )}
            </div>
            <div
              style={{
                overflow: 'hidden',
                transition: 'max-height var(--transition-base)',
                maxHeight: expandedGroups[group.id] ? 400 : 0,
              }}
            >
              {group.items.map((item) => (
                <SidebarNavItem key={item.id} item={item} onNavigate={() => setActivePage(item.id)} collapsed={sidebarCollapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Status */}
      <div style={{ marginTop: 'auto', padding: sidebarCollapsed ? '16px 0' : '16px', borderTop: '1px solid var(--sidebar-border)', display: 'flex', flexDirection: 'column', alignItems: sidebarCollapsed ? 'center' : 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--color-live)',
              animation: 'pulse-dot 2s infinite',
              flexShrink: 0,
            }}
          />
          <span style={{
            fontSize: 11, color: '#10b981', fontWeight: 600,
            opacity: sidebarCollapsed ? 0 : 1,
            width: sidebarCollapsed ? 0 : 'auto',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)'
          }}>All Systems Operational</span>
        </div>
        <div style={{
          fontSize: 10, color: '#4a5568', fontWeight: 500,
          opacity: sidebarCollapsed ? 0 : 1,
          height: sidebarCollapsed ? 0 : 'auto',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          transition: 'all var(--transition-fast)'
        }}>v0.1.0 (Demo)</div>
      </div>
    </aside>
  );
}

function SidebarNavItem({ item, onNavigate, collapsed }: { item: any; onNavigate: () => void; collapsed: boolean }) {
  const location = useLocation();
  const isActive = item.path === '/'
    ? location.pathname === '/'
    : location.pathname.startsWith(item.path);

  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      style={{ textDecoration: 'none', display: 'block', marginBottom: '2px' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? 0 : '12px',
          padding: '10px 12px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 8,
          cursor: 'pointer',
          position: 'relative',
          transition: 'all var(--transition-fast)',
          background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
          boxShadow: isActive ? `inset 0 0 0 1px rgba(99,102,241,0.3), 0 0 12px var(--sidebar-active-glow)` : 'none',
          boxSizing: 'border-box',
          width: '100%'
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--sidebar-bg-hover)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
        }}
      >
        {isActive && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 3,
              height: 18,
              background: 'var(--primary)',
              borderRadius: '0 3px 3px 0',
            }}
          />
        )}

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <item.icon
            size={20}
            color={isActive ? '#818cf8' : '#4a5568'}
            strokeWidth={1.5}
            style={{ flexShrink: 0 }}
          />
          {'badge' in item && item.badge && (
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -6,
                minWidth: 16,
                height: 16,
                borderRadius: 9999,
                padding: '0 4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                background: 'var(--color-critical)',
                color: 'white',
                pointerEvents: 'none',
                boxShadow: '0 0 6px rgba(239, 68, 68, 0.6)',
              }}
            >
              {item.badge}
            </span>
          )}
        </div>

        <span
          style={{
            fontSize: 13,
            fontWeight: isActive ? 600 : 500,
            color: isActive ? 'white' : 'var(--sidebar-text)',
            flex: 1,
            opacity: collapsed ? 0 : 1,
            width: collapsed ? 0 : 'auto',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)',
          }}
        >
          {item.label}
        </span>
      </div>
    </NavLink>
  );
}
