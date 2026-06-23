import { vendors, devicesForVendor } from '$lib/data.js';

export function load() {
  // Each vendor carries its own device list; vendors are ordered by how many
  // boards they make (most prolific first), ties broken by name. Devices come
  // back already name-sorted from devicesForVendor.
  const withDevices = vendors
    .map((v) => ({ ...v, devices: devicesForVendor(v.id) }))
    .sort((a, b) => b.devices.length - a.devices.length || a.name.localeCompare(b.name));
  return { vendors: withDevices };
}
