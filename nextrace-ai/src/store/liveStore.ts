// NEXTRACE AI — Live Session Zustand Store
// Manages all live-monitoring state: connection, events, temporal data, entities, filters.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PacketEvent, TemporalState, SessionStatus, LiveNode, LiveEdge, DemoMode, WindowSecs } from '@/types/live';
import { useForecastStore } from '@/store/forecastStore';
import { ingest, fromPacket, GROUPING, type GroupedActivity } from '@/lib/activityGrouping';
import { raiseActivityAlerts, syncActivityAlerts, resetActivityAlertSync } from '@/services/activityAlerts';

const MAX_EVENTS  = 200;   // max events kept in the all-events buffer
const MAX_TEMPORAL = 60;   // max temporal states kept in history

// sessionStorage writes serialise the whole store; during a live run the store changes ~10×/s, so writes
// are coalesced to at most one per second (and flushed when the page is hidden) to keep the UI responsive.
const PERSIST_DEBOUNCE_MS = 1000;
const pendingWrites = new Map<string, string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushPersist(): void {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  for (const [k, v] of pendingWrites) {
    try { sessionStorage.setItem(k, v); } catch { /* quota / private mode — state stays in memory */ }
  }
  pendingWrites.clear();
}

const debouncedSessionStorage = {
  getItem: (k: string) => {
    try { return pendingWrites.get(k) ?? sessionStorage.getItem(k); } catch { return null; }
  },
  setItem: (k: string, v: string) => {
    pendingWrites.set(k, v);
    if (!flushTimer) flushTimer = setTimeout(flushPersist, PERSIST_DEBOUNCE_MS);
  },
  removeItem: (k: string) => {
    pendingWrites.delete(k);
    try { sessionStorage.removeItem(k); } catch { /* ignore */ }
  },
};

if (typeof window !== 'undefined') window.addEventListener('pagehide', flushPersist);

// ─── IP role helpers ──────────────────────────────────────────────────────────
// Role only (workstation / server / external). Whether a node is *suspicious* is decided by
// observed behaviour — being the source of a significant grouped activity — never by its address.
function classifyIp(ip: string): Exclude<LiveNode['type'], 'suspicious'> {
  if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) return 'external';
  const last = parseInt(ip.split('.')[3] ?? '0');
  if (last >= 100) return 'server';
  return 'internal';
}

function ipToLabel(ip: string): string {
  return { internal: 'Workstation', server: 'Server', external: 'External' }[classifyIp(ip)];
}

/** Statistical summary of all traffic in the session (normal traffic is summarised, not listed). */
export interface TrafficSummary {
  total: number;
  benign: number;
  suspicious: number;
  bytes: number;
  protocols: Record<string, number>;
  firstTs: number | null;
  lastTs: number | null;
}

const EMPTY_SUMMARY: TrafficSummary = { total: 0, benign: 0, suspicious: 0, bytes: 0, protocols: {}, firstTs: null, lastTs: null };

