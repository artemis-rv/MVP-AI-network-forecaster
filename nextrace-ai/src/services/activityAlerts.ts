// NEXTRACE AI — Grouped activity → Alert bridge
// The ONLY place live alerts are raised. Each AlertTrigger from the grouping engine becomes one alert:
//   backend alert store (idempotent via dedupe_key) → broadcast to every open tab → toast + notification.
// Only the tab that started the run proposes alerts, so several open views never duplicate them.
// Packets that keep flowing into an already-alerted activity only update that alert's count (throttled),
// they never create additional alerts or popups.

import { apiService } from '@/services/api';
import { useAlertStore } from '@/store/alertStore';
import { useAppStore } from '@/store/appStore';
import type { Alert, AlertSeverity } from '@/types/alert';
import type { ActivityCategory, AlertTrigger, GroupedActivity } from '@/lib/activityGrouping';
import {
  affectedAssetsOf, assetLine, recommendedActionsFor, actionLine, explainActivity,
} from '@/lib/socPlaybook';

const ALERT_CATEGORY: Record<ActivityCategory, string> = {
  icmp_recon: 'RECONNAISSANCE',
  port_scan: 'RECONNAISSANCE',
  auth_probe: 'BRUTE_FORCE',
  lateral_movement: 'LATERAL_MOVEMENT',
  suspicious_dns: 'C2',
  data_transfer: 'EXFILTRATION',
  c2_channel: 'C2',
  traffic_flood: 'ANOMALY',
  anomalous_flow: 'ANOMALY',
};

const UPDATE_INTERVAL_MS = 5000;
const lastSynced = new Map<string, number>();
/** Number of affected assets last pushed per alert — a new host is pushed immediately, not throttled. */
const assetCount = new Map<string, number>();

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function buildPayload(t: AlertTrigger, runId: string): Partial<Alert> & { dedupe_key: string } {
  const a = t.activity;
  const prefix = t.kind === 'escalated' ? 'Escalated: ' : t.kind === 'changed' ? 'Evolved: ' : '';
  return {
    title: `${prefix}${a.label}`,
    description: a.reason,
    severity: a.severity,
    status: 'OPEN',
    category: ALERT_CATEGORY[a.category],
    source_ip: a.sources[0],
    destination_ip: a.targets[0],
    protocol: a.protocols.join('/'),
    event_count: a.eventCount,
    confidence: a.confidence,
    first_seen: iso(a.firstSeen),
    last_seen: iso(a.lastSeen),
    tags: [a.id, a.category, 'grouped-activity', ...(a.mitre ? [a.mitre.id] : [])],
    evidence: [
      a.reason,
      `Targets: ${a.targets.join(', ')}`,
      `Ports: ${a.portCount} distinct${a.ports.length ? ` (${a.ports.slice(0, 8).join(', ')}${a.portCount > 8 ? ', …' : ''})` : ''}`,
      `Aggregated: ${a.eventCount} events between ${new Date(a.firstSeen).toLocaleTimeString('en-US', { hour12: false })} and ${new Date(a.lastSeen).toLocaleTimeString('en-US', { hour12: false })} → 1 alert`,
      ...(a.mitre ? [`MITRE ATT&CK ${a.mitre.id} — ${a.mitre.name}`] : []),
    ],
    activity_id: a.id,
    affected_assets: affectedAssetsOf(a).map(assetLine),
    recommended_actions: recommendedActionsFor(a).map(actionLine),
    explanation: explainActivity(a),
    // Live traffic comes from the demo generator; the alert is flagged so it is never mistaken for real telemetry.
    simulation: true,
    dedupe_key: `${runId}|${a.id}|${a.shape}|${a.severity}`,
  };
}

function toastType(sev: AlertSeverity): 'warning' | 'error' {
  return sev === 'HIGH' || sev === 'CRITICAL' ? 'error' : 'warning';
}

/**
 * Single entry point for a newly raised alert — from this tab's API call or the backend WebSocket broadcast.
 * Whichever arrives first adds it and shows the popup; the other is a no-op.
 */
export function receiveAlert(alert: Alert): boolean {
  const store = useAlertStore.getState();
  if (store.alerts.some(x => x.id === alert.id)) return false;
  useAlertStore.setState({ alerts: [alert, ...store.alerts], totalAlerts: store.totalAlerts + 1 });
  const app = useAppStore.getState();
  app.addAlertNotification(alert);
  // The popup names the affected asset (the thing the analyst must protect), not only the attacker.
  const assets = alert.affected_assets ?? [];
  const asset = assets[0]?.split(' — ')[0];
  const more = assets.length > 1 ? ` +${assets.length - 1} more` : '';
  app.addToast(
    `${alert.title} · ${alert.source_ip ?? '?'} → ${alert.destination_ip ?? '?'}${asset ? ` · affects ${asset}${more}` : ''} · ${alert.severity}`,
    toastType(alert.severity),
  );
  lastSynced.set(alert.id, Date.now());
  assetCount.set(alert.id, alert.affected_assets?.length ?? 0);
  store.fetchStats();
  return true;
}

/** Raises one alert per trigger. `onCreated` links the alert id back to its activity. */
export function raiseActivityAlerts(
  triggers: AlertTrigger[],
  runId: string,
  onCreated: (activityId: string, alertId: string) => void,
): void {
  for (const t of triggers) {
    const { dedupe_key, ...payload } = buildPayload(t, runId);
    apiService.createAlert({ ...payload, dedupe_key })
      .catch((): Alert => ({
        // Backend unreachable: keep the demo coherent with a local alert record.
        id: `LOCAL-${t.activity.id}-${Date.now().toString(36)}`,
        created_at: new Date().toISOString(),
        acknowledged_at: null,
        assigned_to: null,
        ...(payload as Omit<Alert, 'id' | 'created_at'>),
      }))
      .then((alert) => {
        receiveAlert(alert);
        onCreated(t.activity.id, alert.id);
      });
  }
}

/** Keeps the existing alert for a growing activity in sync (count / last seen), at most every 5 s. */
export function syncActivityAlerts(activities: GroupedActivity[], force = false): void {
  const now = Date.now();
  const updates: { id: string; event_count: number; last_seen: string; confidence: number; affected_assets?: string[] }[] = [];
  for (const a of activities) {
    const alertId = a.alertIds[a.alertIds.length - 1];
    if (!alertId) continue;
    const assets = affectedAssetsOf(a);
    const newAsset = assets.length > (assetCount.get(alertId) ?? 0);
    if (!force && !newAsset && now - (lastSynced.get(alertId) ?? 0) < UPDATE_INTERVAL_MS) continue;
    lastSynced.set(alertId, now);
    assetCount.set(alertId, assets.length);
    updates.push({
      id: alertId, event_count: a.eventCount, last_seen: iso(a.lastSeen), confidence: a.confidence,
      ...(newAsset ? { affected_assets: assets.map(assetLine) } : {}),
    });
  }
  if (updates.length === 0) return;

  const byId = new Map(updates.map(u => [u.id, u]));
  useAlertStore.setState(s => ({
    alerts: s.alerts.map(al => {
      const u = byId.get(al.id);
      return u ? {
        ...al, event_count: u.event_count, last_seen: u.last_seen, confidence: u.confidence,
        ...(u.affected_assets ? { affected_assets: u.affected_assets } : {}),
      } : al;
    }),
  }));
  for (const u of updates) {
    if (u.id.startsWith('LOCAL-')) continue;
    const { id, ...body } = u;
    apiService.updateAlert(id, body).catch(() => {});
  }
}

export function resetActivityAlertSync(): void {
  lastSynced.clear();
  assetCount.clear();
}
