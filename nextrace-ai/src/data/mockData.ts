// NEXTRACE AI — Mock Demo Data
// All data here is simulated for demonstration purposes.

export const MOCK_LABEL = 'Simulated demo data — not real network traffic';

export interface KpiHoverDetailItem {
  label: string;
  value: string | number;
  highlight?: 'critical' | 'warning' | 'live' | 'primary' | 'muted';
}

export interface KpiHoverDetails {
  title: string;
  items: KpiHoverDetailItem[];
}

// ─── KPI Stats ───────────────────────────────────────────────
export const kpiData = [
  {
    id: 'alerts',
    label: 'Total Alerts',
    value: 7,
    change: '+2',
    changeType: 'up' as const,
    comparison: 'unresolved threats',
    color: 'critical',
    sparkline: [3, 4, 3, 5, 4, 6, 7],
    hoverDetails: {
      title: 'Total Alerts',
      items: [
        { label: 'Total Alerts', value: 7 },
        { label: 'Unresolved', value: 6, highlight: 'warning' as const },
        { label: 'Critical', value: 2, highlight: 'critical' as const },
        { label: 'High', value: 3, highlight: 'warning' as const },
        { label: 'Latest', value: 'Suspicious lateral movement' },
      ],
    },
  },
  {
    id: 'entities',
    label: 'High-Risk Entities',
    value: 1,
    change: '+1',
    changeType: 'up' as const,
    comparison: 'requiring attention',
    color: 'warning',
    sparkline: [0, 0, 1, 1, 1, 1, 1],
    hoverDetails: {
      title: 'High-Risk Entities',
      items: [
        { label: 'High-Risk Entities', value: 1 },
        { label: 'Threats Detected', value: 1, highlight: 'critical' as const },
        { label: 'Active Targets', value: 1, highlight: 'warning' as const },
        { label: 'Top Entity IP', value: '10.0.0.5', highlight: 'primary' as const },
        { label: 'Status', value: 'Threat Detected' },
      ],
    },
  },
  {
    id: 'predictions',
    label: 'Active Attack Paths',
    value: 3,
    change: 'Active',
    changeType: 'neutral' as const,
    comparison: 'predicted progressions',
    color: 'primary',
    sparkline: [1, 2, 1, 3, 2, 3, 3],
    hoverDetails: {
      title: 'Active Attack Paths',
      items: [
        { label: 'Active Paths', value: 3 },
        { label: 'Current', value: 'Lateral Movement', highlight: 'warning' as const },
        { label: 'Next', value: 'Data Exfiltration', highlight: 'critical' as const },
        { label: 'Confidence', value: '68%', highlight: 'live' as const },
        { label: 'Target', value: '192.168.1.25' },
      ],
    },
  },
  {
    id: 'resolutions',
    label: 'Recent Resolutions',
    value: 45,
    change: '+12%',
    changeType: 'up' as const,
    comparison: 'alerts mitigated',
    color: 'secondary',
    sparkline: [30, 32, 35, 40, 38, 42, 45],
    hoverDetails: {
      title: 'Recent Resolutions',
      items: [
        { label: 'Resolutions', value: 45 },
        { label: 'Resolved Today', value: 12 },
        { label: 'Rate', value: '86%', highlight: 'live' as const },
        { label: 'Latest', value: 'Suspicious authentication activity blocked' },
        { label: 'Avg Time', value: '4m 32s' },
      ],
    },
  },
];

// ─── Live Network Traffic (last 15 minutes) ──────────────────
const generateTrafficData = () => {
  const now = new Date();
  return Array.from({ length: 30 }, (_, i) => {
    const t = new Date(now.getTime() - (29 - i) * 30000);
    const total = Math.floor(600 + Math.random() * 400 + Math.sin(i * 0.4) * 150);
    // Create spikes at specific intervals for security events
    const isSpike = i === 10 || i === 11 || i === 25;
    const events = isSpike ? Math.floor(200 + Math.random() * 300) : 0;
    return {
      time: t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      total: total + events,
      events,
    };
  });
};

export const trafficData = generateTrafficData();

// ─── Attack Forecast ─────────────────────────────────────────
export const forecastStages = [
  { id: 'recon', label: 'Reconnaissance', probability: 32, completed: true },
  { id: 'access', label: 'Initial Access', probability: 48, completed: true },
  { id: 'lateral', label: 'Lateral Movement', probability: 68, current: true },
  { id: 'exfil', label: 'Data Exfiltration', probability: 27, completed: false },
];

export const forecastSummary = {
  nextStep: 'Lateral Movement',
  probability: 68,
  target: '192.168.1.25',
  timeWindow: '30–60 seconds',
  confidence: 'High',
};

// ─── Network Entities ─────────────────────────────────────────
export const networkNodes = [
  { id: 'n1', ip: '192.168.1.10', label: 'Workstation', type: 'internal', x: 200, y: 200 },
  { id: 'n2', ip: '10.0.0.5', label: 'Suspicious', type: 'suspicious', x: 400, y: 120 },
  { id: 'n3', ip: '192.168.1.25', label: 'Server', type: 'server', x: 500, y: 280 },
  { id: 'n4', ip: '192.168.1.50', label: 'Database', type: 'server', x: 300, y: 360 },
  { id: 'n5', ip: '8.8.8.8', label: 'External', type: 'external', x: 620, y: 160 },
];

