<script>
  import { href } from '$lib/i18n.js';
  import { toolById, toolLabel, toolShortLabel } from '$lib/tools.js';
  import LucideIcon from '$lib/LucideIcon.svelte';

  /** @type {{ id: import('$lib/tools.js').ToolId, short?: boolean, to?: string | null, label?: string | null }} */
  let { id, short = false, to = null, label: labelOverride = null } = $props();

  const tool = $derived(toolById(id));
  const displayLabel = $derived(labelOverride ?? (short ? toolShortLabel(id) : toolLabel(id)));
  const linkHref = $derived(to ?? tool?.href);
  const iconName = $derived(tool?.icon);
</script>

{#if tool && linkHref}
  <a
    class="inline-flex items-center gap-2 rounded-lg border border-edge bg-elev px-3.5 py-2 text-[0.9rem] text-dim transition hover:border-accent hover:text-ink"
    href={href(linkHref)}
  >
    {#if iconName}
      <LucideIcon name={iconName} class="h-4 w-4 shrink-0 text-accent" />
    {/if}
    {displayLabel}
  </a>
{/if}
