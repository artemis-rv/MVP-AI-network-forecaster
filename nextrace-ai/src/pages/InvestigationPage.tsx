// NEXTRACE AI — Investigation Page (Step 4)
// SOC investigation workspace: entity details, attack path graph,
// timeline, related activity, evidence, and findings.

import { useEffect, useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { generateSecurityReportPdf } from '@/utils/pdfGenerator';

import {
  ArrowLeft, RefreshCw, Sparkles, FileText,
  AlertTriangle,
  CheckCircle, Circle, X,
} from 'lucide-react';
import { useInvestigationStore } from '@/store/investigationStore';
import { useForecastStore } from '@/store/forecastStore';
import { useLiveStore } from '@/store/liveStore';
import { useAppStore } from '@/store/appStore';
import { LiveEntityGraph } from '@/components/investigation/LiveEntityGraph';
import { TimelinePanel } from '@/components/investigation/TimelinePanel';
import { RelatedActivityTable } from '@/components/investigation/RelatedActivityTable';
import { ATTACK_STAGES, STAGE_COLORS } from '@/types/forecast';
import type { InvestigationContext } from '@/types/investigation';

// ─── Hostname lookup (demo) ────────────────────────────────────────────────────
const HOSTNAME_MAP: Record<string, string> = {
  '192.168.1.10':  'WS-ANALYST-01',
  '192.168.1.25':  'APP-SERVER-01',
  '192.168.1.50':  'DB-SERVER-01',
  '10.0.0.5':      'SUSPECT-HOST',
  '8.8.8.8':       'dns.google',
  '203.0.113.5':   'external-c2.demo',
};

function getHostname(ip: string): string {
  return HOSTNAME_MAP[ip] ?? `host-${ip.split('.').pop()}`;
}

function getRiskFromStage(stage: string): { label: string; color: string; bg: string } {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    'Data Exfiltration': { label: 'CRITICAL', color: '#dc2626', bg: '#fee2e2' },
    'Lateral Movement':  { label: 'HIGH',     color: '#ef4444', bg: '#fee2e2' },
    'Initial Access':    { label: 'HIGH',     color: '#f97316', bg: '#ffedd5' },
    'Reconnaissance':    { label: 'MEDIUM',   color: '#f59e0b', bg: '#fef3c7' },
    'Normal Activity':   { label: 'LOW',      color: '#10b981', bg: '#d1fae5' },
    'No Active Session': { label: 'NONE',     color: '#94a3b8', bg: 'var(--bg-input)' },
  };
  return map[stage] ?? { label: 'NONE', color: '#94a3b8', bg: 'var(--bg-input)' };
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function InvestigationPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { investigation, context, findings, showFindingCard, showReportModal,
          openInvestigation, closeInvestigation, generateFindings,
          openReportModal, closeReportModal, refreshTimeline } = useInvestigationStore();
  const { currentForecast } = useForecastStore();
  const { session, liveNodes, liveEdges, displayEvents } = useLiveStore();
  const { addToast } = useAppStore();
  const isLive = session?.running ?? false;

  // Parse query params and open investigation on mount
  useEffect(() => {
    const ip     = searchParams.get('ip');
    const source = (searchParams.get('source') ?? 'direct') as InvestigationContext['sourceType'];
    const alertId = searchParams.get('alertId') ?? undefined;
    const alertEvent = searchParams.get('event') ?? undefined;

    const targetIp = ip ?? '192.168.1.10';
    const ctx: InvestigationContext = {
      ip: targetIp,
      entityType: '',   // auto-detected in store
      sourceType: source,
      alertId,
      alertEvent,
    };
    openInvestigation(ctx);
  }, [searchParams, openInvestigation]);

  const handleBack = useCallback(() => {
    const src = context?.sourceType;
    closeInvestigation();
    if (src === 'forecast') navigate('/attack-prediction');
    else if (src === 'entity' || src === 'alert') navigate('/');
    else navigate(-1);
  }, [context, closeInvestigation, navigate]);

  const handleGenerateFindings = useCallback(() => {
    generateFindings();
    addToast('Demo findings generated.', 'success');
  }, [generateFindings, addToast]);

  const handleRefresh = useCallback(() => {
    if (context) {
      openInvestigation(context);
      refreshTimeline();
      addToast('Investigation refreshed.', 'info');
    }
  }, [context, openInvestigation, refreshTimeline, addToast]);

  if (!investigation) {
    return <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>Loading investigation…</div>;
  }

  const stage     = isLive ? (currentForecast?.current_stage ?? 'Normal Activity') : 'No Active Session';
  const nextStage = isLive ? (currentForecast?.predicted_next_stage ?? 'N/A') : 'N/A';
  const risk      = getRiskFromStage(stage);
  const entityIp  = investigation.selectedEntityIp;
  const hostname  = getHostname(entityIp);

  // Connection counts from live events (in current display window)
  const nodeEvents = displayEvents.filter(e => e.src_ip === entityIp || e.dst_ip === entityIp);
  const connCount = nodeEvents.length;
  const suspCount = nodeEvents.filter(e => e.classification === 'suspicious').length;

  let firstSeen = '-';
  let lastSeen = '-';
  if (nodeEvents.length > 0) {
    const firstEv = nodeEvents[nodeEvents.length - 1];
    const lastEv = nodeEvents[0];
    firstSeen = firstEv.timestamp.slice(11, 19) || new Date(firstEv.timestamp).toLocaleTimeString('en-US', { hour12: false });
    lastSeen = lastEv.timestamp.slice(11, 19) || new Date(lastEv.timestamp).toLocaleTimeString('en-US', { hour12: false });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Page Header ── */}
      <div style={{ padding: '14px 0 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          {/* Left: title + meta */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>
                Investigation
              </h1>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)', background: 'rgba(99,102,241,0.08)', padding: '2px 10px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.2)' }}>
                {investigation.id}
              </span>
              <StatusBadge status={investigation.status} />
              <PriorityBadge priority={investigation.priority} />
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span>Entity: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{entityIp}</strong></span>
              <span>Type: <strong style={{ color: 'var(--text-secondary)' }}>{investigation.entityType}</strong></span>
              <span>Started: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{new Date(investigation.openedAt).toLocaleTimeString('en-US', { hour12: false })}</strong></span>
              <span>Source: <strong style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{investigation.sourceType}</strong></span>
              {isLive && <LiveBadge />}
            </div>
          </div>

          {/* Right: action buttons */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            <ActionBtn icon={<ArrowLeft size={13} />}   label="Back"              onClick={handleBack}             variant="ghost" />
            <ActionBtn icon={<RefreshCw size={13} />}   label="Refresh"           onClick={handleRefresh}          variant="ghost" />
            <ActionBtn icon={<Sparkles size={13} />}    label="Generate Findings" onClick={handleGenerateFindings} variant="primary" />
            <ActionBtn icon={<FileText size={13} />}    label="Generate Report"   onClick={openReportModal}        variant="secondary" />
          </div>
        </div>

        {/* Demo badge */}
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <DemoBadge label="LIVE DEMO" color="var(--color-live)" />
          <DemoBadge label="SIMULATED DATA" color="var(--color-warning)" />
          <DemoBadge label="Not real attack evidence — demonstration only" color="var(--text-muted)" small />
        </div>
      </div>

      {/* ── 3-column workspace ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', gap: 12, paddingTop: 12 }}>

        {/* ── LEFT PANEL ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>

          {/* Entity Details */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Entity Details</h3>
              <div style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: risk.bg, color: risk.color, border: `1px solid ${risk.color}30` }}>
                {risk.label}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <DetailRow label="IP Address"    value={entityIp}                     mono />
              <DetailRow label="Hostname"      value={hostname}                     mono />
              <DetailRow label="Entity Type"   value={investigation.entityType} />
              <DetailRow label="First Seen"    value={firstSeen}                    mono />
              <DetailRow label="Last Seen"     value={lastSeen}                     mono />
              <DetailRow label="Connections"   value={connCount.toString()} highlight={false} />
              <DetailRow label="Suspicious"    value={suspCount.toString()} highlight={suspCount > 5} />
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, marginTop: 2 }}>
                <DetailRow label="Current Stage"  value={stage}    highlight={!currentForecast?.is_benign} />
                <DetailRow label="Predicted Next" value={nextStage} highlight={!currentForecast?.is_benign} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              <AlertTriangle size={10} /> Demo / simulated entity data
            </div>
          </div>

          {/* Attack Stage Overlay */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Attack Stages</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ATTACK_STAGES.map(s => {
                const colors = STAGE_COLORS[s];
                const isCurrent   = isLive && s === stage && !currentForecast?.is_benign;
                const isPredicted = isLive && s === nextStage && !isCurrent && !currentForecast?.is_benign;
                const isObserved  = isLive && !currentForecast?.is_benign && ATTACK_STAGES.indexOf(s) < ATTACK_STAGES.indexOf(stage as typeof ATTACK_STAGES[number]);

                let icon = <Circle size={10} color="var(--border-default)" />;
                let labelText = 'Not observed';
                let labelColor = 'var(--text-muted)';

                if (isObserved) { icon = <CheckCircle size={10} color="var(--color-live)" />; labelText = 'Observed'; labelColor = 'var(--color-live)'; }
                if (isCurrent)  { icon = <span style={{ fontSize: 10, lineHeight: 1 }}>●</span>; labelText = 'CURRENT'; labelColor = colors.text; }
                if (isPredicted){ icon = <Circle size={10} color="var(--color-warning)" fill="none" />; labelText = 'Predicted'; labelColor = 'var(--color-warning)'; }

                return (
                  <div key={s} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', borderRadius: 8,
                    background: isCurrent ? colors.bg : 'transparent',
                    border: `1px solid ${isCurrent ? colors.border : 'transparent'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ color: isCurrent ? colors.text : isPredicted ? 'var(--color-warning)' : isObserved ? 'var(--color-live)' : 'var(--border-default)' }}>
                        {icon}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? colors.text : isObserved ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                        {s}
                      </span>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: labelColor }}>{labelText}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Supporting Indicators */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Supporting Indicators</h3>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 8 }}>
              Supports the current demo hypothesis. Not confirmed attack evidence.
            </div>
            {isLive && (currentForecast?.supporting_features?.length ? currentForecast.supporting_features : []).length > 0 ? (
              (currentForecast?.supporting_features ?? []).map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: i < 3 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'flex-start' }}>
                  <CheckCircle size={12} color={currentForecast?.is_benign ? 'var(--color-live)' : 'var(--color-warning)'} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{f}</span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No supporting indicators. Start session to analyze.</div>
            )}
          </div>

          {/* Finding Card */}
          {showFindingCard && findings.length > 0 && (
            <div style={{ ...cardStyle, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                  <FileText size={14} /> Finding
                </h3>
                <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  DEMO ANALYSIS
                </span>
              </div>
              {findings[0] && (
                <>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>{findings[0].summary}</p>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>Confidence: <strong style={{ color: 'var(--primary)' }}>{findings[0].confidence}</strong></div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Supporting observations</div>
                  {findings[0].observations.slice(0, 4).map((obs, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--primary)', fontSize: 11, fontWeight: 700 }}>→</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{obs.text}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--bg-workspace)', borderRadius: 8, fontSize: 11 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Predicted next: </span>
                    <strong style={{ color: 'var(--color-critical)' }}>{findings[0].predictedNext}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    <AlertTriangle size={10} /> Generated: {findings[0].generatedAt} · {findings[0].isDemoFinding ? 'Demo finding — not real threat intelligence' : ''}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── CENTER: Graph ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden', minHeight: 0 }}>
          {/* Stage overlay bar */}
          <AttackStageBar currentStage={stage} predictedStage={nextStage} isBenign={currentForecast?.is_benign ?? true} />

          {/* Graph */}
          <div style={{ flex: 1, minHeight: 500, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', overflow: 'hidden', position: 'relative' }}>
            <LiveEntityGraph
              nodes={liveNodes}
              edges={liveEdges}
              running={isLive}
              focusIp={entityIp}
              isExpanded
              onNodeSelect={(ip) => {
                setSearchParams(prev => { 
                  const next = new URLSearchParams(prev);
                  next.set('ip', ip);
                  return next;
                });
              }}
            />
          </div>

          {/* Attack Path Summary */}
          <AttackPathSummary isBenign={!isLive || (currentForecast?.is_benign ?? true)} currentStage={stage} />
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 4, paddingBottom: 20 }}>
          <TimelinePanel />
          <RelatedActivityTable />
        </div>
      </div>

      {/* ── Report Modal ── */}
      {showReportModal && (
        <ReportModal onClose={closeReportModal} investigationId={investigation.id} />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function AttackStageBar({ currentStage, predictedStage, isBenign }: { currentStage: string; predictedStage: string; isBenign: boolean }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-default)', padding: '8px 14px',
      display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>Attack Path:</span>
      {ATTACK_STAGES.map((s, i) => {
        const colors = STAGE_COLORS[s];
        const isCur   = s === currentStage && !isBenign;
        const isPred  = s === predictedStage && !isCur && !isBenign;
        const isDone  = !isBenign && ATTACK_STAGES.indexOf(s) < ATTACK_STAGES.indexOf(currentStage as typeof ATTACK_STAGES[number]);
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
              background: isCur ? colors.bg : isPred ? colors.bg + '50' : isDone ? '#d1fae5' : 'var(--bg-workspace)',
              color: isCur ? colors.text : isPred ? colors.text : isDone ? 'var(--color-live)' : 'var(--text-muted)',
              border: `1px solid ${isCur ? colors.border : isPred ? colors.border + '60' : isDone ? 'rgba(16,185,129,0.3)' : 'var(--border-subtle)'}`,
            }}>
              {isDone ? <CheckCircle size={10} /> : isCur ? <Circle size={8} fill="currentColor" /> : isPred ? <Circle size={8} /> : null}
              {s}
            </span>
            {i < ATTACK_STAGES.length - 1 && <span style={{ color: 'var(--border-default)', fontSize: 12 }}>→</span>}
          </div>
        );
      })}
    </div>
  );
}

function AttackPathSummary({ isBenign, currentStage }: { isBenign: boolean; currentStage: string }) {
  const PATH = ['Workstation', 'Suspicious Host', 'Application Server', 'Database', 'External Destination'];
  return (
    <div style={{ ...cardStyle, padding: '10px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Attack Path Summary</h3>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic' }}>Simulated demo path</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {PATH.map((node, i) => (
          <div key={node} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-workspace)', padding: '3px 8px', borderRadius: 6 }}>
              {node}
            </span>
            {i < PATH.length - 1 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>↓</span>}
          </div>
        ))}
      </div>
      {!isBenign && (
        <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 10 }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Observed stages: </span>
            <span style={{ color: 'var(--color-live)', fontWeight: 700 }}>
              {ATTACK_STAGES.filter((_s, i) => i <= ATTACK_STAGES.indexOf(currentStage as typeof ATTACK_STAGES[number]) && currentStage !== 'Normal Activity').join(' → ')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportModal({ onClose, investigationId }: { onClose: () => void; investigationId: string }) {
  const [isGenerated, setIsGenerated] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setIsGenerated(true);
    }, 600);
  };

  const handleExportPdf = () => {
    generateSecurityReportPdf({
      title: `SECURITY INVESTIGATION REPORT — ${investigationId}`,
      reportId: investigationId,
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16, padding: 32, width: 520, maxWidth: '90vw',
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)', border: '1px solid var(--border-default)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={20} color="var(--primary)" />
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
              {isGenerated ? 'Security Report Ready' : 'Generate Security Report'}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {!isGenerated ? (
          <div style={{ background: 'var(--bg-workspace)', borderRadius: 12, padding: 16, marginBottom: 20, border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <CheckCircle size={14} color="var(--color-live)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-live)' }}>Forensic Intelligence Pipeline</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Click <strong>Generate Report</strong> to compile the complete security report for <strong style={{ fontFamily: 'var(--font-mono)' }}>{investigationId}</strong>.
              <br /><br />
              The generated report includes Critical Findings, Attack Chain Mapping, Affected Assets, and Actionable Remediation recommendations.
            </p>
          </div>
        ) : (
          <div style={{ background: 'rgba(16,185,129,0.06)', borderRadius: 12, padding: 16, marginBottom: 20, border: '1px solid rgba(16,185,129,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <CheckCircle size={15} color="var(--color-live)" />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-live)' }}>Report Generated Successfully</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Target: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{investigationId}</strong><br />
              Summary: 3 Critical Findings, 5 Affected Assets, 4 Actionable Remediation Steps.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            fontSize: 13, fontWeight: 600, padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
            background: 'var(--bg-workspace)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)',
          }}>
            Close
          </button>

          {!isGenerated ? (
            <button
              onClick={handleGenerate}
              disabled={loading}
              style={{
                fontSize: 13, fontWeight: 600, padding: '8px 20px', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                background: 'var(--primary)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <FileText size={14} />
              {loading ? 'Generating Report...' : 'Generate Report'}
            </button>
          ) : (
            <button
              onClick={handleExportPdf}
              className="btn-export-pdf"
            >
              <FileText size={15} /> Export PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Utility components ────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    OPEN:        { bg: '#dbeafe', color: '#1d4ed8' },
    IN_PROGRESS: { bg: '#fef3c7', color: '#92400e' },
    CLOSED:      { bg: '#d1fae5', color: '#065f46' },
  };
  const c = colors[status] ?? colors.OPEN;
  return <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 999, background: c.bg, color: c.color }}>{status}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = { CRITICAL: '#dc2626', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#10b981' };
  const color = colors[priority] ?? '#94a3b8';
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 999, background: color + '15', color, border: `1px solid ${color}40` }}>
      {priority}
    </span>
  );
}

function LiveBadge() {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(16,185,129,0.1)', color: 'var(--color-live)', border: '1px solid rgba(16,185,129,0.3)' }}>
      ● LIVE
    </span>
  );
}

function DemoBadge({ label, color, small }: { label: string; color: string; small?: boolean }) {
  return (
    <span style={{ fontSize: small ? 9 : 10, fontWeight: 600, padding: '2px 10px', borderRadius: 999, background: 'var(--bg-input)', color, border: '1px solid var(--border-default)' }}>
      {label}
    </span>
  );
}

function ActionBtn({ icon, label, onClick, variant }: { icon: React.ReactNode; label: string; onClick: () => void; variant: 'primary' | 'secondary' | 'ghost' }) {
  const styles: Record<string, React.CSSProperties> = {
    primary:   { background: 'var(--primary)', color: 'white', border: 'none' },
    secondary: { background: 'var(--bg-workspace)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' },
    ghost:     { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' },
  };
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', ...styles[variant] }}>
      {icon}{label}
    </button>
  );
}

function DetailRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: highlight ? 'var(--color-critical)' : 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'inherit', textAlign: 'right', wordBreak: 'break-all' }}>
        {value}
      </span>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border-default)',
  padding: 14,
};
