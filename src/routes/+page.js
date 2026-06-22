import { networks, devices, firmwares, vendors } from '$lib/data.js';

export function load() {
  return {
    counts: {
      networks: networks.length,
      devices: devices.length,
      firmwares: firmwares.length,
      vendors: vendors.length
    }
  };
}
