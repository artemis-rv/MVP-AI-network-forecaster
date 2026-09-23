export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED";

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  category: string;
  source_ip?: string;
  destination_ip?: string;
  protocol?: string;
  event_count: number;
  confidence: number;
  first_seen: string;
  last_seen: string;
  created_at: string;
  assigned_to?: string | null;
  acknowledged_at?: string | null;
  tags: string[];
  evidence: string[];
  simulation?: boolean;
}

export interface AlertStats {
  total: number;
  open: number;
  acknowledged: number;
  in_progress: number;
  resolved: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}