function runIdFor(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `LIVE-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// ─── Store interface ──────────────────────────────────────────────────────────
interface LiveStore {
  // Connection state
  wsConnected: boolean;
  backendAvailable: boolean;

  // Session
  session: SessionStatus | null;

  // Events (rolling buffers)
  allEvents: PacketEvent[];
  displayEvents: PacketEvent[];
  isPaused: boolean;

  // Temporal data
  temporalHistory: TemporalState[];
  /** Latest state — the filling window (partial) or the window that just closed. */
  currentTemporal: TemporalState | null;

  // Network entities (derived from events)
  liveNodes: LiveNode[];
  liveEdges: LiveEdge[];

  // Grouped activities — the single source of truth for alerts, timeline, risk entities and reports
  activities: GroupedActivity[];
  trafficSummary: TrafficSummary;
  runId: string | null;
  runStartedAt: number | null;

  // Search Filter
  searchQuery: string;

  // Session config (UI-controlled, sent on start)
  windowSeconds: WindowSecs;
  mode: DemoMode;

  // Actions
  setWsConnected: (v: boolean) => void;
  setBackendAvailable: (v: boolean) => void;
  addEvent: (event: PacketEvent) => void;
  addEventsBatched: (events: PacketEvent[]) => void;
  setTemporal: (t: TemporalState) => void;
  setSession: (s: SessionStatus | null) => void;
  setPaused: (p: boolean) => void;
  clearEvents: () => void;
  resetEntities: () => void;
  setSearchQuery: (q: string) => void;
  setWindowSeconds: (w: WindowSecs) => void;
  setMode: (m: DemoMode) => void;
  updateEntities: (event: PacketEvent) => void;
  beginRun: () => void;
  attachAlert: (activityId: string, alertId: string) => void;
}

// ─── Store implementation ─────────────────────────────────────────────────────
export const useLiveStore = create<LiveStore>()(
  persist(
    (set, get) => ({
      wsConnected: false,
      backendAvailable: false,
      session: null,

      allEvents: [],
      displayEvents: [],
      isPaused: false,

      temporalHistory: [],
      currentTemporal: null,

      liveNodes: [],
      liveEdges: [],

      activities: [],
      trafficSummary: EMPTY_SUMMARY,
      runId: null,
      runStartedAt: null,

      searchQuery: '',

      windowSeconds: 15,
      mode: 'benign',

      // ── Actions ──────────────────────────────────────────────────
      setWsConnected: (v) => set({ wsConnected: v }),
      setBackendAvailable: (v) => set({ backendAvailable: v }),
      setSession: (s) => set({ session: s }),
      setPaused: (p) => {
        set({ isPaused: p });
        // On resume: sync display buffer with latest all-events
        if (!p) set((state) => ({ displayEvents: [...state.allEvents] }));
      },

      clearEvents: () => {
        set({
          allEvents: [], displayEvents: [], liveNodes: [], liveEdges: [], temporalHistory: [], currentTemporal: null,
          activities: [], trafficSummary: EMPTY_SUMMARY,
        });
        resetActivityAlertSync();
        // Also reset forecast state so sessions don't contaminate each other
        useForecastStore.getState().clearForecast();
      },

      resetEntities: () => set({ liveNodes: [], liveEdges: [] }),

      addEvent: (event) => {
        get().addEventsBatched([event]);
      },

      beginRun: () => {
        get().clearEvents();
        const now = new Date();
        set({ runId: runIdFor(now), runStartedAt: now.getTime() });
      },

      attachAlert: (activityId, alertId) => {
        set((state) => ({
          activities: state.activities.map(a =>
            a.id === activityId && !a.alertIds.includes(alertId) ? { ...a, alertIds: [...a.alertIds, alertId] } : a,
          ),
        }));
      },

      addEventsBatched: (events) => {
        if (events.length === 0) return;

        // Packets → activity normalization → similarity grouping (suspicious traffic only)
        const suspicious = events.filter(e => e.classification === 'suspicious');
        const grouped = ingest(get().activities, suspicious.map(fromPacket), { gapMs: GROUPING.liveGapMs });
        const actorIps = new Set(grouped.activities.filter(a => a.significant).flatMap(a => a.sources));

        set((state) => {
          // Process events
          const taggedEvents = events.map(e => ({
            ...e,
            id: `${e.timestamp}-${Math.random().toString(36).slice(2, 7)}`
          }));

          // Rolling all-events buffer
          const allEvents = [...taggedEvents, ...state.allEvents].slice(0, MAX_EVENTS);
          // Only update display when not paused
          const displayEvents = state.isPaused
            ? state.displayEvents
            : [...taggedEvents, ...state.displayEvents].slice(0, MAX_EVENTS);

          // Update entities efficiently
          const nodesMap = new Map(state.liveNodes.map((n) => [n.id, n]));
          const edgesMap = new Map(state.liveEdges.map((e) => [`${e.from}->${e.to}`, e]));

          const ensureNode = (ip: string) => {
            if (!nodesMap.has(ip)) {
              const type = classifyIp(ip);
              if (type === 'external') return;
              
              const count = Array.from(nodesMap.values()).filter(n => classifyIp(n.ip) === type).length;
              const x = { internal: 350, server: 580 }[type];
              const y = 80 + (count * 70);
              
              nodesMap.set(ip, {
                id: ip, ip, label: ipToLabel(ip), type, x, y,
              });
            }
          };

          for (const ev of events) {
            ensureNode(ev.src_ip);
            ensureNode(ev.dst_ip);

            const key = `${ev.src_ip}->${ev.dst_ip}`;
            if (nodesMap.has(ev.src_ip) && nodesMap.has(ev.dst_ip)) {
              const existing = edgesMap.get(key);
              edgesMap.set(key, {
                id: key,
                from: ev.src_ip,
                to: ev.dst_ip,
                label: ev.protocol,
                suspicious: existing?.suspicious || ev.classification === 'suspicious',
                packetCount: (existing?.packetCount || 0) + 1,
                bytes: (existing?.bytes || 0) + (ev.packet_size || 0),
                lastSeen: ev.timestamp,
              });
            }
          }

          // Behaviour-derived risk marking: only hosts that originated a significant activity
          const liveNodes = Array.from(nodesMap.values()).map(n => {
            const type: LiveNode['type'] = actorIps.has(n.ip) ? 'suspicious' : classifyIp(n.ip);
            if (n.type === type) return n;
            return { ...n, type, label: type === 'suspicious' ? `${ipToLabel(n.ip)} (suspicious)` : ipToLabel(n.ip) };
          });
          const liveEdges = Array.from(edgesMap.values()).slice(-50);

          const summary = state.trafficSummary;
          const protocols = { ...summary.protocols };
          let bytes = summary.bytes;
          let firstTs = summary.firstTs;
          let lastTs = summary.lastTs;
          for (const ev of events) {
            protocols[ev.protocol] = (protocols[ev.protocol] ?? 0) + 1;
            bytes += ev.packet_size || 0;
            const ts = Date.parse(ev.timestamp);
            if (!Number.isNaN(ts)) {
              firstTs = firstTs === null ? ts : Math.min(firstTs, ts);
              lastTs = lastTs === null ? ts : Math.max(lastTs, ts);
            }
          }
          const trafficSummary: TrafficSummary = {
            total: summary.total + events.length,
            benign: summary.benign + (events.length - suspicious.length),
            suspicious: summary.suspicious + suspicious.length,
            bytes, protocols, firstTs, lastTs,
          };

          return { allEvents, displayEvents, liveNodes, liveEdges, activities: grouped.activities, trafficSummary };
        });

        // Grouped activity → alert (+ popup + notification); growth only updates the existing alert.
        // Only the tab that started this run (it owns runId) proposes alerts; other tabs receive the broadcast.
        const runId = get().runId;
        if (runId && grouped.triggers.length > 0) {
          raiseActivityAlerts(grouped.triggers, runId, (activityId, alertId) => get().attachAlert(activityId, alertId));
        }
        const recent = Date.now() - 2 * GROUPING.liveGapMs / 3;
        syncActivityAlerts(grouped.activities.filter(a => a.alertIds.length > 0 && a.lastSeen >= recent));
      },

      setTemporal: (t) => {
        if (t.partial) {
          // The filling window replaces the current view only; history holds closed windows.
          set({ currentTemporal: t });
          return;
        }
        set((state) => ({
          currentTemporal: t,
          temporalHistory: [...state.temporalHistory, t].slice(-MAX_TEMPORAL),
        }));
      },

      updateEntities: (event: PacketEvent) => {
        get().addEventsBatched([event]);
      },

      setSearchQuery: (q) => set({ searchQuery: q }),
      setWindowSeconds: (w) => set({ windowSeconds: w }),
      setMode: (m) => set({ mode: m }),
    }),
    {
      name: 'live-storage',
      storage: createJSONStorage(() => debouncedSessionStorage),
      // Connection flags describe this page instance only; persisting them made a reload skip reconnecting.
      // Raw packet buffers refill within a second of reconnecting, so they are not written to storage.
      partialize: ({ wsConnected: _ws, backendAvailable: _be, allEvents: _all, displayEvents: _disp, ...rest }) => rest,
    }
  )
);
