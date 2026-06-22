import { error } from '@sveltejs/kit';
import {
  networks,
  getNetwork,
  devicesForNetwork,
  devicesIncompatibleWithNetwork
} from '$lib/data.js';

export function entries() {
  return networks.map((n) => ({ id: n.id }));
}

export function load({ params }) {
  const network = getNetwork(params.id);
  if (!network) throw error(404, `Unknown network: ${params.id}`);
  return {
    network,
    devices: devicesForNetwork(network),
    incompatibleDevices: devicesIncompatibleWithNetwork(network)
  };
}
