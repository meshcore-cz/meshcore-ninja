import { redirect } from '@sveltejs/kit';
import { href } from '$lib/i18n.js';
import { NETWORK_METRICS } from '$lib/network-metrics.js';

export function load() {
  redirect(307, href(`/network-rank/${NETWORK_METRICS[0].id}/`));
}
