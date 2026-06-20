// Render Markdown (GitHub release notes) to sanitized HTML at build time.
// Done in the build pipeline (Node) so the app only ever renders trusted HTML.
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

marked.setOptions({ gfm: true, breaks: false });

const allowedTags = [
  ...sanitizeHtml.defaults.allowedTags,
  'img',
  'h1',
  'h2',
  'del',
  'ins'
];

/** @param {string|undefined|null} md @returns {string|null} */
export function renderMarkdown(md) {
  if (!md) return null;
  const html = marked.parse(md.trim());
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' })
    }
  });
}
