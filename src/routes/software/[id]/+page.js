import { error } from '@sveltejs/kit';
import { software, getSoftware } from '$lib/data.js';

// Tell the static adapter which software pages to prerender.
export function entries() {
  return software.map((s) => ({ id: s.id }));
}

export function load({ params }) {
  const item = getSoftware(params.id);
  if (!item) throw error(404, `Unknown software: ${params.id}`);
  return { software: item };
}
