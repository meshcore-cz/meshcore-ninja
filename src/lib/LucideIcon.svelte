<script>
  // Drop-in for the old @lucide/svelte icon components, rendered as a sprite
  // reference instead of a Svelte component instance. Sized by `class`
  // (e.g. "h-6 w-6") like the originals, or by an explicit `size`.
  import { LUCIDE_NAMES } from '$lib/lucide-sprite.js';

  let { name, size = null, class: className = '', label = '' } = $props();
</script>

{#if name && LUCIDE_NAMES.has(name)}
  <svg
    class={className}
    width={size ?? undefined}
    height={size ?? undefined}
    role={label ? 'img' : undefined}
    aria-hidden={label ? undefined : 'true'}
    focusable="false"
  >
    {#if label}<title>{label}</title>{/if}
    <use href={`#lu-${name}`} />
  </svg>
{/if}
