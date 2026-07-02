<script>
  import { href } from '$lib/i18n.js';
  import { m } from '$lib/paraglide/messages.js';
  import { onMount } from 'svelte';
  import BackLink from '$lib/BackLink.svelte';
  import Seo from '$lib/Seo.svelte';
  import PageHeader from '$lib/PageHeader.svelte';
  import Button from '$lib/Button.svelte';
  import Tooltip from '$lib/Tooltip.svelte';
  import AppPresetBadge from '$lib/AppPresetBadge.svelte';
  import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
  import { NETWORK_METRICS } from '$lib/network-metrics.js';
  import {
    networkMetricHeading,
    networkMetricLabel,
    networkMetricUnit
  } from '$lib/network-metric-labels.js';
  import {
    NETWORK_SCOPE_META,
    networkScopeLabel,
    networkFlags,
    isAppPresetNetwork
  } from '$lib/data.js';
  import { LIVE_ENABLED, poll } from '$lib/pulse.js';

  let { data } = $props();

  let metric = $derived(data.metric);

  // Live analyzer metrics per network id, polled from the optional API. Starts
  // empty (matching the prerendered HTML, so hydration is clean) and fills in
  // once the first poll lands, which reactively re-ranks the table.
  let liveById = $state({});
  onMount(() => {
    if (!LIVE_ENABLED) return;
    return poll('/api/networks', 5000, (res) => {
      const next = {};
      for (const n of res.networks ?? []) next[n.id] = n;
      liveById = next;
    });
  });

  // Live-only metrics are meaningless without an API, so hide those chips then.
  let visibleMetrics = $derived(NETWORK_METRICS.filter((mt) => LIVE_ENABLED || !mt.live));

  // Sort direction follows the metric's natural order until the header is
  // clicked, which pins an explicit direction. The override clears whenever the
  // route (metric) changes, so each metric opens in its natural order.
  let dirOverride = $state(null);
  let dir = $derived(dirOverride ?? metric.dir);
  $effect(() => {
    metric.id;
    dirOverride = null;
  });
  function flipDir() {
    dirOverride = dir === 'asc' ? 'desc' : 'asc';
  }

  // Scope filter chips.
  const SCOPE_ORDER = ['national', 'regional', 'local', 'general', 'experimental'];
  let activeScope = $state('all');
  let availableScopes = $derived(
    SCOPE_ORDER.filter((s) => data.networks.some((n) => n.scope === s))
  );

  let ranked = $derived.by(() => {
    const filtered =
      activeScope === 'all' ? data.networks : data.networks.filter((n) => n.scope === activeScope);
    const sign = dir === 'asc' ? 1 : -1;
    const rows = filtered.map((n) => ({ network: n, value: metric.get(n, liveById[n.id]) }));
    // Nullish values (network lacks the spec / no live data yet) always sink to
    // the bottom regardless of direction; ties break by name.
    rows.sort((a, b) => {
      if (a.value == null && b.value == null) return a.network.name.localeCompare(b.network.name);
      if (a.value == null) return 1;
      if (b.value == null) return -1;
      return sign * (a.value - b.value) || a.network.name.localeCompare(b.network.name);
    });
    return rows;
  });
</script>

<Seo
  title={m.nr_seo_title({ label: networkMetricLabel(metric.id) })}
  description={m.nr_seo_desc({
    label: networkMetricLabel(metric.id).toLowerCase(),
    unitPart: networkMetricUnit(metric.id) ? ` (${networkMetricUnit(metric.id)})` : ''
  })}
/>

<BackLink href={href('/networks/')}>{m.collection_networks_label()}</BackLink>

<PageHeader tool="network-rank" subtitleClass="mb-4 max-w-[60ch]">
  {m.nr_subtitle()}
</PageHeader>

