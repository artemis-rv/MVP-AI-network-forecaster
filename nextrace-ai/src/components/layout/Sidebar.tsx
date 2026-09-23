import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Radio, TrendingUp, Bell, Search,
  FileSearch, FileText, ShieldCheck, Activity, Zap
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/' },
  { id: 'live-monitoring', label: 'Live Monitoring', icon: Radio, path: '/live-monitoring' },
  { id: 'attack-prediction', label: 'Attack Prediction', icon: TrendingUp, path: '/attack-prediction' },
  { id: 'alerts', label: 'Alerts', icon: Bell, path: '/alerts', badge: 3 },
  { id: 'investigation', label: 'Investigation', icon: Search, path: '/investigation' },
  { id: 'historical-pcap', label: 'Historical PCAP', icon: FileSearch, path: '/historical-pcap' },
  { id: 'reports', label: 'Reports', icon: FileText, path: '/reports' },
  { id: 'admin', label: 'Admin', icon: ShieldCheck, path: '/admin' },
  { id: 'system-status', label: 'System Status', icon: Activity, path: '/system-status' },
];

export function Sidebar() {
  const { setActivePage } = useAppStore();

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
          {/* Logo Icon */}
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
        <div style={{ fontSize: 10, color: '#4a5568', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '0 8px 8px' }}>
          Navigation
        </div>
        {navItems.map((item) => (
          <SidebarNavItem key={item.id} item={item} onNavigate={() => setActivePage(item.id)} />
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

function SidebarNavItem({ item, onNavigate }: { item: typeof navItems[0]; onNavigate: () => void }) {
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
