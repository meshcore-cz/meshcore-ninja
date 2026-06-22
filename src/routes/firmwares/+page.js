import { firmwares, latestReleasePerFirmware } from '$lib/data.js';

export function load() {
  return { firmwares, latest: latestReleasePerFirmware() };
}
