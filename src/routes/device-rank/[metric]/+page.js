import { error } from '@sveltejs/kit';
import { devices, firmwaresForDevice } from '$lib/data.js';
import { METRICS, metricById } from '$lib/metrics.js';

export function entries() {
  return METRICS.map((m) => ({ metric: m.id }));
}

export function load({ params }) {
  const metric = metricById(params.metric);
  if (!metric) throw error(404, `Unknown metric: ${params.metric}`);
  return {
    devices: devices.map((device) => ({
      ...device,
      firmwareSupportCount: firmwaresForDevice(device.id).length
    })),
    metric
  };
}
