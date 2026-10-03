import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Square, WifiOff, RotateCcw, Trash2,
  Filter, RefreshCw, AlertTriangle, ShieldAlert, CheckCircle2, ShieldCheck, Clock, Activity,
  ChevronDown, ChevronRight, Radio, Cpu, Network,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { useLiveStore } from '@/store/liveStore';
import { useAppStore } from '@/store/appStore';
import { useForecastStore } from '@/store/forecastStore';
import { apiService } from '@/services/api';
import { wsService } from '@/services/websocket';
import type { DemoMode, WindowSecs, CaptureInterface, TrafficSourceMetrics } from '@/types/live';
import { significantActivities } from '@/lib/activityGrouping';
import { ActivityList } from '@/components/activity/ActivityList';
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';
import { ActivityInspector } from '@/components/activity/ActivityInspector';
import { useFocusParam } from '@/hooks/useFocusParam';
import type { TemporalState } from '@/types/live';


const WINDOW_OPTIONS: WindowSecs[] = [5, 10, 15, 30, 60];

function generateZeroChartData(rangeMinutes: number) {
  const data = [];
  const now = Date.now();
  const timeStep = rangeMinutes === 1 ? 2000 : rangeMinutes === 5 ? 10000 : 30000;
  const points = 30;
  
  const currentQuantizedTime = Math.floor(now / timeStep) * timeStep;

  for (let i = points - 1; i >= 0; i--) {
    const t = currentQuantizedTime - (i * timeStep);
    data.push({
      timestamp: t,
      time: new Date(t).toLocaleTimeString('en-US', { hour12: false }),
      packets: 0,
      flows: 0,
      suspicious: 0
    });
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
export function LiveMonitoringPage() {
  const navigate = useNavigate();
  const { addToast } = useAppStore();
  const {
    wsConnected, session, backendAvailable, setBackendAvailable,
    displayEvents, clearEvents,
    currentTemporal, temporalHistory,
    searchQuery, setSearchQuery,
    windowSeconds, mode, setWindowSeconds, setMode,
    activities, trafficSummary, runId,
  } = useLiveStore();
  const { currentForecast } = useForecastStore();
  const [inspectId, setInspectId] = useState<string | null>(null);
  const grouped = useMemo(() => significantActivities(activities), [activities]);
  const inspected = inspectId ? activities.find(a => a.id === inspectId) ?? null : null;
  const alertCount = grouped.reduce((n, a) => n + a.alertIds.length, 0);
  const [showPackets, setShowPackets] = useState(false);

  // Source selection & Interface discovery
  const [sourceType, setSourceType] = useState<'synthetic' | 'live'>('synthetic');
  const [interfaces, setInterfaces] = useState<CaptureInterface[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string>('');
  const [bpfFilter, setBpfFilter] = useState<string>('');
  const [liveMetrics, setLiveMetrics] = useState<TrafficSourceMetrics | null>(null);

  // Deep link (?focus=ACT-0003) and timeline "Show in activity list" → exact row, highlighted
  const [highlight, setHighlight] = useState<{ id: string; key: string | number } | null>(null);
  const focus = useFocusParam();
  const [handledFocus, setHandledFocus] = useState<string | null>(null);
  if (focus && focus.key !== handledFocus && activities.some(a => a.id === focus.id)) {
    setHandledFocus(focus.key);
    setHighlight(focus);
    setInspectId(focus.id);
  }

  const isRunning = session?.running ?? false;
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  const [chartTimeRange, setChartTimeRange] = useState<1 | 5 | 15>(1);

  const realChartData = useMemo(() => {
    if (temporalHistory.length === 0) return [];
    const list = temporalHistory.map((t, idx) => {
      let dateObj = new Date();
      if (t.window_end) {
        const raw = String(t.window_end).replace(/\+00:00Z$/, 'Z').replace(/\+00:00$/, 'Z');
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
          dateObj = d;
        } else if (typeof t.window_end === 'number') {
          dateObj = new Date(t.window_end < 1e11 ? t.window_end * 1000 : t.window_end);
        } else {
          const num = Number(raw);
          if (!isNaN(num)) {
            dateObj = new Date(num < 1e11 ? num * 1000 : num);
          }
        }
      } else {
        dateObj = new Date(Date.now() - (temporalHistory.length - 1 - idx) * 10000);
      }
      return {
        timestamp: dateObj.getTime(),
        time: dateObj.toLocaleTimeString('en-US', { hour12: false }),
        packets: t.packet_count,
        flows: t.flow_count || Math.floor(t.packet_count / 10) || 0,
        suspicious: t.suspicious_count,
      };
    });

    if (list.length === 1) {
      const first = list[0];
      const prevTime = new Date(first.timestamp - 10000);
      return [
        {
          timestamp: prevTime.getTime(),
          time: prevTime.toLocaleTimeString('en-US', { hour12: false }),
          packets: Math.max(0, Math.floor(first.packets * 0.5)),
          flows: Math.max(0, Math.floor(first.flows * 0.5)),
          suspicious: 0,
        },
        first,
      ];
    }

    return list;
  }, [temporalHistory]);

  // The filling window is appended as the newest point, so the chart moves every second.
  const liveChartData = useMemo(() => {
    if (!currentTemporal?.partial || currentTemporal.packet_count === 0) return realChartData;
    const now = new Date();
    const scale = 1 / Math.max(0.05, currentTemporal.window_progress ?? 1);
    return [...realChartData, {
      timestamp: now.getTime(),
      time: `${now.toLocaleTimeString('en-US', { hour12: false })} (filling)`,
      // Projected to a full window so the point is comparable with closed windows
      packets: Math.round(currentTemporal.packet_count * scale),
      flows: Math.round(currentTemporal.flow_count * scale),
      suspicious: Math.round(currentTemporal.suspicious_count * scale),
    }];
  }, [realChartData, currentTemporal]);

  const chartData = liveChartData.length > 0
    ? liveChartData
    : generateZeroChartData(chartTimeRange);

  // Check backend health, fetch interfaces and sync running session status
  useEffect(() => {
    apiService.checkHealth()
      .then(async () => {
        setBackendAvailable(true);
        try {
          const ifaceRes = await apiService.getInterfaces();
          setInterfaces(ifaceRes.interfaces);
          if (ifaceRes.default_interface) {
            setSelectedInterface(String(ifaceRes.default_interface));
          } else if (ifaceRes.interfaces.length > 0) {
            setSelectedInterface(String(ifaceRes.interfaces[0].index));
          }
        } catch (e) {
          console.warn('Failed to load capture interfaces:', e);
        }

        try {
          const status = await apiService.getLiveStatus();
          useLiveStore.getState().setSession(status);
          if (status.running && !wsConnected) {
            wsService.connect();
          }
          if (status.source_type) {
            setSourceType(status.source_type);
          }
          if (status.interface) {
            setSelectedInterface(status.interface);
          }
        } catch (e) {
          console.error('Failed to sync live status:', e);
        }
      })
      .catch(() => setBackendAvailable(false));
  }, [setBackendAvailable, wsConnected]);

  // Periodic metrics polling when active
  useEffect(() => {
    if (!isRunning) {
      setLiveMetrics(null);
      return;
    }
    const interval = setInterval(async () => {
      try {
        const m = await apiService.getLiveMetrics();
        setLiveMetrics(m);
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // ── Filtered events ──────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return displayEvents;
    const q = searchQuery.toLowerCase();
    return displayEvents.filter(e => {
      const parts = [
        e.src_ip, e.dst_ip, e.protocol, e.classification,
        String(e.src_port), String(e.dst_port), e.payload_info || ''
      ].map(p => p.toLowerCase());
      return parts.some(p => p.includes(q));
    });
  }, [displayEvents, searchQuery]);

  // ── Start / Stop handlers ────────────────────────────────────
  async function handleStart() {
    setStarting(true);
    try {
      useLiveStore.getState().beginRun();
      const res = await apiService.startLive({
        mode,
        window_seconds: windowSeconds,
        source_type: sourceType,
        interface: sourceType === 'live' ? selectedInterface : undefined,
        bpf_filter: sourceType === 'live' && bpfFilter.trim() ? bpfFilter.trim() : undefined,
      });
      useLiveStore.getState().setSession(res.status);
      wsService.connect();
      addToast(
        sourceType === 'live'
          ? `Live Npcap/TShark capture active on ${selectedInterface || 'default'}.`
          : 'Synthetic demo session started.',
        'success'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Failed to start capture: ${msg}`, 'error');
    } finally {
      setStarting(false);
    }
  }

  async function handleStop() {
    setStopping(true);
    try {
      const res = await apiService.stopLive();
      useLiveStore.getState().setSession(res.status);
      wsService.disconnect();
      addToast('Traffic ingestion stopped.', 'info');
    } catch {
      addToast('Stop request failed. Backend may be unreachable.', 'error');
    } finally {
      setStopping(false);
    }
  }

  async function handleReset() {
    try {
      wsService.disconnect();
      const res = await apiService.resetLive().catch(() => null);
      useLiveStore.getState().clearEvents();
      if (res?.status) {
        useLiveStore.getState().setSession(res.status);
      } else {
        const status = await apiService.getLiveStatus().catch(() => null);
        if (status) {
          useLiveStore.getState().setSession(status);
        }
      }
      addToast('Session and live entities reset.', 'info');
    } catch {
      useLiveStore.getState().clearEvents();
      addToast('Reset completed.', 'info');
    }
  }

  async function handleRetry() {
    try {
      await apiService.checkHealth();
      setBackendAvailable(true);
      addToast('Backend connection restored.', 'success');
    } catch {
      addToast('Backend still unreachable. Make sure uvicorn is running.', 'error');
    }
  }

  // Self-test state
  const [testingCapture, setTestingCapture] = useState(false);
  const [selfTestResult, setSelfTestResult] = useState<import('@/types/live').CaptureSelfTestResult | null>(null);
  const [showSelfTestResult, setShowSelfTestResult] = useState(false);

  // Trigger automated capture self-test
  async function handleSelfTest() {
    if (!selectedInterface && interfaces.length > 0) {
      setSelectedInterface(String(interfaces[0].index));
    }
    const ifaceId = selectedInterface || (interfaces[0] ? String(interfaces[0].index) : '1');
    setTestingCapture(true);
    setShowSelfTestResult(true);
    setSelfTestResult(null);
    try {
      const res = await apiService.testCapture({
        interface_id: ifaceId,
        duration_seconds: 5,
        bpf_filter: bpfFilter.trim() || undefined,
      });
      setSelfTestResult(res);
      if (res.healthy) {
        addToast(`Self-test passed on ${res.interface_name}: ${res.packets.toLocaleString()} packets captured (${res.mbps} Mbps).`, 'success');
      } else {
        addToast(`Self-test failed: ${res.error || 'Zero packets captured'}.`, 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSelfTestResult({
        healthy: false,
        interface_id: ifaceId,
        interface_name: 'Unknown',
        packets: 0,
        bytes: 0,
        duration_seconds: 5,
        packets_per_second: 0,
        mbps: 0,
        capture_drops: 0,
        stderr: msg,
        error: msg,
      });
      addToast(`Self-test execution error: ${msg}`, 'error');
    } finally {
      setTestingCapture(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              Live Monitoring
            </h1>
            <StatusBadge
              running={isRunning}
              wsConnected={wsConnected}
              healthStatus={session?.health_status || (isRunning ? (session?.packet_count ? 'RUNNING' : 'NO_TRAFFIC') : 'STOPPED')}
              packetCount={session?.packet_count ?? 0}
            />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Real-time traffic stream · Decoupled Dumpcap ingestion · Temporal aggregation · Attack Forecasting
          </p>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11,
          color: (session?.running ? session.source_type : sourceType) === 'live' ? 'var(--color-live)' : 'var(--text-muted)',
          background: (session?.running ? session.source_type : sourceType) === 'live' ? 'var(--color-live-light)' : 'var(--color-warning-light)',
          border: `1px solid ${(session?.running ? session.source_type : sourceType) === 'live' ? 'var(--color-live)' : 'var(--color-warning)'}`,
          borderRadius: 8, padding: '6px 12px'
        }}>
          {(session?.running ? session.source_type : sourceType) === 'live' ? (
            <><Network size={13} /> <strong>REAL NETWORK TRAFFIC</strong> — Windows Npcap/Dumpcap ({session?.interface_name || session?.interface || selectedInterface || 'Live Interface'})</>
          ) : (
            <><AlertTriangle size={12} /> SYNTHETIC DEMO TRAFFIC — Deterministic generator</>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 16, paddingBottom: 40 }}>
        {/* ── Backend unavailable warning ── */}
        {!backendAvailable && (
          <div style={{ background: 'var(--color-critical-light)', border: '1px solid var(--color-critical)', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <WifiOff size={18} color="var(--color-critical)" />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--color-critical)', fontSize: 13 }}>Backend unavailable</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Unable to connect to live demo backend at {import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}.
                </div>
              </div>
            </div>
            <button onClick={handleRetry} style={btnStyle('primary')}>
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {/* ── Explicit NO_TRAFFIC or DEGRADED notification banner ── */}
        {isRunning && (session?.source_type === 'live' || sourceType === 'live') && (session?.health_status === 'NO_TRAFFIC' || (session?.packet_count === 0 && !starting)) && (
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--color-warning)', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} color="var(--color-warning)" />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--color-warning)', fontSize: 13 }}>No Network Traffic Observed</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Capture process is running on <strong>{session?.interface_name || session?.interface || selectedInterface}</strong>, but 0 packets have been captured.
                  Please generate network activity or run a capture self-test.
                </div>
              </div>
            </div>
            <button onClick={handleSelfTest} disabled={testingCapture} style={btnStyle('secondary-sm')}>
              {testingCapture ? <Spinner /> : 'Test Capture'}
            </button>
          </div>
        )}

        {/* ── Capture Self-Test Modal / Result Panel ── */}
        {showSelfTestResult && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--shadow-md)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={16} color="var(--primary)" />
                <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                  Npcap / Dumpcap Capture Self-Test
                </span>
                {selfTestResult && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                    background: selfTestResult.healthy ? 'var(--color-live-light)' : 'var(--color-critical-light)',
                    color: selfTestResult.healthy ? 'var(--color-live)' : 'var(--color-critical)',
                    border: `1px solid ${selfTestResult.healthy ? 'var(--color-live)' : 'var(--color-critical)'}`,
                  }}>
                    {selfTestResult.healthy ? 'PASS' : 'FAIL'}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowSelfTestResult(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
              >
                Dismiss
              </button>
            </div>

            {testingCapture ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                <Spinner />
                <span>Executing 5-second raw PCAPNG capture test on interface #{selectedInterface || '1'}...</span>
              </div>
            ) : selfTestResult ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 12 }}>
                  <div style={{ background: 'var(--bg-workspace)', padding: '10px 12px', borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>INTERFACE</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{selfTestResult.interface_name} (#{selfTestResult.interface_id})</div>
                  </div>
                  <div style={{ background: 'var(--bg-workspace)', padding: '10px 12px', borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>PACKETS CAPTURED</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: selfTestResult.packets > 0 ? 'var(--color-live)' : 'var(--color-critical)', marginTop: 2 }}>
                      {selfTestResult.packets.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-workspace)', padding: '10px 12px', borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>THROUGHPUT</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                      {selfTestResult.mbps} Mbps ({selfTestResult.packets_per_second} pps)
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-workspace)', padding: '10px 12px', borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>DURATION / DROPS</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: selfTestResult.capture_drops > 0 ? 'var(--color-critical)' : 'var(--text-primary)', marginTop: 2 }}>
                      {selfTestResult.duration_seconds}s / {selfTestResult.capture_drops} drops
                    </div>
                  </div>
                </div>
                {selfTestResult.stderr && (
                  <div style={{ background: 'var(--bg-workspace)', padding: '8px 12px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', maxHeight: 80, overflowY: 'auto' }}>
                    {selfTestResult.stderr}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* ── Control Panel ── */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)', padding: '18px 20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end' }}>

            {/* Ingestion Source */}
            <div>
              <div style={labelStyle}>Ingestion Source</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  disabled={isRunning}
                  onClick={() => setSourceType('synthetic')}
                  style={{
                    padding: '8px 14px', borderRadius: 8, border: '1px solid',
                    fontSize: 12, fontWeight: 600, cursor: isRunning ? 'not-allowed' : 'pointer',
                    borderColor: sourceType === 'synthetic' ? 'var(--primary)' : 'var(--border-default)',
                    background: sourceType === 'synthetic' ? 'var(--primary-light)' : 'var(--bg-card)',
                    color: sourceType === 'synthetic' ? 'var(--primary)' : 'var(--text-secondary)',
                    opacity: isRunning ? 0.6 : 1,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Cpu size={13} /> Synthetic Gen
                  </span>
                </button>
                <button
                  disabled={isRunning}
                  onClick={() => setSourceType('live')}
                  style={{
                    padding: '8px 14px', borderRadius: 8, border: '1px solid',
                    fontSize: 12, fontWeight: 600, cursor: isRunning ? 'not-allowed' : 'pointer',
                    borderColor: sourceType === 'live' ? 'var(--color-live)' : 'var(--border-default)',
                    background: sourceType === 'live' ? 'var(--color-live-light)' : 'var(--bg-card)',
                    color: sourceType === 'live' ? 'var(--color-live)' : 'var(--text-secondary)',
                    opacity: isRunning ? 0.6 : 1,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Radio size={13} /> Real Npcap / Dumpcap
                  </span>
                </button>
              </div>
            </div>

            {/* Real Capture Interface Selection */}
            {sourceType === 'live' && (
              <div>
                <div style={labelStyle}>Capture Interface</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    disabled={isRunning}
                    value={selectedInterface}
                    onChange={(e) => setSelectedInterface(e.target.value)}
                    style={{
                      padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-default)',
                      background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12,
                      fontWeight: 500, cursor: isRunning ? 'not-allowed' : 'pointer', minWidth: 220,
                    }}
                  >
                    {interfaces.map((iface) => (
                      <option key={iface.index || iface.id || iface.name} value={String(iface.index)}>
                        #{iface.index}: {iface.name} {iface.is_recommended ? '★ (Active Recommended)' : ''}
                      </option>
                    ))}
                    {interfaces.length === 0 && <option value="">Detecting interfaces...</option>}
                  </select>
                  <button
                    disabled={testingCapture || isRunning}
                    onClick={handleSelfTest}
                    style={{
                      ...btnStyle('secondary-sm'),
                      opacity: (testingCapture || isRunning) ? 0.6 : 1,
                      cursor: (testingCapture || isRunning) ? 'not-allowed' : 'pointer',
                    }}
                    title="Run an automated 5-second packet capture verification"
                  >
                    {testingCapture ? <Spinner /> : <><Activity size={12} /> Test Capture</>}
                  </button>
                </div>
              </div>
            )}

            {/* BPF Filter Input */}
            {sourceType === 'live' && (
              <div>
                <div style={labelStyle}>BPF Filter</div>
                <input
                  type="text"
                  disabled={isRunning}
                  placeholder="e.g. tcp or udp (optional)"
                  value={bpfFilter}
                  onChange={(e) => setBpfFilter(e.target.value)}
                  style={{
                    padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-default)',
                    background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12,
                    fontFamily: 'var(--font-mono)', width: 160,
                  }}
                />
              </div>
            )}

            {/* Traffic Mode (for Synthetic) */}
            {sourceType === 'synthetic' && (
              <div>
                <div style={labelStyle}>Traffic Mode</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['benign', 'suspicious'] as DemoMode[]).map(m => (
                    <button
                      key={m}
                      disabled={isRunning}
                      onClick={() => setMode(m)}
                      style={{
                        padding: '8px 14px', borderRadius: 8, border: '1px solid',
                        fontSize: 12, fontWeight: 600, cursor: isRunning ? 'not-allowed' : 'pointer',
                        borderColor: mode === m ? (m === 'suspicious' ? 'var(--color-critical)' : 'var(--color-live)') : 'var(--border-default)',
                        background: mode === m ? (m === 'suspicious' ? 'var(--color-critical-light)' : 'var(--color-live-light)') : 'var(--bg-card)',
                        color: mode === m ? (m === 'suspicious' ? 'var(--color-critical)' : 'var(--color-live)') : 'var(--text-secondary)',
                        opacity: isRunning ? 0.6 : 1,
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {m === 'suspicious' ? <ShieldAlert size={13} /> : <ShieldCheck size={13} />}
                        {m === 'suspicious' ? 'Suspicious' : 'Benign'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Temporal Window */}
            <div>
              <div style={labelStyle}>Temporal Window</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {WINDOW_OPTIONS.map(w => (
                  <button
                    key={w}
                    disabled={isRunning}
                    onClick={() => setWindowSeconds(w)}
                    style={{
                      padding: '6px 10px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 600,
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      borderColor: windowSeconds === w ? 'var(--primary)' : 'var(--border-default)',
                      background: windowSeconds === w ? 'var(--primary-light)' : 'var(--bg-card)',
                      color: windowSeconds === w ? 'var(--primary)' : 'var(--text-muted)',
                      opacity: isRunning ? 0.6 : 1,
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    {w}s
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1 }} />

            {/* Start / Stop */}
            <div data-tour="live-controls" style={{ display: 'flex', gap: 8 }}>
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  disabled={starting || !backendAvailable}
                  style={{
                    ...btnStyle('live'),
                    opacity: (starting || !backendAvailable) ? 0.5 : 1,
                    cursor: (starting || !backendAvailable) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {starting
                    ? <><Spinner /> Starting…</>
                    : <><Play size={14} /> Start {sourceType === 'live' ? 'Live Capture' : 'Live Stream'}</>
                  }
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  disabled={stopping}
                  style={{ ...btnStyle('critical'), opacity: stopping ? 0.5 : 1 }}
                >
                  {stopping ? <><Spinner /> Stopping…</> : <><Square size={14} /> Stop</>}
                </button>
              )}
              <button onClick={handleReset} style={btnStyle('ghost-sm')} title="Reset Entities & Session">
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>

          {/* Session & Ingestion stats */}
          {session && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatChip label="Capture State" value={session.health_status || (isRunning ? 'RUNNING' : 'STOPPED')} color={session.health_status === 'RUNNING' ? 'var(--color-live)' : session.health_status === 'NO_TRAFFIC' ? 'var(--color-warning)' : undefined} />
              <StatChip label="Interface" value={session.interface_name || session.interface || 'Wi-Fi'} mono />
              <StatChip label="Session" value={runId ?? session.session_id} mono />
              <StatChip label="Packets" value={session.packet_count.toLocaleString()} />
              <StatChip label="Traffic Rate" value={liveMetrics ? `${(liveMetrics.capture_mbps || 0).toFixed(2)} Mbps` : '0.00 Mbps'} color="var(--primary)" />
              <StatChip label="Capture Drops" value={`${liveMetrics?.capture_drops ?? 0}`} color={(liveMetrics?.capture_drops ?? 0) > 0 ? 'var(--color-critical)' : undefined} />
              <StatChip label="Queue Drops" value={`${liveMetrics?.queue_drops ?? 0}`} color={(liveMetrics?.queue_drops ?? 0) > 0 ? 'var(--color-critical)' : undefined} />
              <StatChip label="Processing Lag" value={`${(liveMetrics?.processing_lag_ms ?? 0).toFixed(1)} ms`} />
              <StatChip label="Entities" value={session.active_entities.length.toString()} />
              <StatChip label="Window" value={`${session.window_seconds}s`} />
            </div>
          )}
        </div>

        {/* ── Grouped activities + Attack Timeline ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 20 }}>
          <div data-tour="live-activities" style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Detected Activities</h3>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {trafficSummary.suspicious.toLocaleString()} suspicious packets grouped into {grouped.length} activit{grouped.length === 1 ? 'y' : 'ies'} · {alertCount} alert{alertCount === 1 ? '' : 's'}
                </div>
              </div>
              {isRunning && <PulseDot color="var(--color-live)" label="LIVE" />}
            </div>
            <ActivityList
              activities={grouped}
              live
              onSelect={a => setInspectId(a.id)}
              highlight={highlight}
              maxHeight={320}
              emptyText={isRunning ? 'No suspicious activity grouped yet — benign traffic is summarised in the chart below.' : 'Start a live session to group suspicious traffic into activities.'}
            />
          </div>

          <div data-tour="live-timeline" style={{ ...panelStyle, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Attack Timeline</h3>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Activity-level events · newest at bottom</span>
            </div>
            <ActivityTimeline
              activities={grouped}
              onSelect={a => setInspectId(a.id)}
              onLocate={a => setHighlight({ id: a.id, key: Date.now() })}
              predicted={currentForecast && !currentForecast.is_benign && isRunning
                ? { stage: currentForecast.predicted_next_stage, target: currentForecast.target }
                : null}
              maxHeight={320}
              emptyText="Major events appear here when an activity is detected, escalates or changes shape."
            />
          </div>
        </div>

        {/* ── Two-column: Chart + Temporal State ── */}
        <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 20 }}>
          {/* Live Chart */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Live Network Activity</h3>
                {isRunning && <PulseDot color="var(--color-live)" label="LIVE" />}
                {!isRunning && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', border: '1px solid var(--border-default)', padding: '2px 6px', borderRadius: 4 }}>STOPPED</span>}
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: (session?.running ? session.source_type : sourceType) === 'live' ? 'var(--color-live)' : 'var(--primary)',
                  background: (session?.running ? session.source_type : sourceType) === 'live' ? 'var(--color-live-light)' : 'var(--primary-light)',
                  padding: '2px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4
                }}>
                  {(session?.running ? session.source_type : sourceType) === 'live' ? (
                    <><Radio size={10} /> Real Npcap Telemetry</>
                  ) : (
                    <><Activity size={10} /> Synthetic generator</>
                  )}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {(session?.running ? session.source_type : sourceType) === 'live' ? 'Real-time packet capture · rolling temporal windows' : 'Synthetic telemetry · rolling temporal windows'}
                </span>
                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-workspace)', padding: 2, borderRadius: 6 }}>
                  {[1, 5, 15].map(m => (
                    <button
                      key={m}
                      onClick={() => setChartTimeRange(m as 1|5|15)}
                      style={{
                        padding: '4px 8px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 4, cursor: 'pointer',
                        background: chartTimeRange === m ? 'var(--bg-card)' : 'transparent',
                        color: chartTimeRange === m ? 'var(--text-primary)' : 'var(--text-muted)',
                        boxShadow: chartTimeRange === m ? 'var(--shadow-sm)' : 'none'
                      }}
                    >
                      Last {m}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gLivePackets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gLiveFlows" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gLiveSusp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} hide />
                <Tooltip 
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-md)', background: 'var(--bg-card)' }}
                  labelStyle={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}
                  cursor={{ stroke: 'var(--border-default)', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area yAxisId="left" type="monotone" dataKey="packets" name="Packet Rate" stroke="#6366f1" strokeWidth={2} fill="url(#gLivePackets)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#6366f1' }} isAnimationActive={false} />
                <Area yAxisId="left" type="monotone" dataKey="flows" name="Flow Count" stroke="#10b981" strokeWidth={1.5} fill="url(#gLiveFlows)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981' }} isAnimationActive={false} />
                <Area yAxisId="right" type="stepAfter" dataKey="suspicious" name="Suspicious Events" stroke="#ef4444" strokeWidth={1.5} fill="url(#gLiveSusp)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#ef4444' }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
            
          </div>

          {/* Temporal State Panel */}
          <TemporalStatePanel
            state={currentTemporal}
            baseline={currentTemporal?.partial ? temporalHistory[temporalHistory.length - 1] ?? null : temporalHistory[temporalHistory.length - 2] ?? null}
            windowSeconds={windowSeconds}
          />
        </div>

        {/* ── Filters + Packet Table ── */}
        <div data-tour="live-packets" style={{ flexShrink: 0, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: showPackets ? '1px solid var(--border-subtle)' : 'none', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowPackets(v => !v)}
                aria-expanded={showPackets}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                {showPackets ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Raw Packet Stream</h3>
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {filteredEvents.length} / {displayEvents.length}
              </span>
              {isRunning && <PulseDot color="var(--color-live)" label="LIVE" />}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={clearEvents} style={btnStyle('ghost-sm')}>
                <Trash2 size={12} /> Clear
              </button>
            </div>
          </div>

          {showPackets && <>
          {/* Filter Row */}
          <div style={{ display: 'flex', gap: 10, padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center', background: 'var(--bg-workspace)' }}>
            <Filter size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Apply a display filter (e.g. 192.168.1.1, tcp, .exe)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border-default)', borderRadius: 6, outline: 'none', fontFamily: 'var(--font-mono)' }}
            />
          </div>

          {/* Packet Table */}
          <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
            {filteredEvents.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {isRunning ? (
                  <>
                    <Clock size={15} color="var(--primary)" />
                    <span>Waiting for events…</span>
                  </>
                ) : (
                  <>
                    <Play size={15} color="var(--color-live)" />
                    <span>Start a live demo session to see packet events.</span>
                  </>
                )}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr style={{ background: 'var(--bg-workspace)' }}>
                    {['Timestamp', 'Protocol', 'Source IP', 'Dest IP', 'Size', 'Info', 'Class'].map(col => (
                      <th key={col} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.3px', textTransform: 'uppercase', fontSize: 10, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-default)' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((ev, i) => (
                    <PacketRow key={ev.id ?? i} event={ev} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
          </>}
        </div>

      </div>

      {inspected && (
        <ActivityInspector
          activity={inspected}
          allActivities={grouped}
          live
          sourceNote="Traffic comes from the live demo generator (synthetic packets)."
          onSelect={a => setInspectId(a.id)}
          onInvestigate={ip => navigate(`/investigation?ip=${encodeURIComponent(ip)}&source=entity`)}
          onClose={() => setInspectId(null)}
        />
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)',
  boxShadow: 'var(--shadow-sm)', overflow: 'hidden', minWidth: 0,
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({
  running,
  wsConnected,
  healthStatus,
  packetCount,
}: {
  running: boolean;
  wsConnected: boolean;
  healthStatus?: string;
  packetCount: number;
}) {
  if (!running) {
    return (
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 999, border: '1px solid var(--border-default)', color: 'var(--text-muted)', background: 'var(--bg-input)' }}>
        ● STOPPED
      </span>
    );
  }

  if (!wsConnected) {
    return <PulseDot color="var(--color-warning)" label="RECONNECTING" />;
  }

  if (healthStatus === 'STARTING') {
    return <PulseDot color="var(--primary)" label="STARTING" />;
  }

  if (healthStatus === 'NO_TRAFFIC' || packetCount === 0) {
    return <PulseDot color="var(--color-warning)" label="NO TRAFFIC" />;
  }

  if (healthStatus === 'DEGRADED') {
    return <PulseDot color="var(--color-warning)" label="DEGRADED" />;
  }

  if (healthStatus === 'FAILED') {
    return <PulseDot color="var(--color-critical)" label="FAILED" />;
  }

  return <PulseDot color="var(--color-live)" label="LIVE CAPTURING" />;
}

function PulseDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 999, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`, background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>
      <span className="live-dot" style={{ width: 6, height: 6, background: color }} />
      {label}
    </span>
  );
}

/** Current window vs the last closed window; values flash when they change and show ▲/▼ deltas. */
function TemporalStatePanel({ state, baseline, windowSeconds }: {
  state: TemporalState | null;
  baseline: TemporalState | null;
  windowSeconds: number;
}) {
  const progress = state?.partial ? Math.round((state.window_progress ?? 0) * 100) : 100;
  // Counts in a filling window are compared pro-rata, so a half-full window is not reported as a drop.
  const scale = state?.partial ? Math.max(0.05, state.window_progress ?? 1) : 1;
  const base = (k: keyof TemporalState) => (baseline ? Number(baseline[k]) * scale : undefined);
  const rateBase = (k: keyof TemporalState) => (baseline ? Number(baseline[k]) : undefined);
  return (
    <div data-tour="temporal-state" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Temporal State</h3>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--primary-light)', color: 'var(--primary)' }}>
          {windowSeconds}s window
        </span>
      </div>

      {!state ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', minHeight: 120 }}>
          Waiting for traffic — the first figures appear about a second after Start.
        </div>
      ) : (
        <>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>
              <span>{state.partial ? `Window filling · ${Math.round(progress * windowSeconds / 100)}/${windowSeconds}s` : 'Window closed'}</span>
              <span>{baseline ? 'Δ vs previous window' : 'first window'}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-input)', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.9s linear' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FeatureChip label="Packets" value={state.packet_count} prev={base('packet_count')} />
            <FeatureChip label="Bytes" value={state.byte_count} prev={base('byte_count')} format={v => `${(v / 1024).toFixed(1)} KB`} />
            <FeatureChip label="Benign" value={state.benign_count} prev={base('benign_count')} color="var(--color-live)" />
            <FeatureChip label="Suspicious" value={state.suspicious_count} prev={base('suspicious_count')} color="var(--color-critical)" riskUp />
            <FeatureChip label="Flows" value={state.flow_count} prev={base('flow_count')} />
            <FeatureChip label="Src IPs" value={state.unique_src_ips} prev={rateBase('unique_src_ips')} />
            <FeatureChip label="Dst IPs" value={state.unique_dst_ips} prev={rateBase('unique_dst_ips')} riskUp />
            <FeatureChip label="Dst Ports" value={state.unique_dst_ports} prev={rateBase('unique_dst_ports')} riskUp />
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Derived Features</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <FeatureRow label="Conn Rate" value={`${state.connection_rate.toFixed(2)} pkt/s`} delta={deltaText(state.connection_rate, rateBase('connection_rate'), 2)} />
              <FeatureRow label="Mean Size" value={`${state.mean_packet_size.toFixed(0)} B`} delta={deltaText(state.mean_packet_size, rateBase('mean_packet_size'), 0)} />
              <FeatureRow label="Susp Ratio" value={`${(state.suspicious_ratio * 100).toFixed(1)}%`} color={state.suspicious_ratio > 0.3 ? 'var(--color-critical)' : undefined}
                delta={deltaText(state.suspicious_ratio * 100, baseline ? baseline.suspicious_ratio * 100 : undefined, 1, 'pt')} />
              <FeatureRow label="TCP" value={state.tcp_count.toString()} />
              <FeatureRow label="UDP / DNS" value={`${state.udp_count} / ${state.dns_count}`} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function deltaText(v: number, prev: number | undefined, digits: number, unit = ''): string | undefined {
  if (prev === undefined) return undefined;
  const d = v - prev;
  if (Math.abs(d) < Math.pow(10, -digits)) return '±0';
  return `${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(digits)}${unit}`;
}

function PacketRow({ event }: { event: import('@/types/live').PacketEvent & { id?: string } }) {
  const navigate = useNavigate();
  const [hov, setHov] = useState(false);
  const isSusp = event.classification === 'suspicious';
  return (
    <tr
      style={{ borderBottom: '1px solid var(--border-subtle)', background: hov ? 'var(--bg-workspace)' : isSusp ? 'rgba(239,68,68,0.02)' : 'transparent', transition: 'background 0.1s', cursor: 'pointer' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => navigate(`/investigation?ip=${event.src_ip}`)}
    >
      <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}
      </td>
      <td style={{ padding: '6px 12px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: protocolColor(event.protocol) }}>
          {event.protocol}
        </span>
      </td>
      <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{event.src_ip} <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>:{event.src_port}</span></td>
      <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{event.dst_ip} <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>:{event.dst_port}</span></td>
      <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{event.packet_size}B</td>
      <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: 11, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={event.payload_info}>
        {event.payload_info || '-'}
      </td>
      <td style={{ padding: '6px 12px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
          background: isSusp ? 'var(--color-critical-light)' : 'var(--color-live-light)',
          color: isSusp ? 'var(--color-critical)' : 'var(--color-live)',
        }}>
          {isSusp ? <ShieldAlert size={10} /> : <CheckCircle2 size={10} />}
          {isSusp ? 'suspicious' : 'benign'}
        </span>
      </td>
    </tr>
  );
}






/** A figure that flashes when it changes; ▲/▼ compares with the previous window (red when a rise means more risk). */
function FeatureChip({ label, value, prev, color, format, riskUp }: {
  label: string; value: number; prev?: number; color?: string; format?: (v: number) => string; riskUp?: boolean;
}) {
  const diff = prev === undefined ? 0 : value - prev;
  const pct = prev ? Math.round((diff / prev) * 100) : 0;
  const significant = prev !== undefined && Math.abs(pct) >= 10;
  const deltaColor = !significant ? 'var(--text-muted)' : (diff > 0) === Boolean(riskUp) ? 'var(--color-critical)' : 'var(--color-live)';
  return (
    <div key={value} className={riskUp && diff > 0 && significant ? 'value-up' : undefined}
      style={{ background: 'var(--bg-workspace)', borderRadius: 8, padding: '6px 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</span>
        {prev !== undefined && (
          <span title="Change vs previous window (pro-rata while the window fills)" style={{ fontSize: 9, fontWeight: 700, color: deltaColor }}>
            {diff === 0 || pct === 0 ? '±0' : `${diff > 0 ? '▲' : '▼'}${Math.abs(pct)}%`}
          </span>
        )}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: color ?? 'var(--text-primary)', letterSpacing: '-0.5px' }}>{format ? format(value) : value.toLocaleString()}</div>
    </div>
  );
}

function FeatureRow({ label, value, color, delta }: { label: string; value: string; color?: string; delta?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
        {delta && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{delta}</span>}
        <span style={{ fontSize: 12, fontWeight: 700, color: color ?? 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</span>
      </span>
    </div>
  );
}

function StatChip({ label, value, color, mono }: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: color ?? 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)' }}>{value}</div>
    </div>
  );
}

function Spinner() {
  return <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />;
}

// ─── Style helpers ─────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 };

function btnStyle(variant: string): React.CSSProperties {
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all var(--transition-fast)', fontFamily: 'var(--font-sans)' };
  if (variant === 'live') return { ...base, background: 'var(--color-live)', color: 'white', borderColor: 'transparent' };
  if (variant === 'critical') return { ...base, background: 'var(--color-critical)', color: 'white', borderColor: 'transparent' };
  if (variant === 'primary') return { ...base, background: 'var(--primary)', color: 'white', borderColor: 'transparent' };
  if (variant === 'secondary-sm') return { ...base, padding: '5px 12px', fontSize: 12, background: 'var(--primary-light)', color: 'var(--primary)', borderColor: 'var(--primary)' };
  if (variant === 'ghost-sm') return { ...base, padding: '5px 12px', fontSize: 12, background: 'var(--bg-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' };
  return base;
}

function protocolColor(proto: string): string {
  return { TCP: '#6366f1', UDP: '#06b6d4', ICMP: '#f59e0b', DNS: '#10b981', HTTP: '#8b5cf6' }[proto] ?? 'var(--text-secondary)';
}