<div class="mb-5 flex flex-wrap gap-1.5">
  {#each visibleMetrics as met (met.id)}
    <a
      class="rounded-full border px-2.5 py-1 text-[0.8rem] transition {met.id === metric.id
        ? 'border-accent bg-accent/15 text-accent'
        : 'border-edge bg-elev text-dim hover:border-accent/60 hover:text-ink'}"
      href={href(`/network-rank/${met.id}/`)}
      aria-current={met.id === metric.id ? 'page' : undefined}
    >
      {networkMetricHeading(met.id)}
    </a>
  {/each}
</div>

{#if availableScopes.length}
  <div class="mb-5 flex flex-wrap gap-1.5">
    <button
      class="rounded-full border px-2.5 py-1 text-[0.8rem] transition {activeScope === 'all'
        ? 'border-accent bg-accent/15 text-accent'
        : 'border-edge bg-elev text-dim hover:border-accent/60 hover:text-ink'}"
      onclick={() => (activeScope = 'all')}
    >{m.filter_all()}</button>
    {#each availableScopes as scope (scope)}
      <button
        class="rounded-full border px-2.5 py-1 text-[0.8rem] transition {activeScope === scope
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-edge bg-elev text-dim hover:border-accent/60 hover:text-ink'}"
        onclick={() => (activeScope = scope)}
      >{networkScopeLabel(scope)}</button>
    {/each}
  </div>
{/if}

<div class="overflow-x-auto rounded-xl border border-edge">
  <table class="w-full border-collapse text-[0.9rem]">
    <thead>
      <tr class="text-left text-[0.78rem] tracking-wide text-dim uppercase">
        <th class="w-12 border-b border-edge px-3.5 py-2.5 text-right">#</th>
        <th class="border-b border-edge px-3.5 py-2.5">{m.col_network()}</th>
        <th class="border-b border-edge px-3.5 py-2.5 text-right">
          <Tooltip text={m.nr_toggle_sort()}>
            {#snippet trigger(props)}
              <Button {...props} variant="" size="none" class="gap-1 hover:text-ink" onclick={flipDir}>
                {networkMetricHeading(metric.id)}
                <ArrowUpDown class="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            {/snippet}
          </Tooltip>
        </th>
      </tr>
    </thead>
    <tbody>
      {#each ranked as { network, value }, i (network.id)}
        <tr class="group">
          <td class="border-b border-edge px-3.5 py-2 text-right tabular-nums text-dim">
            {value == null ? '' : i + 1}
          </td>
          <td class="border-b border-edge px-3.5 py-2">
            <a class="flex items-center gap-2.5 hover:text-accent" href={href(`/network/${network.id}/`)}>
              {#each networkFlags(network) as flag (flag.code)}
                <span
                  class="inline-flex h-4 w-6 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-edge/70 [&>svg]:h-full [&>svg]:w-full [&>svg]:object-cover"
                  title={flag.code}
                  aria-hidden="true"
                >
                  {@html flag.svg}
                </span>
              {/each}
              <span class="font-medium">{network.name}</span>
              {#if network.short_name && network.short_name !== network.name}
                <span class="font-mono text-[0.74rem] text-dim">{network.short_name}</span>
              {/if}
              {#if network.scope}
                <span class="rounded-md px-2 py-0.5 text-[0.62rem] font-bold tracking-wide uppercase {NETWORK_SCOPE_META[network.scope]?.tw ?? 'bg-elev2 text-dim'}">
                  {networkScopeLabel(network.scope)}
                </span>
              {/if}
              {#if isAppPresetNetwork(network)}
                <AppPresetBadge />
              {/if}
            </a>
          </td>
          <td class="border-b border-edge px-3.5 py-2 text-right font-semibold tabular-nums">
            {#if value == null}
              <span class="text-dim">—</span>
            {:else}
              {metric.fmt(value)}{networkMetricUnit(metric.id) ? ` ${networkMetricUnit(metric.id)}` : ''}
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

{#if !ranked.length}
  <p class="mt-4 rounded-xl border border-edge bg-elev p-8 text-center text-dim">{m.nr_empty()}</p>
{/if}
