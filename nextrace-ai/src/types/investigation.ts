// NEXTRACE AI — Investigation Types
// Step 4: Investigation + Attack Path

export type InvestigationStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
export type InvestigationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type InvestigationSource = 'alert' | 'entity' | 'forecast' | 'direct';
export type TimelineEntryType = 'observed' | 'predicted' | 'info';

export interface InvestigationContext {
  ip: string;
  entityType: string;       // 'Workstation' | 'Server' | 'Suspicious Host' | 'Database' | 'External'
  sourceType: InvestigationSource;
  alertId?: string;
  alertEvent?: string;
  severity?: string;
}

export interface TimelineEntry {
  id: string;
  timestamp: string;        // HH:MM:SS
  event: string;
  type: TimelineEntryType;
  stage?: string;
}

export interface FindingObservation {
  text: string;
  supported: boolean;
}

export interface Finding {
  id: string;
  generatedAt: string;
  summary: string;
  confidence: 'Demo / High' | 'Demo / Medium' | 'Demo / Low';
  observations: FindingObservation[];
  predictedNext: string;
  currentStage: string;
  isDemoFinding: true;
}

export interface Investigation {
  id: string;
  status: InvestigationStatus;
  priority: InvestigationPriority;
  selectedEntityIp: string;
  entityType: string;
  openedAt: string;          // ISO timestamp string
  findings: Finding[];
  sourceType: InvestigationSource;
}

// ─── Attack Path Graph types ──────────────────────────────────────────────────
export type AttackNodeType = 'workstation' | 'suspicious' | 'server' | 'database' | 'external';

export interface AttackNodeData {
  ip: string;
  role: string;
  nodeType: AttackNodeType;
  riskScore: number;
  connections: number;
  isSelected: boolean;
  isFocused: boolean;
}

export interface AttackEdgeData {
  protocol: string;
  connectionCount: number;
  isSuspicious: boolean;
  direction: 'inbound' | 'outbound' | 'lateral';
}
