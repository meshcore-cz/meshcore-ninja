<script>
  // Standard page heading: an <h1> plus an optional dim subtitle paragraph.
  // The subtitle is a snippet so callers can embed inline links; pass
  // `subtitleClass` for per-page tweaks like a max-width.
  let { title, subtitleClass = '', children } = $props();
</script>

<h1 class="mb-1 text-[clamp(1.5rem,5vw,2rem)] font-bold">{title}</h1>
{#if children}
  <p class="mb-5 text-dim {subtitleClass}">{@render children()}</p>
{/if}
