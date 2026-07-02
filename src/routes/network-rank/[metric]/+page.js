import { error } from '@sveltejs/kit';
import { networks, devicesForNetwork, networkBands } from '$lib/data.js';
import { NETWORK_METRICS, networkMetricById } from '$lib/network-metrics.js';

export function entries() {
  return NETWORK_METRICS.map((m) => ({ metric: m.id }));
}

export function load({ params }) {
  const metric = networkMetricById(params.metric);
  if (!metric) throw error(404, `Unknown metric: ${params.metric}`);
  return {
    // Deprecated networks carry no live activity and stale structure, so they
    // stay out of the ranking (mirrors the Networks table splitting them off).
    networks: networks
      .filter((n) => !n.deprecated)
      .map((n) => ({
        ...n,
        deviceCount: devicesForNetwork(n).length,
        bandCount: networkBands(n).length,
        subnetworkCount: n.subnetworks?.length ?? 0,
        analyzerCount: n.analyzers?.length ?? 0
      })),
    metric
  };
}
