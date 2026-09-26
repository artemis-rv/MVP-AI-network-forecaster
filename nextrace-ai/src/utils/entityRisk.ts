import type { LiveNode } from '@/types/live';
import type { Alert } from '@/types/alert';
import { networkNodes } from '@/data/mockData';

export type EntityRiskLevel = 'High' | 'Medium' | 'Low';

export interface DashboardEntity {
  id: string;
  ip: string;
  label: string;
  type: 'internal' | 'suspicious' | 'server' | 'external';
  riskScore: number;
  riskLevel: EntityRiskLevel;
  status: string;
  threatCount: number;
  recentAlertTitle?: string;
}

export function deriveDashboardEntities(liveNodes?: LiveNode[], alerts: Alert[] = []): {
  entities: DashboardEntity[];
  counts: { total: number; high: number; medium: number; low: number };
} {
  const entityMap = new Map<string, DashboardEntity>();

  // 1. Initialize from baseline network topology
  for (const n of networkNodes) {
    const isSuspicious = n.type === 'suspicious';
    entityMap.set(n.ip, {
      id: n.id,
      ip: n.ip,
      label: n.label,
      type: n.type as 'internal' | 'suspicious' | 'server' | 'external',
      riskScore: isSuspicious ? 85 : 20,
      riskLevel: isSuspicious ? 'High' : 'Low',
      status: isSuspicious ? 'Threat Detected' : 'Active',
      threatCount: isSuspicious ? 1 : 0,
    });
  }

  // 2. If liveNodes are provided (from live traffic stream), merge/override
  if (liveNodes && liveNodes.length > 0) {
    for (const ln of liveNodes) {
      const isSuspicious = ln.type === 'suspicious';
      const existing = entityMap.get(ln.ip);
      const score = isSuspicious ? 88 : ln.type === 'external' ? 40 : 20;
      entityMap.set(ln.ip, {
        id: ln.id,
        ip: ln.ip,
        label: existing?.label || (isSuspicious ? 'Suspicious' : ln.type === 'server' ? 'Server' : ln.type === 'external' ? 'External' : 'Workstation'),
        type: ln.type,
        riskScore: Math.max(existing?.riskScore ?? 0, score),
        riskLevel: (Math.max(existing?.riskScore ?? 0, score) >= 70) ? 'High' : (Math.max(existing?.riskScore ?? 0, score) >= 40) ? 'Medium' : 'Low',
        status: isSuspicious ? 'Threat Detected' : existing?.status || 'Active',
        threatCount: (existing?.threatCount ?? 0) + (isSuspicious ? 1 : 0),
      });
    }
  }

  // 3. Correlate with alerts (from backend API or store)
  for (const alert of alerts) {
    if (alert.status === 'RESOLVED') continue;

    // Severity weighting
    const severityScore =
      alert.severity === 'CRITICAL' ? 95 :
      alert.severity === 'HIGH' ? 82 :
      alert.severity === 'MEDIUM' ? 55 : 30;

    // Process source IP
    if (alert.source_ip) {
      const ent = entityMap.get(alert.source_ip);
      if (!ent) {
        const isSusp = alert.source_ip.startsWith('10.0.0.');
        entityMap.set(alert.source_ip, {
          id: `alert-src-${alert.source_ip}`,
          ip: alert.source_ip,
          label: isSusp ? 'Suspicious Actor' : 'Workstation',
          type: isSusp ? 'suspicious' : 'internal',
          riskScore: severityScore,
          riskLevel: severityScore >= 70 ? 'High' : severityScore >= 40 ? 'Medium' : 'Low',
          status: 'Threat Detected',
          threatCount: 1,
          recentAlertTitle: alert.title,
        });
      } else {
        ent.riskScore = Math.max(ent.riskScore, severityScore);
        if (severityScore >= 70) {
          ent.type = 'suspicious';
          ent.status = 'Threat Detected';
        }
        ent.threatCount += 1;
        if (!ent.recentAlertTitle) ent.recentAlertTitle = alert.title;
      }
    }

    // Process destination IP (targeted host)
    if (alert.destination_ip) {
      const ent = entityMap.get(alert.destination_ip);
      if (!ent) {
        entityMap.set(alert.destination_ip, {
          id: `alert-dst-${alert.destination_ip}`,
          ip: alert.destination_ip,
          label: 'Target Host',
          type: 'server',
          riskScore: Math.min(severityScore, 75),
          riskLevel: severityScore >= 70 ? 'High' : severityScore >= 40 ? 'Medium' : 'Low',
          status: severityScore >= 70 ? 'Targeted Asset' : 'Active',
          threatCount: 1,
          recentAlertTitle: `Targeted: ${alert.title}`,
        });
      } else {
        if (severityScore >= 70) {
          ent.riskScore = Math.max(ent.riskScore, 75);
          if (ent.status !== 'Threat Detected') {
            ent.status = 'Targeted Asset';
          }
          ent.threatCount += 1;
        }
      }
    }
  }

  // Calculate final risk levels and sort by riskScore descending
  const entities = Array.from(entityMap.values()).map(e => ({
    ...e,
    riskLevel: (e.riskScore >= 70 ? 'High' : e.riskScore >= 40 ? 'Medium' : 'Low') as EntityRiskLevel,
  })).sort((a, b) => b.riskScore - a.riskScore);

  const counts = {
    total: entities.length,
    high: entities.filter(e => e.riskLevel === 'High').length,
    medium: entities.filter(e => e.riskLevel === 'Medium').length,
    low: entities.filter(e => e.riskLevel === 'Low').length,
  };

  return { entities, counts };
}
