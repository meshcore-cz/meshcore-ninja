import { firmwares } from '$lib/data.js';

// Prerender one filtered list per scope, so each has its own indexable URL.
export function entries() {
  return [
    { scope: 'universal' },
    { scope: 'platform-specific' },
    { scope: 'function-specific' },
    { scope: 'device-specific' }
  ];
}

export function load({ params }) {
  return { firmwares, scope: params.scope };
}
