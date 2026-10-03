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
  interface?: string;
  classification: 'benign' | 'suspicious';
  payload_info?: string;
}

export interface TemporalState {
  window_start: number | string;
  window_end: number | string;
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
  packet_rate?: number;
  byte_rate?: number;
  suspicious_ratio: number;
  suspicion_score?: number;
  /** True while the window is still filling (pushed every second); false for the closed window. */
  partial?: boolean;
  /** 0–1 share of the window elapsed. */
  window_progress?: number;
  source_type?: 'synthetic' | 'live';
}

export interface TrafficSourceMetrics {
  source_type: string;
  job_id: string;
  is_active: boolean;
  health_status: 'STARTING' | 'RUNNING' | 'NO_TRAFFIC' | 'DEGRADED' | 'FAILED' | 'STOPPING' | 'STOPPED';
  status_message: string;
  start_time: number | null;
  packets_captured: number;
  bytes_captured: number;
  capture_drops: number;
  packets_parsed: number;
  parser_errors: number;
  packets_processed: number;
  queue_drops: number;
  queue_depth: number;
  flows_created: number;
  windows_completed: number;
  forecasts_generated: number;
  capture_pps: number;
  processing_pps: number;
  capture_mbps: number;
  processing_lag_ms: number;
  errors: number;
  last_error?: string | null;
  // Legacy aliases
  packets_seen?: number;
  bytes_seen?: number;
  packets_dropped?: number;
}

export interface CaptureInterface {
  index: number;
  id: string;
  name: string;
  description?: string;
  type: string;
  is_loopback: boolean;
  is_active_up?: boolean;
  is_recommended: boolean;
  status: string;
}

export interface CaptureSelfTestResult {
  healthy: boolean;
  interface_id: string;
  interface_name: string;
  packets: number;
  bytes: number;
  duration_seconds: number;
  packets_per_second: number;
  mbps: number;
  capture_drops: number;
  stderr: string;
  error: string | null;
}

export interface SessionStatus {
  session_id: string;
  running: boolean;
  source_type?: 'synthetic' | 'live';
  interface?: string;
  interface_name?: string;
  mode: 'benign' | 'suspicious';
  health_status?: 'STARTING' | 'RUNNING' | 'NO_TRAFFIC' | 'DEGRADED' | 'FAILED' | 'STOPPING' | 'STOPPED';
  status_message?: string;
  start_time: string | null;
  packet_count: number;
  bytes_captured?: number;
  benign_count: number;
  suspicious_count: number;
  window_seconds: number;
  active_entities: string[];
  metrics?: TrafficSourceMetrics | null;
}

export interface WSMessage {
  type: 'packet_event' | 'temporal_state' | 'session_status' | 'forecast_update' | 'new_alert' | 'ping' | 'self_test_result';
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
  id: string;
  from: string;
  to: string;
  source?: string;
  target?: string;
  label?: string;
  protocol?: string;
  packetCount?: number;
  packets?: number;
  bytes?: number;
  suspicious?: boolean;
  isSuspicious?: boolean;
  lastSeen?: string;
}

export type DemoMode = 'benign' | 'suspicious';
export type WindowSecs = 5 | 10 | 15 | 30 | 60;
