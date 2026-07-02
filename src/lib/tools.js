// Utility / tool pages — labels, routes, icons and where each appears in the UI.
// `icon` is a Lucide icon name (kebab-case); render it via <LucideIcon> /
// the sprite, not a per-icon Svelte component.
import { m } from '$lib/paraglide/messages.js';

/** @typedef {'repeater-commands' | 'matrix' | 'device-rank' | 'network-rank' | 'compare' | 'compare-firmwares' | 'releases' | 'languages' | 'vendor-countries' | 'bands' | 'prints' | 'gallery' | 'schemas' | 'bundle' | 'status' | 'about'} ToolId */

/** @type {Record<ToolId, { id: ToolId, label: string, href: string, icon: string, home?: boolean, homeLabel?: string }>} */
export const TOOLS = {
  'repeater-commands': {
    id: 'repeater-commands',
    label: 'Repeater commands',
    href: '/repeater-commands/',
    icon: 'terminal',
    home: true
  },
  bands: {
    id: 'bands',
    label: 'Frequency bands',
    href: '/bands/',
    icon: 'radio',
    home: true
  },
  matrix: {
    id: 'matrix',
    label: 'Compatibility matrix',
    href: '/matrix/',
    icon: 'grid-2x2-check',
    home: true
  },
  releases: {
    id: 'releases',
    label: 'Releases',
    homeLabel: 'All releases',
    href: '/releases/',
    icon: 'tags',
    home: true
  },
  prints: {
    id: 'prints',
    label: '3D Prints',
    href: '/prints/',
    icon: 'boxes',
    home: true
  },
  gallery: {
    id: 'gallery',
    label: 'Device gallery',
    href: '/gallery/',
    icon: 'images',
    home: true
  },
  'device-rank': {
    id: 'device-rank',
    label: 'Device ranking',
    href: '/device-rank/',
    icon: 'trophy',
    home: true
  },
  'network-rank': {
    id: 'network-rank',
    label: 'Network ranking',
    href: '/network-rank/',
    icon: 'medal',
    home: true
  },
  compare: {
    id: 'compare',
    label: 'Compare devices',
    href: '/compare/',
    icon: 'git-compare-arrows',
    home: true
  },
  'compare-firmwares': {
    id: 'compare-firmwares',
    label: 'Compare firmwares',
    href: '/compare-firmwares/',
    icon: 'git-compare',
    home: true
  },
  languages: {
    id: 'languages',
    label: 'Language leaderboard',
    href: '/languages/',
    icon: 'code',
    home: true
  },
  'vendor-countries': {
    id: 'vendor-countries',
    label: 'Vendor countries',
    href: '/vendor-countries/',
    icon: 'globe',
    home: true
  },
  schemas: {
    id: 'schemas',
    label: 'Schema explorer',
    href: '/schemas/',
    icon: 'braces',
    home: true
  },
  bundle: {
    id: 'bundle',
    label: 'Data bundle size',
    href: '/bundle/',
    icon: 'database',
    home: true
  },
  status: {
    id: 'status',
    label: 'API status',
    href: '/status/',
    icon: 'activity',
    home: true
  },
  about: {
    id: 'about',
    label: 'About',
    href: '/about/',
    icon: 'info'
  }
};

/** Related tool shortcuts shown in each collection page header. */
export const COLLECTION_TOOL_IDS = {
  networks: ['network-rank', 'bands'],
  firmwares: ['releases', 'matrix'],
  devices: ['device-rank', 'gallery'],
  software: ['releases', 'languages'],
  vendors: ['vendor-countries']
};

/** Tool links on the home page Tools section, in display order. */
export const HOME_TOOL_IDS = [
  'repeater-commands',
  'bands',
  'matrix',
  'device-rank',
  'network-rank',
  'releases',
  'prints',
  'gallery',
  'compare',
  'compare-firmwares',
  'languages',
  'vendor-countries',
  'schemas',
  'bundle',
  'status'
];

/** @param {ToolId | string | null | undefined} id */
export function toolById(id) {
  return id ? (TOOLS[id] ?? null) : null;
}

/**
 * Localized label for a tool. Message keys replace hyphens with underscores
 * (e.g. `repeater-commands` → `tool_repeater_commands_label`). Falls back to the
 * English label baked into TOOLS.
 * @param {ToolId | string} id
 */
export function toolLabel(id) {
  return m[`tool_${String(id).replaceAll('-', '_')}_label`]?.() ?? TOOLS[id]?.label ?? String(id);
}

/** @param {ToolId} id */
export function toolHomeLabel(id) {
  const key = String(id).replaceAll('-', '_');
  return m[`tool_${key}_home_label`]?.() ?? toolLabel(id);
}

/** Shorter label for collection-page header shortcuts (e.g. "Ranking" vs "Device ranking"). */
/** @param {ToolId | string} id */
export function toolShortLabel(id) {
  const key = String(id).replaceAll('-', '_');
  return m[`tool_${key}_short_label`]?.() ?? toolLabel(id);
}
