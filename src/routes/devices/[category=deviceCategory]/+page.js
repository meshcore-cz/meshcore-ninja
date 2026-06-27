import { devices, firmwaresForDevice } from '$lib/data.js';

// Prerender one filtered list per category, so each has its own indexable URL.
export function entries() {
  return [
    { category: 'development-board' },
    { category: 'companion-radio' },
    { category: 'standalone' },
    { category: 'tracker' },
    { category: 'repeater' },
    { category: 'other' }
  ];
}

export function load({ params }) {
  return {
    category: params.category,
    devices: devices.map((d) => ({ ...d, firmwareCount: firmwaresForDevice(d.id).length }))
  };
}
