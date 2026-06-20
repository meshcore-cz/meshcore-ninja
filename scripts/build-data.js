// Compiles every YAML file under data/ into a single data.json, and publishes
// JSON copies of the YAML schemas.
// Two data.json copies are written, with identical content:
//  - src/lib/generated/data.json : imported by the web app (Vite can't import
//    from the static/ public dir, so the importable copy lives under src/).
//  - static/data.json            : published verbatim and served at /data.json.
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(here, '..');

// Read a collection of `data/<kind>/<id>/<file>`. The record `id` is the
// directory name (never specified in the YAML itself).
function readDir(root, kind, file) {
  const base = join(root, 'data', kind);
  const out = [];
  for (const d of readdirSync(base, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const path = join(base, d.name, file);
    if (!existsSync(path)) continue;
    out.push({ id: d.name, ...(yaml.load(readFileSync(path, 'utf8')) ?? {}) });
  }
  return out;
}

function readCompatibility(root) {
  const base = join(root, 'data', 'compatibility');
  const records = [];
  if (existsSync(base)) {
    for (const fwDir of readdirSync(base, { withFileTypes: true })) {
      if (!fwDir.isDirectory()) continue;
      const fwPath = join(base, fwDir.name);
      for (const versionDir of readdirSync(fwPath, { withFileTypes: true })) {
        if (!versionDir.isDirectory()) continue;
        const versionPath = join(fwPath, versionDir.name);
        for (const file of readdirSync(versionPath, { withFileTypes: true })) {
          if (!file.isFile() || !file.name.endsWith('.yaml')) continue;
          const deviceId = file.name.replace(/\.yaml$/, '');
          const data = yaml.load(readFileSync(join(versionPath, file.name), 'utf8')) ?? {};
          records.push({
            firmwareId: fwDir.name,
            firmwareVersionSlug: versionDir.name,
            deviceId,
            ...data
          });
        }
      }
    }
  }

  return records.sort(
    (a, b) =>
      a.firmwareId.localeCompare(b.firmwareId) ||
      a.firmwareVersionSlug.localeCompare(b.firmwareVersionSlug) ||
      a.deviceId.localeCompare(b.deviceId)
  );
}

const roleVariantByFlasherRole = {
  companionBle: { id: 'companion-ble', role: 'companion', transports: ['ble'] },
  companionUsb: { id: 'companion-usb', role: 'companion', transports: ['usb'] },
  repeater: { id: 'repeater', role: 'repeater', transports: [] },
  roomServer: { id: 'room-server', role: 'room-server', transports: [] },
  gui: { id: 'standalone-ui', role: 'standalone-ui', transports: [] },
  guiSD: { id: 'standalone-ui-sd', role: 'standalone-ui', transports: [] }
};

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function inferredMcu(mcu) {
  if (!mcu) return undefined;
  const raw = String(mcu);
  const token = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let family = token;
  if (token.startsWith('esp32')) family = 'esp32';
  else if (token.includes('nrf52') || token.includes('nrf52840')) family = 'nrf52';
  else if (token.includes('rp2040')) family = 'rp2040';
  return { family, model: token };
}

function inferredRadios(radio) {
  if (!radio) return undefined;
  const chips = uniq(
    String(radio)
      .split(/\s*(?:\/|,|\+|\bor\b)\s*/i)
      .map((s) => s.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, ''))
  );
  return chips.map((chip) => ({
    technology: chip.includes('esp-now') ? 'esp-now' : 'lora',
    chip
  }));
}

function inferredDisplay(display) {
  if (display == null) return { status: 'unknown' };
  const value = String(display).trim();
  if (!value || /^none$/i.test(value)) return { status: 'none' };
  return { status: 'present', technology: value };
}

function inferredGnss(gps) {
  if (gps === true) return { status: 'present' };
  if (gps === false) return { status: 'none' };
  return { status: 'unknown' };
}

function inferredPower(battery) {
  if (battery == null) return undefined;
  const value = String(battery).trim();
  return /^none$/i.test(value)
    ? { batterySupported: false }
    : { batterySupported: true, pmic: value };
}

function inferredInterfaces(device) {
  const connectivity = (device.connectivity ?? []).map((c) => String(c).toLowerCase());
  const hasUsb = connectivity.some((c) => c.includes('usb'));
  const hasBle = connectivity.some((c) => c.includes('ble') || c.includes('bluetooth'));
  const hasWifi = connectivity.some((c) => c.includes('wi-fi') || c.includes('wifi'));
  const out = {};
  if (hasUsb) out.usb = { capabilities: ['power', 'serial', 'flashing'] };
  if (hasBle) out.bluetooth = { ble: true, version: 'unknown' };
  out.wifi = { status: hasWifi ? 'present' : 'unknown' };
  return Object.keys(out).length ? out : undefined;
}

