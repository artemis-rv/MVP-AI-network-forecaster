// NEXTRACE AI — `?focus=<activity id>` deep links
// Timelines, alerts and stage maps link to the exact activity on its home page. Pages read the target
// during render and remember the navigation key they handled, so each link highlights exactly once.

import { useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

const ACTIVITY_ID = /^[A-Z]{2,5}-\d{1,6}$/;

export interface FocusTarget {
  id: string;
  /** Unique per navigation, so following the same link twice highlights again. */
  key: string;
}

export function useFocusParam(): FocusTarget | null {
  const [params] = useSearchParams();
  const { key } = useLocation();
  const raw = params.get('focus');
  // Only well-formed activity ids are honoured; anything else is ignored.
  return useMemo(() => (raw && ACTIVITY_ID.test(raw) ? { id: raw, key } : null), [raw, key]);
}

/** Link to an activity on the page that owns it. */
export function activityHref(id: string): string {
  return `${id.startsWith('HACT') ? '/historical-pcap' : '/live-monitoring'}?focus=${encodeURIComponent(id)}`;
}
