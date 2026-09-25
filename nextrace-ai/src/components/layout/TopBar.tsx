import { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronDown, Moon, Sun, X, User, Settings, LogOut } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useLiveStore } from '@/store/liveStore';

export function TopBar() {
  const {
    searchOpen, setSearchOpen,
    userMenuOpen, setUserMenuOpen,
    notifPanelOpen, setNotifPanelOpen,
    notifications, unreadCount, markAllRead,
    addToast,
    userRole, currentUser, logout
  } = useAppStore();

  const { session } = useLiveStore();
  const isLiveRunning = session?.running ?? false;

  const [darkMode, setDarkMode] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setUserMenuOpen(false);
        setNotifPanelOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSearchOpen, setUserMenuOpen, setNotifPanelOpen]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifPanelOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setNotifPanelOpen, setUserMenuOpen]);

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 'var(--sidebar-width)',
        right: 0,
        height: 'var(--topbar-height)',
        background: 'var(--topbar-bg)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--topbar-border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: '16px',
        zIndex: 90,
      }}
    >
      {isLiveRunning && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'var(--color-critical)',
            boxShadow: '0 0 8px var(--color-critical)',
            zIndex: 100,
          }}
        />
      )}
      {/* Search Bar */}
      <div
        style={{
          flex: 1,
          maxWidth: 480,
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: searchOpen ? 'white' : 'var(--bg-input)',
            border: `1px solid ${searchOpen ? 'var(--primary)' : 'var(--border-default)'}`,
            borderRadius: 10,
            padding: '0 14px',
            height: 40,
            transition: 'all var(--transition-base)',
            boxShadow: searchOpen ? '0 0 0 3px var(--primary-glow)' : 'none',
            cursor: 'text',
          }}
          onClick={() => {
            setSearchOpen(true);
            setTimeout(() => searchRef.current?.focus(), 50);
          }}
        >
          <Search size={15} color={searchOpen ? 'var(--primary)' : 'var(--text-muted)'} />
          <input
            ref={searchRef}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search IP, domain, alert, or investigation..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
            }}
          />
          {searchValue ? (
            <button onClick={() => setSearchValue('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <X size={14} color="var(--text-muted)" />
            </button>
          ) : (
            <kbd
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                background: 'var(--border-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 4,
                padding: '2px 6px',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
              }}
            >
              Ctrl K
            </kbd>
          )}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* LIVE DEMO Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 999,
          padding: '4px 12px',
          cursor: 'pointer',
        }}
        onClick={() => addToast('Live demo mode is active. Data is simulated.', 'info')}
      >
        {isLiveRunning && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8, paddingRight: 8, borderRight: '1px solid rgba(0,0,0,0.1)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-critical)', animation: 'pulse-dot 1.5s infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-critical)' }}>LIVE RUNNING</span>
          </span>
        )}
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--color-live)',
            animation: 'pulse-dot 1.5s infinite',
          }}
        />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-live)', letterSpacing: '0.5px' }}>
          LIVE DEMO
        </span>
      </div>

      {/* Notifications */}
      <div ref={notifRef} style={{ position: 'relative' }}>
        <button
          onClick={() => { setNotifPanelOpen(!notifPanelOpen); setUserMenuOpen(false); }}
          style={{
            position: 'relative',
            width: 38,
            height: 38,
            borderRadius: 10,
            border: '1px solid var(--border-default)',
            background: notifPanelOpen ? 'var(--primary-light)' : 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          <Bell size={16} color={notifPanelOpen ? 'var(--primary)' : 'var(--text-secondary)'} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                background: 'var(--color-critical)',
                borderRadius: '50%',
                border: '1.5px solid white',
              }}
            />
          )}
        </button>

        {notifPanelOpen && (
          <div
            className="animate-slide-in-right"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 340,
              background: 'white',
              borderRadius: 14,
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 200,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 16px',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
              <button
                onClick={markAllRead}
                style={{
                  fontSize: 11,
                  color: 'var(--primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Mark all read
              </button>
            </div>
            {notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: n.read ? 'white' : 'rgba(99,102,241,0.03)',
                  transition: 'background var(--transition-fast)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8faff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? 'white' : 'rgba(99,102,241,0.03)')}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: n.read ? 'var(--border-default)' : severityColor(n.severity),
                    marginTop: 4,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: 'var(--text-primary)' }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{n.desc}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{n.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Theme Toggle */}
      <button
        onClick={() => { setDarkMode(!darkMode); addToast('Dark mode coming in a future update.', 'info'); }}
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          border: '1px solid var(--border-default)',
          background: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--primary-light)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
      >
        {darkMode ? <Sun size={15} color="var(--color-warning)" /> : <Moon size={15} color="var(--text-secondary)" />}
      </button>

      {/* User Menu */}
      <div ref={userRef} style={{ position: 'relative' }}>
        <button
          onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifPanelOpen(false); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px 6px 6px',
            borderRadius: 10,
            border: '1px solid var(--border-default)',
            background: userMenuOpen ? 'var(--primary-light)' : 'white',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>
              {currentUser
                ? currentUser.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                : (userRole === 'admin' ? 'AD' : 'SA')}
            </span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {currentUser?.name || (userRole === 'admin' ? 'Administrator' : 'SOC Analyst')}
          </span>
          <ChevronDown
            size={14}
            color="var(--text-muted)"
            style={{ transition: 'transform var(--transition-fast)', transform: userMenuOpen ? 'rotate(180deg)' : 'none' }}
          />
        </button>

        {userMenuOpen && (
          <div
            className="animate-slide-in-right"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 220,
              background: 'white',
              borderRadius: 12,
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 200,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {currentUser?.name || (userRole === 'admin' ? 'Administrator' : 'SOC Analyst')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {currentUser?.email || (userRole === 'admin' ? 'admin@nextrace.ai' : 'analyst@nextrace.ai')}
              </div>
              <div style={{ fontSize: 10, color: 'var(--primary)', marginTop: 4, fontWeight: 600 }}>
                Role: {currentUser?.role || (userRole === 'admin' ? 'Admin' : 'SOC Analyst')}
              </div>
            </div>
            {[
              { icon: User, label: 'Profile' },
              { icon: Settings, label: 'Settings' },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                onClick={() => addToast(`${label} — coming in a future update.`, 'info')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  transition: 'background var(--transition-fast)',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-workspace)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
            <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => logout()}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--color-critical)',
                  transition: 'background var(--transition-fast)',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-critical-light)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function severityColor(severity: string) {
  switch (severity) {
    case 'critical': return 'var(--color-critical)';
    case 'warning': return 'var(--color-warning)';
    case 'info': return 'var(--primary)';
    default: return 'var(--text-muted)';
  }
}
