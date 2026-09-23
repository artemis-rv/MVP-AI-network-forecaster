// NEXTRACE AI — Live Session Zustand Store
// Manages all live-monitoring state: connection, events, temporal data, entities, filters.

import { create } from 'zustand';
import type { PacketEvent, TemporalState, SessionStatus, LiveNode, LiveEdge, DemoMode, WindowSecs } from '@/types/live';
import { useForecastStore } from '@/store/forecastStore';

const MAX_EVENTS  = 200;   // max events kept in the all-events buffer
const MAX_TEMPORAL = 60;   // max temporal states kept in history

// ─── IP classification helpers ────────────────────────────────────────────────
function classifyIp(ip: string): LiveNode['type'] {
  if (ip.startsWith('10.0.0.')) return 'suspicious';
  if (ip === '8.8.8.8' || ip === '1.1.1.1' || ip.startsWith('203.0.113') || ip.startsWith('198.51.100')) return 'external';
  const last = parseInt(ip.split('.')[3] ?? '0');
  if (last >= 100) return 'server';
  return 'internal';
}

function ipToPosition(ip: string): { x: number; y: number } {
  const parts = ip.split('.').map(Number);
  const hash = (parts[2] * 256 + parts[3]) % 100;
  const type = classifyIp(ip);
  // Zones by type: suspicious=far left, internal=center-left, server=center-right, external=far right
  const zones: Record<LiveNode['type'], number> = { suspicious: 90, internal: 250, server: 470, external: 650 };
  const x = zones[type];
  const y = 70 + (hash % 5) * 55;
  return { x, y };
}

function ipToLabel(ip: string): string {
  const type = classifyIp(ip);
  return { suspicious: 'Suspicious', internal: 'Workstation', server: 'Server', external: 'External' }[type];
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
  currentTemporal: TemporalState | null;

  // Network entities (derived from events)
  liveNodes: LiveNode[];
  liveEdges: LiveEdge[];

  // Filters
  filterProtocol: string;
  filterSrcIp: string;
  filterDstIp: string;
  filterClassification: string;

  // Session config (UI-controlled, sent on start)
  windowSeconds: WindowSecs;
  mode: DemoMode;

  // Actions
  setWsConnected: (v: boolean) => void;
  setBackendAvailable: (v: boolean) => void;
  addEvent: (event: PacketEvent) => void;
  setTemporal: (t: TemporalState) => void;
  setSession: (s: SessionStatus | null) => void;
  setPaused: (p: boolean) => void;
  clearEvents: () => void;
  resetEntities: () => void;
  setFilterProtocol: (f: string) => void;
  setFilterSrcIp: (f: string) => void;
  setFilterDstIp: (f: string) => void;
  setFilterClassification: (f: string) => void;
  setWindowSeconds: (w: WindowSecs) => void;
  setMode: (m: DemoMode) => void;
  updateEntities: (event: PacketEvent) => void;
}

// ─── Store implementation ─────────────────────────────────────────────────────
export const useLiveStore = create<LiveStore>((set) => ({
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

  filterProtocol: 'All',
  filterSrcIp: 'All',
  filterDstIp: 'All',
  filterClassification: 'All',

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
    set({ allEvents: [], displayEvents: [], liveNodes: [], liveEdges: [], temporalHistory: [], currentTemporal: null });
    // Also reset forecast state so sessions don't contaminate each other
    useForecastStore.getState().clearForecast();
  },

  resetEntities: () => set({ liveNodes: [], liveEdges: [] }),

  addEvent: (event) => {
    const id = `${event.timestamp}-${Math.random().toString(36).slice(2, 7)}`;
    const tagged = { ...event, id };

    set((state) => {
      // Rolling all-events buffer
      const allEvents = [tagged, ...state.allEvents].slice(0, MAX_EVENTS);
      // Only update display when not paused
      const displayEvents = state.isPaused
        ? state.displayEvents
        : [tagged, ...state.displayEvents].slice(0, MAX_EVENTS);
      return { allEvents, displayEvents };
    });
  },

  setTemporal: (t) => {
    set((state) => ({
      currentTemporal: t,
      temporalHistory: [...state.temporalHistory, t].slice(-MAX_TEMPORAL),
    }));
  },

  updateEntities: (event: PacketEvent) => {
    set((state) => {
      const nodesMap = new Map(state.liveNodes.map((n) => [n.id, n]));

      const ensureNode = (ip: string) => {
        if (!nodesMap.has(ip)) {
          const pos = ipToPosition(ip);
          nodesMap.set(ip, {
            id: ip,
            ip,
            label: ipToLabel(ip),
            type: classifyIp(ip),
            x: pos.x,
            y: pos.y,
          });
        }
      };

      ensureNode(event.src_ip);
      ensureNode(event.dst_ip);

      const liveNodes = Array.from(nodesMap.values());

      // Edges (dedup by from+to)
      const edgesMap = new Map(state.liveEdges.map((e) => [`${e.from}->${e.to}`, e]));
      const key = `${event.src_ip}->${event.dst_ip}`;
      edgesMap.set(key, {
        from: event.src_ip,
        to: event.dst_ip,
        label: event.protocol,
        suspicious: event.classification === 'suspicious',
      });

      const liveEdges = Array.from(edgesMap.values()).slice(-50); // cap edge count

      return { liveNodes, liveEdges };
    });
  },

  setFilterProtocol: (f) => set({ filterProtocol: f }),
  setFilterSrcIp: (f) => set({ filterSrcIp: f }),
  setFilterDstIp: (f) => set({ filterDstIp: f }),
  setFilterClassification: (f) => set({ filterClassification: f }),
  setWindowSeconds: (w) => set({ windowSeconds: w }),
  setMode: (m) => set({ mode: m }),
}));
