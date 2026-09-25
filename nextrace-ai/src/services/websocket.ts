// NEXTRACE AI — WebSocket Service
// Singleton that manages the /ws/live connection and dispatches messages to the Zustand store.

import type { WSMessage, PacketEvent, TemporalState, SessionStatus } from '@/types/live';
import type { ForecastResult } from '@/types/forecast';
import { useLiveStore } from '@/store/liveStore';
import { useForecastStore } from '@/store/forecastStore';

const WS_BASE = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8000';
const WS_URL  = `${WS_BASE}/ws/live`;

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECTS     = 5;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts   = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose    = false;

  private eventQueue: PacketEvent[] = [];
  private batchTimer: ReturnType<typeof setInterval> | null = null;

  connect(): void {
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    
    // Start batch processor
    if (!this.batchTimer) {
      this.batchTimer = setInterval(() => this._flushEventQueue(), 100);
    }
    
    this._openSocket();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this._clearReconnectTimer();
    
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    this._flushEventQueue(); // Flush any remaining
    
    if (this.ws) {
      this.ws.close(1000, 'User stopped session');
      this.ws = null;
    }
    useLiveStore.getState().setWsConnected(false);
  }

  private _flushEventQueue() {
    if (this.eventQueue.length === 0) return;
    
    const eventsToProcess = [...this.eventQueue];
    this.eventQueue = [];
    
    const store = useLiveStore.getState();
    // Use the batched add method to avoid N separate state updates
    store.addEventsBatched(eventsToProcess);
  }

  private _openSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        useLiveStore.getState().setWsConnected(true);
      };

      this.ws.onclose = () => {
        useLiveStore.getState().setWsConnected(false);
        if (!this.intentionalClose && this.reconnectAttempts < MAX_RECONNECTS) {
          this.reconnectAttempts++;
          this.reconnectTimer = setTimeout(() => this._openSocket(), RECONNECT_DELAY_MS);
        }
      };

      this.ws.onerror = () => {
        useLiveStore.getState().setWsConnected(false);
      };

      this.ws.onmessage = (ev: MessageEvent) => {
        this._handleMessage(ev.data as string);
      };
    } catch {
      useLiveStore.getState().setWsConnected(false);
    }
  }

  private _handleMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw) as WSMessage;
      const store = useLiveStore.getState();

      switch (msg.type) {
        case 'packet_event':
          // Queue events to avoid lagging UI
          this.eventQueue.push(msg.data as unknown as PacketEvent);
          break;
        case 'temporal_state':
          store.setTemporal(msg.data as unknown as TemporalState);
          break;
        case 'session_status':
          store.setSession(msg.data as unknown as SessionStatus);
          break;
        case 'forecast_update':
          useForecastStore.getState().setForecast(msg.data as unknown as ForecastResult);
          break;
        case 'ping':
          break;
      }
    } catch {
      // Malformed message — ignore
    }
  }

  private _clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const wsService = new WebSocketService();
