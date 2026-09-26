import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Square, WifiOff, RotateCcw, Trash2, X,
  Filter, RefreshCw, AlertTriangle, ShieldAlert, CheckCircle2, ShieldCheck, Clock, Activity,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { useLiveStore } from '@/store/liveStore';
import { useAppStore } from '@/store/appStore';
import { apiService } from '@/services/api';
import { wsService } from '@/services/websocket';
import type { DemoMode, WindowSecs } from '@/types/live';


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
  const { addToast } = useAppStore();
  const {
    wsConnected, session, backendAvailable, setBackendAvailable,
    displayEvents, clearEvents,
    currentTemporal, temporalHistory,
    searchQuery, setSearchQuery,
    windowSeconds, mode, setWindowSeconds, setMode,
  } = useLiveStore();

  const isRunning = session?.running ?? false;
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  const [chartTimeRange, setChartTimeRange] = useState<1 | 5 | 15>(1);

  const realChartData = useMemo(() => {
    return temporalHistory.map(t => {
      let dateObj = new Date();
      if (t.window_end) {
        const d = new Date(t.window_end);
        if (!isNaN(d.getTime())) {
          dateObj = d;
        } else if (typeof t.window_end === 'number') {
          dateObj = new Date(t.window_end < 1e11 ? t.window_end * 1000 : t.window_end);
        } else {
          const num = Number(t.window_end);
          if (!isNaN(num)) {
            dateObj = new Date(num < 1e11 ? num * 1000 : num);
          }
        }
      }
      return {
        timestamp: dateObj.getTime(),
        time: dateObj.toLocaleTimeString('en-US', { hour12: false }),
        packets: t.packet_count,
        flows: t.flow_count || Math.floor(t.packet_count / 10) || 0,
        suspicious: t.suspicious_count,
      };
    });
  }, [temporalHistory]);

  const chartData = isRunning && realChartData.length > 0 
    ? realChartData 
    : generateZeroChartData(chartTimeRange);

  // Check backend health and sync running session status on mount / route switch
  useEffect(() => {
    apiService.checkHealth()
      .then(async () => {
        setBackendAvailable(true);
        try {
          const status = await apiService.getLiveStatus();
          useLiveStore.getState().setSession(status);
          if (status.running && !wsConnected) {
            wsService.connect();
          }
        } catch (e) {
          console.error('Failed to sync live status:', e);
        }
      })
      .catch(() => setBackendAvailable(false));
  }, [setBackendAvailable, wsConnected]);

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
      const res = await apiService.startLive({ mode, window_seconds: windowSeconds });
      useLiveStore.getState().setSession(res.status);
      wsService.connect();
      addToast('Live demo started — streaming events.', 'success');
    } catch {
      addToast('Unable to connect to live demo backend. Is it running on port 8000?', 'error');
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
      addToast('Live demo stopped.', 'info');
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              Live Monitoring
            </h1>
            <StatusBadge running={isRunning} wsConnected={wsConnected} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Real-time demo traffic stream · Temporal aggregation · Feature engineering
          </p>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--color-warning-light)', border: '1px solid var(--color-warning)', borderRadius: 8, padding: '6px 12px' }}>
          <AlertTriangle size={12} /> SIMULATED DEMO TRAFFIC — not real network telemetry
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

        {/* ── Control Panel ── */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)', padding: '18px 20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end' }}>

            {/* Traffic Mode */}
            <div>
              <div style={labelStyle}>Traffic Mode</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['benign', 'suspicious'] as DemoMode[]).map(m => (
                  <button
                    key={m}
                    disabled={isRunning}
                    onClick={() => setMode(m)}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: '1px solid',
                      fontSize: 13, fontWeight: 600, cursor: isRunning ? 'not-allowed' : 'pointer',
                      borderColor: mode === m ? (m === 'suspicious' ? 'var(--color-critical)' : 'var(--color-live)') : 'var(--border-default)',
                      background: mode === m ? (m === 'suspicious' ? 'var(--color-critical-light)' : 'var(--color-live-light)') : 'var(--bg-card)',
                      color: mode === m ? (m === 'suspicious' ? 'var(--color-critical)' : 'var(--color-live)') : 'var(--text-secondary)',
                      opacity: isRunning ? 0.6 : 1,
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {m === 'suspicious' ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
                      {m === 'suspicious' ? 'Suspicious Demo' : 'Benign Traffic'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

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
            <div style={{ display: 'flex', gap: 8 }}>
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
                    : <><Play size={14} /> Start Live Demo</>
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

          {/* Session stats */}
          {session && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <StatChip label="Session ID" value={session.session_id} mono />
              <StatChip label="Packets" value={session.packet_count.toLocaleString()} />
              <StatChip label="Benign" value={session.benign_count.toLocaleString()} color="var(--color-live)" />
              <StatChip label="Suspicious" value={session.suspicious_count.toLocaleString()} color="var(--color-critical)" />
              <StatChip label="Entities" value={session.active_entities.length.toString()} />
              <StatChip label="Window" value={`${session.window_seconds}s`} />
            </div>
          )}
        </div>

        {/* ── Filters + Packet Table ── */}
        <div style={{ flexShrink: 0, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Live Packet Events</h3>
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
        </div>

        {/* ── Two-column: Chart + Temporal State ── */}
        <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          {/* Live Chart */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Live Network Activity</h3>
                {isRunning && <PulseDot color="var(--color-live)" label="LIVE" />}
                {!isRunning && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', border: '1px solid var(--border-default)', padding: '2px 6px', borderRadius: 4 }}>STOPPED</span>}
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Activity size={10} /> Synthetic data
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Synthetic telemetry · rolling temporal windows</span>
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
          <TemporalStatePanel state={currentTemporal} windowSeconds={windowSeconds} />
        </div>

      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ running, wsConnected }: { running: boolean; wsConnected: boolean }) {
  if (running && wsConnected)
    return <PulseDot color="var(--color-live)" label="LIVE" />;
  if (running && !wsConnected)
    return <PulseDot color="var(--color-warning)" label="RECONNECTING" />;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 999, border: '1px solid var(--border-default)', color: 'var(--text-muted)', background: 'var(--bg-input)' }}>
      ● STOPPED
    </span>
  );
}

function PulseDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 999, border: `1px solid ${color}30`, background: `${color}10`, color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
      {label}
    </span>
  );
}

