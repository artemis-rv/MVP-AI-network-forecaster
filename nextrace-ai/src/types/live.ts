// NEXTRACE AI — Shared TypeScript types for live session data
// These must stay in sync with backend/models/schemas.py

export interface PacketEvent {
  id?: string;          // assigned on frontend
  timestamp: string;
  protocol: string;
  src_ip: string;
  dst_ip: string;
  src_port: number;
  dst_port: number;
  packet_size: number;
  direction: string;
  classification: 'benign' | 'suspicious';
}

export interface TemporalState {
  window_start: number;
  window_end: number;
  window_seconds: number;
  packet_count: number;
  byte_count: number;
  flow_count: number;
  benign_count: number;
  suspicious_count: number;
  unique_src_ips: number;
  unique_dst_ips: number;
  unique_dst_ports: number;
  tcp_count: number;
  udp_count: number;
  icmp_count: number;
  dns_count: number;
  http_count: number;
  mean_packet_size: number;
  connection_rate: number;
  suspicious_ratio: number;
}

export interface SessionStatus {
  session_id: string;
  running: boolean;
  mode: 'benign' | 'suspicious';
  start_time: string | null;
  packet_count: number;
  benign_count: number;
  suspicious_count: number;
  window_seconds: number;
  active_entities: string[];
}

export interface WSMessage {
  type: 'packet_event' | 'temporal_state' | 'session_status' | 'forecast_update' | 'ping';
  data: Record<string, unknown>;
}

export interface LiveNode {
  id: string;
  ip: string;
  label: string;
  type: 'internal' | 'suspicious' | 'server' | 'external';
  x: number;
  y: number;
}

export interface LiveEdge {
  from: string;
  to: string;
  label: string;
  suspicious: boolean;
}

export type DemoMode    = 'benign' | 'suspicious';
export type WindowSecs  = 5 | 10 | 15 | 30 | 60;
