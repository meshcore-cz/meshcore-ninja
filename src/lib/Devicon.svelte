<script>
  // Renders a Devicon as a sprite reference (see icon-sprite.js / IconSprite).
  // Previously inlined the raw SVG via `{@html}`, which re-parsed an SVG string
  // for every instance — the dominant per-card render cost on list pages.
  //
  // `mono` flattens the icon to `currentColor`; the matching sprite symbol has
  // its baked fills stripped, so the host `fill` wins.
  import SpriteIcon from '$lib/SpriteIcon.svelte';
  import { hasDeviconSymbol } from '$lib/icon-sprite.js';

  let { icon, size = 16, mono = false, class: className = '' } = $props();
</script>

{#if hasDeviconSymbol(icon)}
  <SpriteIcon id={`dev-${icon}`} {size} {mono} class={className} />
{/if}
