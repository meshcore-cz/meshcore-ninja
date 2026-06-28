// PWA manifest shortcuts — keep paths and copy in sync with NAV_COLLECTIONS in
// src/lib/collections.js (labels are English; the manifest is static at build time).

/** @type {{ name: string, short_name: string, path: string, description: string }[]} */
export const PWA_SHORTCUTS = [
  {
    name: 'Networks',
    short_name: 'Networks',
    path: 'networks/',
    description: 'Regional & national meshes — radio settings, coverage and how to join.'
  },
  {
    name: 'Software',
    short_name: 'Software',
    path: 'software/',
    description: 'Clients, integrations, gateways, monitoring, utilities, bots and libraries.'
  },
  {
    name: 'Devices',
    short_name: 'Devices',
    path: 'devices/',
    description: 'LoRa hardware that runs MeshCore — specs, radios and node roles.'
  },
  {
    name: 'Firmwares',
    short_name: 'Firmwares',
    path: 'firmwares/',
    description: 'The reference build plus community forks and custom variants.'
  }
];

/**
 * @param {string} basePath Deploy base without trailing slash (e.g. "" or "/meshcore-ninja")
 * @param {string} startUrl Manifest start_url (with trailing slash)
 */
export function buildPwaShortcuts(basePath, startUrl) {
  const iconSrc = `${basePath}/pwa-192.png`;
  return PWA_SHORTCUTS.map((shortcut) => ({
    name: shortcut.name,
    short_name: shortcut.short_name,
    description: shortcut.description,
    url: `${startUrl}${shortcut.path}`,
    icons: [{ src: iconSrc, sizes: '192x192', type: 'image/png' }]
  }));
}
