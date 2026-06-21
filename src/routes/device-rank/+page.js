import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { METRICS } from '$lib/metrics.js';

export function load() {
  redirect(307, `${base}/device-rank/${METRICS[0].id}/`);
}
