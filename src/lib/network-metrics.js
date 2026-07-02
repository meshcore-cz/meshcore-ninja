// Rankable network metrics, shared by /network-rank. Two families:
//   - static : derived from the catalog (coverage area, structure, hardware
//              compatibility). Always available and prerendered.
//   - live   : pulled from the optional analyzer API (packets, nodes,
//              observers). null until a poll arrives — or whenever no API is
//              configured, in which case the live metrics are hidden entirely.
//
// Each metric exposes:
//   id    – stable url key (/network-rank/<id>/)
//   label – column / heading text (English default; localized in
//           network-metric-labels.js)
//   unit  – short unit suffix shown after the value ('' when none)
//   dir   – default sort: 'desc' (bigger is better/first) or 'asc'
//   live  – true when the value comes from the analyzer API
//   get   – (network, live) => number | null
//           `live` is that network's /api/networks row (or undefined)
//   fmt   – (value) => string   display form, unit appended by caller

/** Safe ratio: null unless the denominator is a positive number. */
const ratio = (num, den) => (num != null && den > 0 ? num / den : null);

const fmtInt = (v) => `${Math.round(v).toLocaleString()}`;
const fmtNum = (v, digits = 2) => `${Number(v.toFixed(digits))}`;

// Registry nodes plotted on the map (has GPS, not location-flagged), split by
// node type name from the API's nodesByType map. Missing type → 0 once the
// network has any live data; null before the first poll so the row shows "—".
const byType = (live, type) => (live ? (live.nodesByType?.[type] ?? 0) : null);

export const NETWORK_METRICS = [
  {
    id: 'area',
    label: 'Coverage area',
    unit: 'km²',
    dir: 'desc',
    live: false,
    get: (n) => n.areaKm2 ?? null,
    fmt: fmtInt
  },
  {
    id: 'subnetworks',
    label: 'Subnetworks',
    unit: '',
    dir: 'desc',
    live: false,
    get: (n) => n.subnetworkCount ?? null,
    fmt: (v) => `${v}`
  },
  {
    id: 'analyzers',
    label: 'Analyzers',
    unit: '',
    dir: 'desc',
    live: false,
    get: (n) => n.analyzerCount ?? null,
    fmt: (v) => `${v}`
  },
  {
    id: 'devices',
    label: 'Compatible devices',
    unit: '',
    dir: 'desc',
    live: false,
    get: (n) => n.deviceCount ?? null,
    fmt: (v) => `${v}`
  },
  {
    id: 'bands',
    label: 'Frequency bands',
    unit: '',
    dir: 'desc',
    live: false,
    get: (n) => n.bandCount ?? null,
    fmt: (v) => `${v}`
  },
  // --- live analyzer metrics ------------------------------------------------
  {
    id: 'pkt-per-min',
    label: 'Packets / min',
    unit: 'pkt/m',
    dir: 'desc',
    live: true,
    get: (n, live) => live?.pktPerMin ?? null,
    fmt: (v) => fmtNum(v)
  },
  {
    id: 'nodes',
    label: 'Active nodes',
    unit: '',
    dir: 'desc',
    live: true,
    get: (n, live) => live?.nodes ?? null,
    fmt: fmtInt
  },
  {
    id: 'total-nodes',
    label: 'Total nodes',
    unit: '',
    dir: 'desc',
    live: true,
    get: (n, live) => live?.totalNodes ?? null,
    fmt: fmtInt
  },
  {
    id: 'nodes-on-map',
    label: 'Nodes on map',
    unit: '',
    dir: 'desc',
    live: true,
    get: (n, live) => live?.nodesOnMap ?? null,
    fmt: fmtInt
  },
  {
    id: 'repeaters',
    label: 'Repeaters',
    unit: '',
    dir: 'desc',
    live: true,
    get: (n, live) => byType(live, 'repeater'),
    fmt: fmtInt
  },
  {
    id: 'companions',
    label: 'Companions',
    unit: '',
    dir: 'desc',
    live: true,
    get: (n, live) => byType(live, 'chat'),
    fmt: fmtInt
  },
  {
    id: 'room-servers',
    label: 'Room servers',
    unit: '',
    dir: 'desc',
    live: true,
    get: (n, live) => byType(live, 'room'),
    fmt: fmtInt
  },
  {
    id: 'sensors',
    label: 'Sensors',
    unit: '',
    dir: 'desc',
    live: true,
    get: (n, live) => byType(live, 'sensor'),
    fmt: fmtInt
  },
  {
    id: 'observers',
    label: 'Observers',
    unit: '',
    dir: 'desc',
    live: true,
    get: (n, live) => live?.observers ?? null,
    fmt: fmtInt
  },
  {
    id: 'observers-per-node',
    label: 'Observers per node',
    unit: '',
    dir: 'desc',
    live: true,
    get: (n, live) => (live ? ratio(live.observers, live.nodes) : null),
    fmt: (v) => fmtNum(v, 3)
  },
  {
    id: 'packets',
    label: 'Unique packets',
    unit: '',
    dir: 'desc',
    live: true,
    get: (n, live) => live?.uniquePackets ?? null,
    fmt: fmtInt
  },
  {
    id: 'pkt-per-node',
    label: 'Packets / min per node',
    unit: '',
    dir: 'desc',
    live: true,
    get: (n, live) => (live ? ratio(live.pktPerMin, live.nodes) : null),
    fmt: (v) => fmtNum(v, 3)
  }
];

const byId = new Map(NETWORK_METRICS.map((m) => [m.id, m]));

/** Look up a network metric by its url id, or null. */
export function networkMetricById(id) {
  return byId.get(id) ?? null;
}
