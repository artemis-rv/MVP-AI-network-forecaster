// NEXTRACE AI — Plain-language explanation panel
// Shows the deterministic explanation of each activity instantly, and on request a short summary
// from the backend explainer (LLM when the server has a key configured, template otherwise).
// Only typed facts are sent — never packet payloads — and the answer is rendered as plain text.

import { useState } from 'react';
import { Lightbulb, Sparkles, Loader2 } from 'lucide-react';
import { type GroupedActivity, SEVERITY_RANK } from '@/lib/activityGrouping';
import { explainActivity } from '@/lib/socPlaybook';
import { apiService, type ExplainRequest, type ExplainResponse } from '@/services/api';
import { toExplainRequest } from '@/lib/explainFacts';
import { SeverityPill } from '@/components/activity/ActivityList';

export function PlainLanguagePanel({ activities, context, totals, onSelect }: {
  activities: GroupedActivity[];
  context: ExplainRequest['context'];
  totals: ExplainRequest['totals'];
  onSelect?: (a: GroupedActivity) => void;
}) {
  const [summary, setSummary] = useState<ExplainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const ordered = [...activities].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]).slice(0, 5);

  async function summarise() {
    setLoading(true);
    setFailed(false);
    try {
      setSummary(await apiService.explain(toExplainRequest(context, activities, totals)));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          <Lightbulb size={15} color="var(--primary)" /> In plain language
        </div>
        <button
          type="button"
          onClick={summarise}
          disabled={loading || activities.length === 0}
          data-tour="explain-btn"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '5px 12px',
            borderRadius: 8, border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)',
            cursor: loading || activities.length === 0 ? 'not-allowed' : 'pointer', opacity: activities.length === 0 ? 0.5 : 1,
          }}
        >
          {loading ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Sparkles size={13} />}
          {summary ? 'Regenerate summary' : 'Summarise with AI'}
        </button>
      </div>

      {activities.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No suspicious activity to explain.</div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ordered.map(a => (
            <li
              key={a.id}
              onClick={() => onSelect?.(a)}
              style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 8, background: 'var(--bg-workspace)', cursor: onSelect ? 'pointer' : 'default' }}
            >
              <SeverityPill severity={a.severity} />
              <span style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>{explainActivity(a)}</span>
            </li>
          ))}
        </ul>
      )}

      {failed && <div style={{ fontSize: 12, color: 'var(--color-critical)' }}>The summary service is unreachable. The explanations above are still valid.</div>}
      {summary && (
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 10, padding: '10px 12px', background: 'var(--bg-card)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
            {summary.source === 'llm' ? `AI summary · ${summary.model} · verify against the evidence` : 'Summary · template (no LLM configured on the server)'}
          </div>
          {/* Rendered as text only — model output is never interpreted as HTML */}
          <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{summary.explanation}</div>
        </div>
      )}
    </div>
  );
}
