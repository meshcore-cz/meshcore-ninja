// Localized labels for network-rank metrics (browser / Svelte only). Message
// keys replace hyphens with underscores (e.g. `pkt-per-min` →
// `nr_metric_pkt_per_min`) and fall back to the English label in
// network-metrics.js.
import { m } from '$lib/paraglide/messages.js';
import { networkMetricById } from '$lib/network-metrics.js';

/** Localized metric name for UI. */
export function networkMetricLabel(id) {
  const key = `nr_metric_${String(id).replaceAll('-', '_')}`;
  return m[key]?.() ?? networkMetricById(id)?.label ?? id;
}

/** Unit suffix for a metric (technical units stay as-is). */
export function networkMetricUnit(id) {
  return networkMetricById(id)?.unit ?? '';
}

/** Chip / column heading: label plus unit in parentheses. */
export function networkMetricHeading(id) {
  const label = networkMetricLabel(id);
  const unit = networkMetricUnit(id);
  return unit ? `${label} (${unit})` : label;
}
