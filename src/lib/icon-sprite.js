// Build an inline SVG `<symbol>` sprite from the icon sources we already bundle,
// so each on-page icon becomes a tiny `<svg><use href="#…"></svg>` reference
// instead of a freshly-parsed `{@html}` SVG subtree per card. The definitions
// are emitted once (see IconSprite.svelte); everything else just points at them.
import { DEVICON_SVGS } from '$lib/devicon.js';
import { PLATFORMS } from '$lib/platforms.js';

// Devicon ids rendered monochrome (platform icons go through PlatformIcon with
// `mono`): strip their baked fills so the symbol inherits `currentColor`, the
// same flattening the old `.devicon-mono *{fill:currentColor}` rule did.
const MONO_DEVICONS = new Set(
  Object.values(PLATFORMS)
    .map((p) => p.devicon)
    .filter(Boolean)
);

/** Turn a raw `<svg …>…</svg>` string into a sprite symbol descriptor. */
function svgToSymbol(id, raw, mono) {
  const viewBox = (raw.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 24 24';
  let inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  // For mono icons drop explicit colour attributes (keep `none` so cut-outs
  // survive) so paths fall back to the inherited `currentColor`.
  if (mono) inner = inner.replace(/\s(?:fill|stroke)="(?!none)[^"]*"/g, '');
  return { id: `dev-${id}`, viewBox, inner, mono };
}

/** Sprite symbols for every bundled Devicon, keyed `dev-<name>-<variant>`. */
export const DEVICON_SYMBOLS = Object.entries(DEVICON_SVGS).map(([id, raw]) =>
  svgToSymbol(id, raw, MONO_DEVICONS.has(id))
);

// Small UI glyphs repeated across list cards (stars, maintainer). Colours are
// baked as `currentColor` so a wrapping text colour drives them.
export const UI_SYMBOLS = [
  {
    id: 'ui-star',
    viewBox: '0 0 24 24',
    inner:
      '<path fill="currentColor" d="m12 2 2.9 6.3 6.8.7-5 4.6 1.4 6.7L12 17.8 5.9 20.3l1.4-6.7-5-4.6 6.8-.7L12 2Z"/>'
  },
  {
    id: 'ui-user',
    viewBox: '0 0 24 24',
    inner:
      '<g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="3.2"/><path d="M5 20a7 7 0 0 1 14 0" stroke-linecap="round"/></g>'
  }
];

/** True when a Devicon id has a bundled symbol (mirrors deviconSvg lookups). */
export function hasDeviconSymbol(id) {
  return !!(id && DEVICON_SVGS[id]);
}
