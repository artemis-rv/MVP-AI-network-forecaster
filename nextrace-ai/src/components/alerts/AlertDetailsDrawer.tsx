import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useAlertStore } from '@/store/alertStore';
import { AlertDetails } from './AlertDetails';

export function AlertDetailsDrawer() {
  const { selectedAlertId, alerts, selectAlert, acknowledgeAlert, resolveAlert, updateAlert } = useAlertStore();
  
  const alert = alerts.find(a => a.id === selectedAlertId);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') selectAlert(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectAlert]);

  if (!alert || !selectedAlertId) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
          zIndex: 998, backdropFilter: 'blur(2px)'
        }}
        onClick={() => selectAlert(null)}
      />
      
      {/* Drawer */}
      <div 
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '100%', maxWidth: 450, background: 'var(--bg-card)',
          boxShadow: 'var(--shadow-lg)', zIndex: 999,
          display: 'flex', flexDirection: 'column',
          transform: 'translateX(0)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          animation: 'slideInRight 0.3s ease both'
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Alert Details</h3>
          <button 
            onClick={() => selectAlert(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <AlertDetails 
            alert={alert} 
            onAcknowledge={acknowledgeAlert}
            onResolve={resolveAlert}
            onUpdateStatus={(id, status) => updateAlert(id, { status })}
          />
        </div>
      </div>
    </>
  );
}
