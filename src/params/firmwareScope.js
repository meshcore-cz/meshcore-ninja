// Route matcher: only these scope slugs resolve to the filtered firmware list at
// /firmwares/<scope>/. Invalid scopes 404 instead of rendering an empty list.
const SCOPES = new Set(['universal', 'platform-specific', 'function-specific', 'device-specific']);

/** @param {string} param */
export function match(param) {
  return SCOPES.has(param);
}
