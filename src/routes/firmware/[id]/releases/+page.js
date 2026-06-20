import { error } from '@sveltejs/kit';
import { firmwares, getFirmware, groupReleases } from '$lib/data.js';

export function entries() {
  return firmwares.map((fw) => ({ id: fw.id }));
}

export function load({ params }) {
  const firmware = getFirmware(params.id);
  if (!firmware) throw error(404, `Unknown firmware: ${params.id}`);
  return { firmware, groups: groupReleases(firmware.releases) };
}
