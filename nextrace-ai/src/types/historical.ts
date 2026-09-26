// NEXTRACE AI — Historical Analysis Types
// Completely isolated from live, forecast, and investigation types.

/** Processing status for a historical job */
export type HistoricalJobStatus =
  | 'idle'
  | 'queued'
  | 'parsing'
  | 'building_flows'
  | 'feature_engineering'
  | 'detection'
  | 'timeline'
  | 'processing'
  | 'completed'
  | 'failed';

/** Metadata returned by the upload / demo endpoints */
export interface HistoricalJobMeta {
  job_id: string;
  filename: string;
  file_size: number;
  status: HistoricalJobStatus;
  is_demo?: boolean;
  demo_label?: string;
}

/** Status polling response */
export interface HistoricalJobStatusResponse {
  job_id: string;
  filename: string;
  is_demo: boolean;
  status: HistoricalJobStatus;
  progress: number;          // 0–100
  packets_processed: number;
  flows_detected: number;
  current_stage: string;
  error: string | null;
  created_at: number;        // Unix timestamp
  completed_at: number | null;
}

/** Protocol breakdown entry */
export interface ProtocolEntry {
  protocol: string;
  count: number;
}

/** IP address frequency entry */
export interface IpEntry {
  ip: string;
  count: number;
}

/** Port frequency entry */
export interface PortEntry {
  port: number;
  count: number;
}

/** Temporal feature window */
export interface TemporalWindow {
  window_index: number;
  window_start: number;   // Unix timestamp
  window_end: number;
  packet_count: number;
  byte_count: number;
  flow_count: number;
  unique_src_ips: number;
  unique_dst_ips: number;
  unique_dst_ports: number;
  tcp_count: number;
  udp_count: number;
  icmp_count: number;
  mean_packet_size: number;
  connection_rate: number;
  suspicious_ratio: number;
}

/** A single suspicious event detected by heuristics */
export interface SuspiciousEvent {
  event_id: string;
  type: string;
  timestamp: number;
  src_ip: string;
  dst_ip: string;
  port: number;
  protocol: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  demo_label: string;
}

/** Activity/stage timeline entry */
export interface ActivityTimelineEntry {
  event_id?: string;
  entry_type: 'suspicious' | 'normal';
  timestamp: number;
  stage: string;
  label: string;
  description: string;
  severity: string;
  src_ip: string;
  dst_ip: string;
  protocol: string;
  demo_label: string;
}

/** Entity relationship for network graph */
export interface EntityRelationship {
  src_ip: string;
  dst_ip: string;
  packet_count: number;
  byte_count: number;
  protocols: string[];
  ports: number[];
  first_seen: number | null;
  last_seen: number | null;
  is_suspicious: boolean;
}

/** Full historical analysis result */
export interface HistoricalResult {
  is_demo?: boolean;
  demo_label?: string;
  packet_count: number;
  flow_count: number;
  duration_seconds: number;
  start_timestamp: number;
  end_timestamp: number;
  window_seconds: number;
  protocol_distribution: ProtocolEntry[];
  top_src_ips: IpEntry[];
  top_dst_ips: IpEntry[];
  top_dst_ports: PortEntry[];
  temporal_windows: TemporalWindow[];
  suspicious_events: SuspiciousEvent[];
  activity_timeline: ActivityTimelineEntry[];
  entity_relationships: EntityRelationship[];
}

/** Complete job result envelope */
export interface HistoricalJobResult {
  job_id: string;
  filename: string;
  is_demo: boolean;
  status: HistoricalJobStatus;
  result: HistoricalResult;
}
