/**
 * NEXTRACE AI — Anonymous Client-ID
 *
 * Generates a UUID v4 once per browser tab and stores it in sessionStorage
 * so it survives page refreshes within the same tab but NOT across tabs.
 * This gives each tab its own isolated LiveSession on the backend.
 *
 * Why sessionStorage (not localStorage)?
 *   - localStorage is shared across all tabs of the same origin, which
 *     would cause every tab to fight over the same backend session.
 *   - sessionStorage is scoped to the tab, matching one-tab = one-session.
 */

const KEY = 'nxtrace_client_id';

function uuidv4(): string {
  // Use the Web Crypto API when available (modern browsers & Node ≥ 19)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for very old browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let _cached: string | null = null;

/** Return the stable client ID for this browser tab. Creates one on first call. */
export function getClientId(): string {
  if (_cached) return _cached;
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored) {
      _cached = stored;
      return _cached;
    }
  } catch {
    // sessionStorage blocked (e.g. Safari private mode) — use in-memory only
  }
  const id = uuidv4();
  try { sessionStorage.setItem(KEY, id); } catch { /* ignore */ }
  _cached = id;
  return id;
}
