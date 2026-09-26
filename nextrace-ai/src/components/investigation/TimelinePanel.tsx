// NEXTRACE AI — Investigation Timeline Panel
// Activity-level attack timeline for the selected entity, in its own bounded scroll area.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useForecastStore } from '@/store/forecastStore';
import { useInvestigationStore } from '@/store/investigationStore';
import { useLiveStore } from '@/store/liveStore';
import { significantActivities } from '@/lib/activityGrouping';
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';
import { ActivityInspector } from '@/components/activity/ActivityInspector';
import { activityHref } from '@/hooks/useFocusParam';

export function TimelinePanel() {
  const navigate = useNavigate();
  const { investigation } = useInvestigationStore();
  const { currentForecast } = useForecastStore();
  const { activities, session } = useLiveStore();
  const [inspectId, setInspectId] = useState<string | null>(null);
  const grouped = significantActivities(activities);
  const inspected = inspectId ? grouped.find(a => a.id === inspectId) ?? null : null;
  const entityIp = investigation?.selectedEntityIp;
  const showPrediction = !!currentForecast && !currentForecast.is_benign && (session?.running ?? false);

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Attack Timeline</h3>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{entityIp ? `Activities involving ${entityIp}` : 'All activities'}</span>
      </div>

      <ActivityTimeline
        activities={grouped}
        filterIp={entityIp}
        onSelect={a => setInspectId(a.id)}
        linkFor={a => activityHref(a.id)}
        predicted={showPrediction && currentForecast ? { stage: currentForecast.predicted_next_stage, target: currentForecast.target } : null}
        maxHeight={300}
        emptyText="No grouped activity involves this entity."
      />

      {showPrediction && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 8, fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          <AlertTriangle size={11} style={{ flexShrink: 0 }} />
          <span>The last entry is a rule-based forecast, not observed evidence.</span>
        </div>
      )}

      {inspected && (
        <ActivityInspector
          activity={inspected}
          allActivities={grouped}
          live
          onSelect={a => setInspectId(a.id)}
          onInvestigate={ip => { setInspectId(null); navigate(`/investigation?ip=${encodeURIComponent(ip)}&source=entity`); }}
          onClose={() => setInspectId(null)}
        />
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border-default)',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
};
