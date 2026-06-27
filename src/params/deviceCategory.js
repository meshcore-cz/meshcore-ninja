// Route matcher: only these category slugs resolve to the filtered device list at
// /devices/<category>/. Invalid categories 404 instead of rendering an empty list.
const CATEGORIES = new Set([
  'development-board',
  'companion-radio',
  'standalone',
  'tracker',
  'repeater',
  'other'
]);

/** @param {string} param */
export function match(param) {
  return CATEGORIES.has(param);
}
