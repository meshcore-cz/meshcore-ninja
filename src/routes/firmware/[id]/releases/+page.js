import { error } from '@sveltejs/kit';
import { base } from '$app/paths';
import { firmwares, getFirmware, groupReleases } from '$lib/data.js';

export function entries() {
  return firmwares.map((fw) => ({ id: fw.id }));
}

export async function load({ params, fetch }) {
  const meta = getFirmware(params.id);
  if (!meta) throw error(404, `Unknown firmware: ${params.id}`);

  // The global dataset omits release notes (~1MB of changelog HTML used only on
  // this page and the firmware detail page); fetch the full per-record JSON.
  const res = await fetch(`${base}/firmware/${params.id}.json`);
  const firmware = res.ok ? await res.json() : meta;
  return { firmware, groups: groupReleases(firmware.releases) };
}
