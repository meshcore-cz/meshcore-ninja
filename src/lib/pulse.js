// Live analyzer metrics from the optional Go API (see ../../api). When
// VITE_API_BASE is unset the whole feature is disabled and the UI shows dashes,
// so the static site keeps working with no backend.

export const API_BASE = (import.meta.env?.VITE_API_BASE ?? '').replace(/\/+$/, '');
export const LIVE_ENABLED = !!API_BASE;

/**
 * Poll a JSON endpoint on an interval. Returns a stop() function.
 * Failures (offline API, network blip) are swallowed — polling just continues.
 *
 * @param {string} path absolute API path, e.g. '/api/networks'
 * @param {number} intervalMs
 * @param {(data: any) => void} onData
 * @returns {() => void} stop
 */
export function poll(path, intervalMs, onData) {
  if (!API_BASE) return () => {};
  let stopped = false;
  let timer;
  async function tick() {
    try {
      const res = await fetch(`${API_BASE}${path}`);
      if (res.ok && !stopped) onData(await res.json());
    } catch {
      // ignore — try again next tick
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  }
  tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

/** Format a pkt/m rate with two decimals, e.g. 58 → "58.00", 5 → "5.00". */
export function fmtRate(rate) {
  if (rate == null) return null;
  return rate.toFixed(2);
}

/** Relative "x ago" from a unix-seconds timestamp; null/0 → null. */
export function agoLabel(unixSeconds) {
  if (!unixSeconds) return null;
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}
