// NEXTRACE AI — Facts sent to the explanation endpoint
// Only typed, bounded fields leave the browser (ids, categories, IPs, ports, counts) — never payload text.

import { type GroupedActivity, SEVERITY_RANK } from '@/lib/activityGrouping';
import type { ExplainRequest } from '@/services/api';

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
const hostsOnly = (ips: string[]) => ips.filter(ip => ip === 'multiple_targets' || IPV4.test(ip)).slice(0, 10);

export function toExplainRequest(
  context: ExplainRequest['context'],
  activities: GroupedActivity[],
  totals: ExplainRequest['totals'],
): ExplainRequest {
  return {
    context,
    totals: {
      packets: Math.max(0, Math.round(totals.packets)),
      flows: Math.max(0, Math.round(totals.flows)),
      duration_seconds: Math.max(0, Math.round(totals.duration_seconds)),
    },
    activities: [...activities]
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
      .slice(0, 30)
      .map(a => ({
        id: a.id,
        category: a.category,
        label: a.label.replace(/[^A-Za-z0-9 /&()+.,:'-]/g, '').slice(0, 80) || 'Activity',
        severity: a.severity,
        stage: a.stage,
        sources: hostsOnly(a.sources),
        targets: hostsOnly(a.targets),
        ports: a.ports.filter(p => p >= 0 && p <= 65535).slice(0, 50),
        event_count: a.eventCount,
        duration_seconds: Math.round((a.lastSeen - a.firstSeen) / 1000),
        bytes: a.bytes,
        mitre_id: a.mitre?.id ?? null,
      })),
  };
}

