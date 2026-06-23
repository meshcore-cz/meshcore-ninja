<script>
  // "← All devices" style breadcrumb shown atop detail pages. Children are the
  // label after the arrow; `href` is the destination (already base-prefixed).
  let { href, children } = $props();
</script>

<a class="mb-4 inline-block text-[0.9rem] text-dim hover:underline" {href}>← {@render children()}</a>
