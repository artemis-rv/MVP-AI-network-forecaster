import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Radio, TrendingUp, Bell, Search,
  FileSearch, FileText, ShieldCheck, Activity, Zap, Target,
  ChevronDown
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useAlertStore } from '@/store/alertStore';

export function Sidebar() {
  const { setActivePage, userRole } = useAppStore();
  const { stats, fetchStats } = useAlertStore();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const activeAlertsBadge = (stats?.open ?? 0) + (stats?.in_progress ?? 0);

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
            { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
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
            { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/' },
            { id: 'live-monitoring', label: 'Live Monitoring', icon: Radio, path: '/live-monitoring' },
            { id: 'attack-prediction', label: 'Attack Prediction', icon: TrendingUp, path: '/attack-prediction' },
            { id: 'path-forecaster', label: 'Attack Path Forecaster', icon: Target, path: '/simulation' },
            { id: 'alerts', label: 'Alerts', icon: Bell, path: '/alerts', badge: activeAlertsBadge > 0 ? activeAlertsBadge : undefined },
          ]
        },
        {
          id: 'historical',
          title: 'Forensic & Historical',
          items: [
            { id: 'investigation', label: 'Investigation', icon: Search, path: '/investigation' },
            { id: 'historical-pcap', label: 'Historical PCAP', icon: FileSearch, path: '/historical-pcap' },
            { id: 'reports', label: 'Reports', icon: FileText, path: '/reports' },
          ]
        }
      ];

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside
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
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid var(--sidebar-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
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
            <Zap size={18} color="white" strokeWidth={2.5} />
          </div>
          <div>
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
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
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
              <span style={{ fontSize: 10, color: '#4a5568', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                {group.title}
              </span>
              <ChevronDown
                size={14}
                color="#4a5568"
                style={{
                  transition: 'transform var(--transition-fast)',
                  transform: expandedGroups[group.id] ? 'rotate(0deg)' : 'rotate(-90deg)',
                }}
              />
            </div>
            <div
              style={{
                overflow: 'hidden',
                transition: 'max-height var(--transition-base)',
                maxHeight: expandedGroups[group.id] ? 400 : 0,
              }}
            >
              {group.items.map((item) => (
                <SidebarNavItem key={item.id} item={item} onNavigate={() => setActivePage(item.id)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Status */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--sidebar-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
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
          <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>All Systems Operational</span>
        </div>
        <div style={{ fontSize: 10, color: '#4a5568', fontWeight: 500 }}>v0.1.0 (Demo)</div>
      </div>
    </aside>
  );
}

function SidebarNavItem({ item, onNavigate }: { item: any; onNavigate: () => void }) {
  const location = useLocation();
  const isActive = item.path === '/'
    ? location.pathname === '/'
    : location.pathname.startsWith(item.path);

  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      style={{ textDecoration: 'none', display: 'block', marginBottom: '2px' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '9px 10px',
          borderRadius: 8,
          cursor: 'pointer',
          position: 'relative',
          transition: 'all var(--transition-fast)',
          background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
          boxShadow: isActive ? `inset 0 0 0 1px rgba(99,102,241,0.3), 0 0 12px var(--sidebar-active-glow)` : 'none',
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
        <item.icon
          size={16}
          color={isActive ? '#818cf8' : '#4a5568'}
          strokeWidth={isActive ? 2.5 : 2}
        />
        <span
          style={{
            fontSize: 13,
            fontWeight: isActive ? 600 : 500,
            color: isActive ? 'white' : 'var(--sidebar-text)',
            flex: 1,
          }}
        >
          {item.label}
        </span>
        {'badge' in item && item.badge && (
          <span
            style={{
              background: 'var(--color-critical)',
              color: 'white',
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 999,
              minWidth: 18,
              textAlign: 'center',
            }}
          >
            {item.badge}
          </span>
        )}
      </div>
    </NavLink>
  );
}
