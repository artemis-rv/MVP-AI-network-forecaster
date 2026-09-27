// NEXTRACE AI — Guided tour overlay
// Spotlights one real element at a time with a short explanation. Opens automatically once for a new
// user (remembered in localStorage) and on demand from the "?" button in the top bar, for the current page.

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useTourStore, startTour, markTourSeen, tourSeen } from '@/components/tour/tourStore';

export function Tour() {
  const { pathname } = useLocation();
  const { steps, index, stop, go } = useTourStore();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps?.[index] ?? null;

  // First visit: offer the full tour once, after the page has rendered its panels.
  useEffect(() => {
    if (tourSeen()) return;
    const t = setTimeout(() => { startTour(pathname, true); markTourSeen(); }, 900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changing page ends a running tour — its anchors belong to the previous page.
  useEffect(() => { stop(); }, [pathname, stop]);

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.selector);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useLayoutEffect(() => {
    if (!step) return;
    const el = document.querySelector(step.selector);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(measure, 350);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [step, measure]);

  const close = useCallback(() => { markTourSeen(); stop(); }, [stop]);

  useEffect(() => {
    if (!steps) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight' && index < steps.length - 1) go(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps, index, go, close]);

  if (!steps || !step) return null;

  const pad = 6;
  const vw = window.innerWidth, vh = window.innerHeight;
  const cardTop = rect ? (rect.bottom + 180 < vh ? rect.bottom + 12 : Math.max(12, rect.top - 190)) : vh / 2 - 90;
  const cardLeft = rect ? Math.min(Math.max(12, rect.left), vw - 340) : vw / 2 - 160;
  const last = index === steps.length - 1;

  return (
    <>
      {rect ? (
        <div className="tour-spotlight" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 2000 }} />
      )}
      <div className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" style={{ top: cardTop, left: cardLeft }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div id="tour-title" style={{ fontSize: 14, fontWeight: 800 }}>{step.title}</div>
          <button type="button" onClick={close} aria-label="Close tour" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
            <X size={16} />
          </button>
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)', margin: '8px 0 12px' }}>{step.body}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{index + 1} / {steps.length}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {index > 0 && (
              <button type="button" onClick={() => go(index - 1)} style={btn(false)}>Back</button>
            )}
            <button type="button" onClick={() => (last ? close() : go(index + 1))} style={btn(true)} autoFocus>
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function btn(primary: boolean): React.CSSProperties {
  return {
    fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
    border: primary ? 'none' : '1px solid var(--border-default)',
    background: primary ? 'var(--primary)' : 'var(--bg-card)', color: primary ? 'white' : 'var(--text-primary)',
  };
}
