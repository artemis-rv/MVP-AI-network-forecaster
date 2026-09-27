// NEXTRACE AI — Entity risk scoring
// Risk is derived ONLY from significant grouped activities observed in the current session / capture.
// An entity that merely exists in the topology, or only exchanges benign traffic, never appears here.
//
// Source (actor) score:
//   base      = highest activity severity   (LOW 15 · MEDIUM 35 · HIGH 55 · CRITICAL 70)
//   + 10 per additional distinct activity type   (multi-stage behaviour: scan + brute force + transfer …)
//   + 3 per distinct target host, max 15         (fan-out)
//   + 4 · log10(total events), max 10            (volume)
// Target (victim) score = 0.6 · highest severity weight + 2 per distinct attacker, capped at 60 (Medium),
// so a host is never High risk just for being targeted.

import { countLabel } from '@/lib/socPlaybook';
import type { GroupedActivity } from '@/lib/activityGrouping';
import type { AlertSeverity } from '@/types/alert';

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
  activityIds: string[];
  topActivity: string;
  reasons: string[];
}

const SEV_WEIGHT: Record<AlertSeverity, number> = { LOW: 15, MEDIUM: 35, HIGH: 55, CRITICAL: 70 };

function level(score: number): EntityRiskLevel {
  return score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';
}

function roleType(ip: string): DashboardEntity['type'] {
  if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) return 'external';
  const last = parseInt(ip.split('.')[3] ?? '0', 10);
  return last >= 100 ? 'server' : 'internal';
}

export function deriveRiskEntities(activities: GroupedActivity[]): {
  entities: DashboardEntity[];
  counts: { total: number; high: number; medium: number; low: number };
} {
  const asSource = new Map<string, GroupedActivity[]>();
  const asTarget = new Map<string, GroupedActivity[]>();

  for (const a of activities) {
    if (!a.significant) continue;
    for (const s of a.sources) asSource.set(s, [...(asSource.get(s) ?? []), a]);
    for (const t of a.targets) {
      if (t === 'multiple_targets') continue;
      asTarget.set(t, [...(asTarget.get(t) ?? []), a]);
    }
  }

  const entities: DashboardEntity[] = [];
  const ips = new Set([...asSource.keys(), ...asTarget.keys()]);

  for (const ip of ips) {
    const src = asSource.get(ip) ?? [];
    const tgt = asTarget.get(ip) ?? [];
    let score: number;
    let status: string;

    if (src.length > 0) {
      const base = Math.max(...src.map(a => SEV_WEIGHT[a.severity]));
      const categories = new Set(src.map(a => a.category)).size;
      const targets = new Set(src.flatMap(a => a.targets)).size;
      const events = src.reduce((s, a) => s + a.eventCount, 0);
      score = base + 10 * (categories - 1) + Math.min(15, 3 * targets) + Math.min(10, Math.round(Math.log10(events + 1) * 4));
      if (tgt.length > 0) score += 5; // pivot: both attacked and attacking
      status = tgt.length > 0 ? 'Compromised pivot' : 'Suspicious source';
    } else {
      const base = Math.max(...tgt.map(a => SEV_WEIGHT[a.severity]));
      const attackers = new Set(tgt.flatMap(a => a.sources)).size;
      score = Math.min(60, Math.round(0.6 * base) + 2 * attackers);
      status = 'Targeted asset';
    }
    score = Math.min(100, Math.round(score));

    const related = [...src, ...tgt].sort((a, b) => SEV_WEIGHT[b.severity] - SEV_WEIGHT[a.severity] || b.eventCount - a.eventCount);
    const unique = Array.from(new Map(related.map(a => [a.id, a])).values());
    const role = roleType(ip);

    entities.push({
      id: ip,
      ip,
      label: src.length > 0 ? 'Activity source' : role === 'server' ? 'Server (targeted)' : 'Host (targeted)',
      type: src.length > 0 ? 'suspicious' : role,
      riskScore: score,
      riskLevel: level(score),
      status,
      threatCount: unique.length,
      activityIds: unique.map(a => a.id),
      topActivity: unique[0]?.label ?? '—',
      reasons: unique.slice(0, 3).map(a => `${a.label} (${countLabel(a)}, ${a.severity})`),
    });
  }

  entities.sort((a, b) => b.riskScore - a.riskScore);
  return {
    entities,
    counts: {
      total: entities.length,
      high: entities.filter(e => e.riskLevel === 'High').length,
      medium: entities.filter(e => e.riskLevel === 'Medium').length,
      low: entities.filter(e => e.riskLevel === 'Low').length,
    },
  };
}
