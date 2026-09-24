import { useAppStore } from '@/store/appStore';
import { ShieldCheck, User } from 'lucide-react';

export function LoginPage() {
  const { setUserRole } = useAppStore();

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-body)' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: 32, background: 'var(--bg-card)', borderRadius: 16, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-default)', textAlign: 'center' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>NEXTRACE AI</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sign in to the SOC Platform</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <button
            onClick={() => setUserRole('soc')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '14px', borderRadius: 8, background: 'var(--primary)', color: 'white',
              border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              transition: 'background var(--transition-fast)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#4f46e5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
          >
            <User size={18} />
            Login as SOC Analyst
          </button>

          <button
            onClick={() => setUserRole('admin')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '14px', borderRadius: 8, background: 'var(--bg-workspace)', color: 'var(--text-primary)',
              border: '1px solid var(--border-default)', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              transition: 'background var(--transition-fast)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border-subtle)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-workspace)'}
          >
            <ShieldCheck size={18} color="var(--primary)" />
            Login as Admin
          </button>
        </div>
      </div>
    </div>
  );
}