export const networkEdges = [
  { from: 'n2', to: 'n1', label: 'Scan' },
  { from: 'n2', to: 'n3', label: 'Brute Force' },
  { from: 'n2', to: 'n4', label: 'Lateral' },
  { from: 'n1', to: 'n5', label: 'DNS' },
  { from: 'n3', to: 'n4', label: 'Query' },
];

// ─── Recent Alerts ────────────────────────────────────────────
export const recentAlerts = [
  {
    id: 'a1',
    time: '10:44:12',
    severity: 'Critical' as const,
    event: 'Multiple failed logins',
    source: '10.0.0.5',
    destination: '192.168.1.25',
  },
  {
    id: 'a2',
    time: '10:42:55',
    severity: 'High' as const,
    event: 'Port scan detected',
    source: '203.0.113.10',
    destination: '10.0.0.12',
  },
  {
    id: 'a3',
    time: '10:41:20',
    severity: 'High' as const,
    event: 'Suspicious internal connection',
    source: '10.0.0.5',
    destination: '192.168.1.50',
  },
  {
    id: 'a4',
    time: '10:38:17',
    severity: 'Medium' as const,
    event: 'Unusual DNS query pattern',
    source: '10.0.0.8',
    destination: '8.8.8.8',
  },
  {
    id: 'a5',
    time: '10:36:03',
    severity: 'Low' as const,
    event: 'New device detected',
    source: '192.168.1.20',
    destination: '—',
  },
];

// ─── Demo AI Chat ─────────────────────────────────────────────
export const demoQuestions = [
  {
    id: 'q1',
    question: 'Why was lateral movement predicted?',
    answer: `[DEMO RESPONSE] Based on observed behavior patterns, host 10.0.0.5 has completed a port scan phase and successfully authenticated to 192.168.1.25. The temporal model detected a 68% probability of lateral movement based on: (1) repeated failed logins followed by success, (2) unusual SMB traffic patterns, and (3) historical ATT&CK stage progressions matching T1021.`,
  },
  {
    id: 'q2',
    question: 'What is this IP doing?',
    answer: `[DEMO RESPONSE] IP 10.0.0.5 has been observed performing the following actions in the last 30 seconds: • Port scan on 192.168.1.0/24 (T1046) • 47 failed SSH login attempts against 192.168.1.25 (T1110.001) • 1 successful authentication event • Initiated 3 new internal connections. Risk level: HIGH.`,
  },
  {
    id: 'q3',
    question: 'Show attack path for this entity?',
    answer: `[DEMO RESPONSE] Reconstructed attack path for 10.0.0.5:\n\n• Reconnaissance (T1046) → Port scan\n• Initial Access (T1110) → Brute force SSH\n• Lateral Movement (T1021) → Active now\n• Data Exfiltration (T1048) → Predicted next`,
  },
  {
    id: 'q4',
    question: 'What evidence supports this alert?',
    answer: `[DEMO RESPONSE] Evidence supporting "Multiple failed logins" alert: • 47 SSH authentication failures in 90s window • Source IP 10.0.0.5 not in known-good baseline • Destination 192.168.1.25 is a critical server • Failed attempts followed dictionary pattern • Eventual success at 10:44:12 matches T1110.001 (Brute Force: Password Guessing). Confidence: HIGH.`,
  },
];

// ─── Latest Reports ───────────────────────────────────────────
export const latestReports = [
  {
    id: 'r1',
    name: 'Suspicious_Activity_2025-08-16',
    type: 'Live Analysis',
    generatedAt: '16 Aug 2025, 10:40',
    status: 'Completed' as const,
  },
  {
    id: 'r2',
    name: 'Office_Network_Incident',
    type: 'PCAP Analysis',
    generatedAt: '16 Aug 2025, 09:15',
    status: 'Completed' as const,
  },
  {
    id: 'r3',
    name: 'Lateral_Movement_Simulation',
    type: 'Prediction Report',
    generatedAt: '16 Aug 2025, 08:30',
    status: 'Completed' as const,
  },
  {
    id: 'r4',
    name: 'Weekly_Security_Summary',
    type: 'Summary',
    generatedAt: '16 Aug 2025, 01:00',
    status: 'Completed' as const,
  },
];

// ─── Notifications ────────────────────────────────────────────
export const notifications = [
  { id: 'notif1', title: 'New critical alert', desc: 'Multiple failed logins from 10.0.0.5', time: '2 min ago', read: false, severity: 'critical' },
  { id: 'notif2', title: 'PCAP job complete', desc: 'Office_Network_Incident analysis done', time: '18 min ago', read: false, severity: 'info' },
  { id: 'notif3', title: 'Lateral movement predicted', desc: '68% probability — 192.168.1.25 at risk', time: '32 min ago', read: true, severity: 'warning' },
];
