// Adapter: grouping-engine stage map → StageMap display items.
import type { StageMapEntry } from '@/lib/socPlaybook';
import type { StageMapItem } from '@/components/activity/StageMap';

/** Adapts the grouping-engine stage map to the display shape. */
export function toStageMapItems(entries: StageMapEntry[]): StageMapItem[] {
  return entries.map(e => ({
    stage: e.stage,
    status: e.status,
    severity: e.severity,
    first_seen: e.firstSeen ? new Date(e.firstSeen).toLocaleTimeString('en-US', { hour12: false }) : null,
    activities: e.activityIds,
    summary: e.summary,
  }));
}
