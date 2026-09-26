import { useAppStore } from '@/store/appStore';
import { CheckCircle, Info, AlertTriangle, XCircle, X } from 'lucide-react';

const CONFIG = {
  info:    { bg: 'var(--primary-light)',          border: 'var(--primary)',        color: 'var(--primary)',        Icon: Info },
  success: { bg: 'var(--color-live-light)',       border: 'var(--color-live)',     color: 'var(--color-live)',    Icon: CheckCircle },
  warning: { bg: 'var(--color-warning-light)',    border: 'var(--color-warning)',  color: 'var(--color-warning)', Icon: AlertTriangle },
  error:   { bg: 'var(--color-critical-light)',   border: 'var(--color-critical)', color: 'var(--color-critical)', Icon: XCircle },
};

export function ToastContainer() {
  const { toasts, removeToast } = useAppStore();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const c = CONFIG[toast.type];
        return (
          <div
            key={toast.id}
            className="animate-slide-in-right"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 16px',
              background: 'var(--bg-card)',
              border: `1px solid ${c.border}`,
              borderLeft: `4px solid ${c.border}`,
              borderRadius: 12,
              boxShadow: 'var(--shadow-lg)',
              maxWidth: 380,
              pointerEvents: 'all',
            }}
          >
            <c.Icon size={16} color={c.color} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, lineHeight: 1.5 }}>
              {toast.message}
            </span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                flexShrink: 0,
              }}
            >
              <X size={14} color="var(--text-muted)" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