function normalizeDevice(device) {
  const variants = [
    ...(device.variants ?? []),
    ...(device.flasher_roles ?? [])
      .map((sourceRole) => {
        const variant = roleVariantByFlasherRole[sourceRole];
        return variant ? { ...variant, sourceRole } : null;
      })
      .filter(Boolean)
  ];
  const roles = uniq([...(device.roles ?? []), ...variants.map((v) => v.role)]);
  const transports = uniq([
    ...(device.transports ?? []),
    ...variants.flatMap((v) => v.transports ?? [])
  ]);

  const hardware = {
    ...(device.hardware ?? {}),
    ...(device.hardware?.mcu ? {} : { mcu: inferredMcu(device.mcu) }),
    ...(device.hardware?.radios ? {} : { radios: inferredRadios(device.radio) }),
    ...(device.hardware?.display ? {} : { display: inferredDisplay(device.display) }),
    ...(device.hardware?.gnss ? {} : { gnss: inferredGnss(device.gps) }),
    ...(device.hardware?.power ? {} : { power: inferredPower(device.battery) })
  };
  for (const [key, value] of Object.entries(hardware)) {
    if (value === undefined) delete hardware[key];
  }

  return {
    ...device,
    ...(roles.length ? { roles } : {}),
    ...(transports.length ? { transports } : {}),
    ...(variants.length ? { variants } : {}),
    ...(Object.keys(hardware).length ? { hardware } : {}),
    interfaces: { ...(inferredInterfaces(device) ?? {}), ...(device.interfaces ?? {}) }
  };
}

function buildSchemas(root) {
  const schemaDir = join(root, 'schema');
  const outDir = join(root, 'static', 'schema');
  mkdirSync(outDir, { recursive: true });

  let count = 0;
  for (const file of readdirSync(schemaDir).filter((f) => f.endsWith('.yaml')).sort()) {
    const schema = yaml.load(readFileSync(join(schemaDir, file), 'utf8')) ?? {};
    const publicName = file.replace(/\.yaml$/, '.json');
    if (typeof schema.$id === 'string') {
      schema.$id = schema.$id.replace(/\/schema\/[^/]+$/, `/schema/${publicName}`);
    }
    writeFileSync(join(outDir, publicName), JSON.stringify(schema, null, 2) + '\n');
    count += 1;
  }
  return count;
}

/** Compile the YAML sources and write both data.json copies. Returns counts. */
export async function buildData(root = defaultRoot) {
  // Dynamically imported so the markdown libs stay out of the Vite config bundle.
  const { renderMarkdown } = await import('./lib/markdown.js');

  const vendors = readDir(root, 'vendors', 'vendor.yaml').sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  const devices = readDir(root, 'devices', 'device.yaml')
    .map(normalizeDevice)
    .map((d) => ({ ...d, vendorName: vendorById.get(d.vendorId)?.name ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Attach how many devices each vendor has.
  for (const v of vendors) {
    v.deviceCount = devices.filter((d) => d.vendorId === v.id).length;
  }

  const typeRank = { official: 0, fork: 1, custom: 2 };
  const rawFirmwares = readDir(root, 'firmwares', 'firmware.yaml');
  const compatibility = readCompatibility(root);

  const firmwares = rawFirmwares
    .map((fw) => {
      // Attach cached releases from the sibling changelog.yaml, if present.
      const clPath = join(root, 'data', 'firmwares', fw.id, 'changelog.yaml');
      if (existsSync(clPath)) {
        const cl = yaml.load(readFileSync(clPath, 'utf8')) ?? {};
        return {
          ...fw,
          releases: (cl.releases ?? []).map((r) => ({
            ...r,
            notesHtml: renderMarkdown(r.notes)
          })),
          changelogSource: cl.source ?? null,
          changelogUpdatedAt: cl.updatedAt ?? null
        };
      }
      return { ...fw, releases: [] };
    })
    .sort((a, b) => {
      const ra = typeRank[a.type] ?? 9;
      const rb = typeRank[b.type] ?? 9;
      return ra !== rb ? ra - rb : a.name.localeCompare(b.name);
    });

  const dataset = {
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    counts: {
      firmwares: firmwares.length,
      devices: devices.length,
      vendors: vendors.length,
      compatibility: compatibility.length
    },
    firmwares,
    devices,
    vendors,
    compatibility
  };

  const json = JSON.stringify(dataset, null, 2) + '\n';
  for (const target of [
    join(root, 'src', 'lib', 'generated', 'data.json'),
    join(root, 'static', 'data.json')
  ]) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, json);
  }

  return { ...dataset.counts, schemas: buildSchemas(root) };
}

// Run as a CLI when invoked directly (npm run build:data / pre-hooks).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { firmwares, devices, vendors, compatibility, schemas } = await buildData();
  console.log(
    `✓ Wrote data.json — ${firmwares} firmware(s), ${devices} device(s), ${vendors} vendor(s), ${compatibility} compatibility report(s); ${schemas} schema(s).`
  );
}
