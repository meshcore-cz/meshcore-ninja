<script>
  // Reference a symbol from the inline sprite (see IconSprite.svelte). Cheap to
  // mount: two nodes, no SVG string parsing. `mono` drives the host fill to
  // `currentColor` for icons whose baked colours were stripped.
  let { id, size = 16, mono = false, label = '', class: className = '' } = $props();
</script>

<svg
  width={size}
  height={size}
  class={className}
  fill={mono ? 'currentColor' : undefined}
  role={label ? 'img' : undefined}
  aria-hidden={label ? undefined : 'true'}
  focusable="false"
>
  {#if label}<title>{label}</title>{/if}
  <use href={`#${id}`} />
</svg>
