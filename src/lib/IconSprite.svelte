<script>
  // Emits every sprite `<symbol>` once per document. The `{@html}` here runs a
  // single time at the app shell — not per icon instance — so the per-card cost
  // collapses to a `<use href>` reference. Rendered hidden and out of the
  // accessibility tree; it only provides definitions.
  import { DEVICON_SYMBOLS, UI_SYMBOLS } from '$lib/icon-sprite.js';
  import { LUCIDE_SYMBOLS } from '$lib/lucide-sprite.js';
  const symbols = [...DEVICON_SYMBOLS, ...UI_SYMBOLS, ...LUCIDE_SYMBOLS];
</script>

<svg
  aria-hidden="true"
  style="position:absolute;width:0;height:0;overflow:hidden"
  focusable="false"
  tabindex="-1"
>
  {#each symbols as s (s.id)}
    <symbol id={s.id} viewBox={s.viewBox}>{@html s.inner}</symbol>
  {/each}
</svg>
