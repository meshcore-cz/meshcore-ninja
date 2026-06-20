import { latestReleases } from '$lib/data.js';

export function load() {
  // 0 = no limit: every release group across all firmwares, newest first.
  return { releases: latestReleases(0) };
}
