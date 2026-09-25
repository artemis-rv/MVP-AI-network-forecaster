import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { 
  ShieldCheck, User, Lock, Mail, Eye, EyeOff, 
  AlertCircle, ArrowRight, ShieldAlert, KeyRound, Sparkles
} from 'lucide-react';

export function LoginPage() {
  const { users, loginWithCredentials } = useAppStore();
  const [email, setEmail] = useState('analyst@nextrace.ai');
  const [password, setPassword] = useState('soc123');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    setTimeout(() => {
      const res = loginWithCredentials(email, password);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to authenticate.');
      }
      setIsSubmitting(false);
    }, 200);
  };

  const handleFillCredentials = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMsg(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 20%, rgba(99, 102, 241, 0.08) 0%, var(--bg-body) 70%)',
      padding: '24px 16px',
      fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 460,
        background: 'var(--bg-card, #ffffff)',
        borderRadius: 16,
        border: '1px solid var(--border-default, #e2e8f0)',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.08), 0 0 1px 1px rgba(0, 0, 0, 0.03)',
        overflow: 'hidden'
      }}>
        {/* Header Banner */}
        <div style={{
          padding: '28px 28px 20px',
          textAlign: 'center',
          borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
          background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.04) 0%, transparent 100%)'
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'linear-gradient(135deg, var(--primary, #6366f1), var(--secondary, #8b5cf6))',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.35)',
            marginBottom: 12
          }}>
            <ShieldAlert size={26} color="white" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary, #0f172a)', letterSpacing: '-0.02em' }}>
            NEXTRACE <span style={{ color: 'var(--primary, #6366f1)' }}>AI</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', margin: 0 }}>
            Enterprise Threat Forecaster & SOC Intelligence Platform
          </p>
        </div>

        <div style={{ padding: '24px 28px' }}>
          {/* Demo Login Details Helper */}
          <div style={{
            marginBottom: 20,
            padding: '12px 14px',
            background: 'var(--bg-workspace, #f8fafc)',
            borderRadius: 10,
            border: '1px solid var(--border-subtle, #e2e8f0)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #475569)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <KeyRound size={12} color="var(--primary, #6366f1)" /> Demo Login Details
              </span>
              <span style={{ fontSize: 11, color: 'var(--primary, #6366f1)', fontWeight: 600 }}>Click to fill</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {/* Admin Card */}
              <div 
                onClick={() => handleFillCredentials('admin@nextrace.ai', 'admin123')}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'white',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary, #6366f1)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(99, 102, 241, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default, #e2e8f0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary, #6366f1)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={12} /> Admin (Demo)
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary, #334155)', marginTop: 2, fontFamily: 'monospace' }}>
                  admin@nextrace.ai
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted, #94a3b8)', marginTop: 1 }}>
                  Pass: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>admin123</span>
                </div>
              </div>

              {/* SOC Analyst Card */}
              <div 
                onClick={() => handleFillCredentials('analyst@nextrace.ai', 'soc123')}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'white',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default, #e2e8f0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <User size={12} /> SOC Analyst (Demo)
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary, #334155)', marginTop: 2, fontFamily: 'monospace' }}>
                  analyst@nextrace.ai
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted, #94a3b8)', marginTop: 1 }}>
                  Pass: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>soc123</span>
                </div>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 8,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: 12,
              marginBottom: 16
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleFormLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #334155)', marginBottom: 6 }}>
                Email Address or Username
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="var(--text-muted, #94a3b8)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@nextrace.ai"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: 8,
                    border: '1px solid var(--border-default, #cbd5e1)',
                    background: 'var(--bg-card, #ffffff)',
                    color: 'var(--text-primary, #0f172a)',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #334155)' }}>
                  Password
                </label>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--text-muted, #94a3b8)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '10px 38px 10px 36px',
                    borderRadius: 8,
                    border: '1px solid var(--border-default, #cbd5e1)',
                    background: 'var(--bg-card, #ffffff)',
                    color: 'var(--text-primary, #0f172a)',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: 4,
                    cursor: 'pointer',
                    color: 'var(--text-muted, #94a3b8)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                marginTop: 6,
                padding: '12px 16px',
                borderRadius: 8,
                background: 'var(--primary, #6366f1)',
                color: 'white',
                border: 'none',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#4f46e5'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary, #6366f1)'}
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In With Credentials'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div style={{
          padding: '12px 28px',
          background: 'var(--bg-workspace, #f8fafc)',
          borderTop: '1px solid var(--border-subtle, #f1f5f9)',
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--text-muted, #64748b)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6
        }}>
          <Sparkles size={12} color="var(--primary, #6366f1)" />
          <span>Role-Based Access Control • {users.length} authorized platform accounts</span>
        </div>
      </div>
    </div>
  );
}