function TemporalStatePanel({ state, windowSeconds }: { state: import('@/types/live').TemporalState | null; windowSeconds: number }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Temporal State</h3>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--primary-light)', color: 'var(--primary)' }}>
          {windowSeconds}s window
        </span>
      </div>

      {!state ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', minHeight: 120 }}>
          Waiting for first temporal window…
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FeatureChip label="Packets" value={state.packet_count.toString()} />
            <FeatureChip label="Bytes" value={`${(state.byte_count / 1024).toFixed(1)} KB`} />
            <FeatureChip label="Benign" value={state.benign_count.toString()} color="var(--color-live)" />
            <FeatureChip label="Suspicious" value={state.suspicious_count.toString()} color="var(--color-critical)" />
            <FeatureChip label="Flows" value={state.flow_count.toString()} />
            <FeatureChip label="Src IPs" value={state.unique_src_ips.toString()} />
            <FeatureChip label="Dst IPs" value={state.unique_dst_ips.toString()} />
            <FeatureChip label="Dst Ports" value={state.unique_dst_ports.toString()} />
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Derived Features</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <FeatureRow label="Conn Rate" value={`${state.connection_rate.toFixed(2)} pkt/s`} />
              <FeatureRow label="Mean Size" value={`${state.mean_packet_size.toFixed(0)} B`} />
              <FeatureRow label="Susp Ratio" value={`${(state.suspicious_ratio * 100).toFixed(1)}%`} color={state.suspicious_ratio > 0.3 ? 'var(--color-critical)' : undefined} />
              <FeatureRow label="TCP" value={state.tcp_count.toString()} />
              <FeatureRow label="UDP / DNS" value={`${state.udp_count} / ${state.dns_count}`} />
            </div>
          </div>
        </>
      )}
    </div>
  );
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






function FeatureChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-workspace)', borderRadius: 8, padding: '6px 10px' }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: color ?? 'var(--text-primary)', letterSpacing: '-0.5px' }}>{value}</div>
    </div>
  );
}

function FeatureRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: color ?? 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</span>
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
