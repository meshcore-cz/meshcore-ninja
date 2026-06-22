<script>
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import {
    NETWORK_SCOPE_META,
    NETWORK_STATUS_META,
    networkBandLabel,
    networkFlags
  } from '$lib/data.js';
  import NetworkAreaMap from '$lib/NetworkAreaMap.svelte';
  import Seo from '$lib/Seo.svelte';
  import { onMount } from 'svelte';
  import { LIVE_ENABLED, poll, fmtRate } from '$lib/pulse.js';
  let { data } = $props();

  // Live pkt/m per network, polled from the optional API. Keyed by network id;
  // empty (and the column hidden) when no API is configured.
  let liveById = $state({});
  onMount(() =>
    poll('/api/networks', 5000, (res) => {
      const next = {};
      for (const n of res.networks ?? []) next[n.id] = n;
      liveById = next;
    })
  );

  // Whole-row navigation: clicking anywhere on a row opens the network, unless
  // the click landed on a real link/button (let those do their own thing) or
  // the user is selecting text (so text stays selectable/copyable).
  function rowClick(event, id) {
    if (event.target.closest('a, button')) return;
    if (window.getSelection()?.toString()) return;
    goto(`${base}/network/${id}/`);
  }

  const freqLabel = (n) =>
    n.radio?.frequency_mhz != null ? `${n.radio.frequency_mhz} MHz` : networkBandLabel(n);

  // Area shown in thousands of km², e.g. 325 km² → "≈ 0.3k km²".
  const areaLabel = (n) =>
    n.areaKm2 != null ? `≈ ${(n.areaKm2 / 1000).toFixed(1)}k km²` : null;

  // Per-column sort value accessors. Strings sort case-insensitively; nullish
  // (or empty) values always sink to the bottom regardless of direction.
  const SORT_ACCESSORS = {
    name: (n) => n.name?.toLowerCase() ?? '',
    scope: (n) => NETWORK_SCOPE_META[n.scope]?.label ?? n.scope ?? '',
    area: (n) => n.areaKm2,
    frequency: (n) => n.radio?.frequency_mhz ?? null,
    live: (n) => liveById[n.id]?.pktPerMin ?? null,
    nodes: (n) => liveById[n.id]?.nodes ?? null,
    observers: (n) => liveById[n.id]?.observers ?? null,
    status: (n) => NETWORK_STATUS_META[n.status]?.label ?? n.status ?? ''
  };

  // Default to largest coverage area first, matching the page's prior ordering.
  let sortKey = $state('area');
  let sortDir = $state('desc');

  function toggleSort(key) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      // Text columns read best A→Z; numeric columns biggest-first.
      sortDir = typeof SORT_ACCESSORS[key](data.networks[0]) === 'string' ? 'asc' : 'desc';
    }
  }

  let sortedNetworks = $derived.by(() => {
    const get = SORT_ACCESSORS[sortKey];
    const dir = sortDir === 'asc' ? 1 : -1;
    const empty = (v) => v == null || v === '';
    return [...data.networks].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (empty(va) && empty(vb)) return 0;
      if (empty(va)) return 1;
      if (empty(vb)) return -1;
      if (typeof va === 'string') return dir * va.localeCompare(vb);
      return dir * (va - vb);
    });
  });
</script>

<Seo
  title="Networks"
  description={`${data.networks.length} organized MeshCore meshes — their radio settings, coverage and how to join.`}
/>

<h1 class="mb-1 text-[clamp(1.5rem,5vw,2rem)] font-bold">Networks</h1>
<p class="mb-5 text-dim">
  Organized regional and national MeshCore meshes — their radio settings, coverage and how to
  join.
</p>

{#if data.networks.length}
  <NetworkAreaMap networks={data.networks} />

  {#snippet sortTh(key, label, alignRight = false, title = null)}
    <th
      class="border-b border-edge px-3.5 py-2.5 {alignRight ? 'text-right' : ''}"
      aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        class="inline-flex items-center gap-1 tracking-wide uppercase hover:text-ink {alignRight ? 'flex-row-reverse' : ''} {sortKey === key ? 'text-ink' : ''}"
        onclick={() => toggleSort(key)}
        {title}
      >
        <span>{label}</span>
        <span class="text-[0.7em] {sortKey === key ? 'text-accent' : 'opacity-30'}" aria-hidden="true">
          {sortKey === key && sortDir === 'asc' ? '▲' : '▼'}
        </span>
      </button>
    </th>
  {/snippet}

  <div class="overflow-x-auto rounded-xl border border-edge">
    <table class="w-full border-collapse text-[0.9rem]">
      <thead>
        <tr class="text-left text-[0.78rem] tracking-wide text-dim uppercase">
          {@render sortTh('name', 'Network')}
          {@render sortTh('scope', 'Scope')}
          {@render sortTh('area', 'Area', true)}
          {@render sortTh('frequency', 'Frequency')}
          {#if LIVE_ENABLED}
            {@render sortTh('live', 'pkt/m', true, "Unique packets in the last minute, seen by this network's analyzers (live)")}
            {@render sortTh('nodes', 'Nds', true, 'Distinct mesh nodes seen recently across this network (live)')}
            {@render sortTh('observers', 'Obs', true, 'Distinct observer nodes reporting to this network (live)')}
          {/if}
          {@render sortTh('status', 'Status')}
        </tr>
      </thead>
      <tbody>
        {#each sortedNetworks as n (n.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <tr class="group cursor-pointer hover:bg-elev" onclick={(e) => rowClick(e, n.id)}>
            <td class="border-b border-edge px-3.5 py-2.5">
              <a class="flex items-center gap-2.5 font-medium group-hover:text-accent" href="{base}/network/{n.id}/">
                {#each networkFlags(n) as flag (flag.code)}
                  <span
                    class="inline-flex h-4 w-6 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-edge/70 [&>svg]:h-full [&>svg]:w-full [&>svg]:object-cover"
                    title={flag.code}
                    aria-hidden="true"
                  >
                    {@html flag.svg}
                  </span>
                {/each}
                <span>{n.name}</span>
                {#if n.short_name && n.short_name !== n.name}
                  <span class="font-mono text-[0.74rem] text-dim">{n.short_name}</span>
                {/if}
              </a>
            </td>
            <td class="border-b border-edge px-3.5 py-2.5">
              {#if n.scope}
                <span class="rounded-md px-2 py-0.5 text-[0.68rem] font-bold tracking-wide uppercase {NETWORK_SCOPE_META[n.scope]?.tw ?? 'bg-elev2 text-dim'}">
                  {NETWORK_SCOPE_META[n.scope]?.label ?? n.scope}
                </span>
              {/if}
            </td>
            <td class="border-b border-edge px-3.5 py-2.5 text-right font-mono text-[0.82rem] tabular-nums whitespace-nowrap text-dim">
              {areaLabel(n) ?? '—'}
            </td>
            <td class="border-b border-edge px-3.5 py-2.5 font-mono text-[0.82rem] tabular-nums">
              {freqLabel(n) ?? '—'}
            </td>
            {#if LIVE_ENABLED}
              <td class="border-b border-edge px-3.5 py-2.5 text-right font-mono text-[0.82rem] tabular-nums whitespace-nowrap">
                {#if liveById[n.id]}
                  {@const live = liveById[n.id]}
                  <span
                    class={live.analyzersConnected ? 'text-accent' : 'text-dim'}
                    title="{live.analyzersConnected}/{live.analyzersTotal} analyzers connected · {live.observers} observers"
                  >{fmtRate(live.pktPerMin)}</span>
                {:else}
                  <span class="text-dim">—</span>
                {/if}
              </td>
              <td class="border-b border-edge px-3.5 py-2.5 text-right font-mono text-[0.82rem] tabular-nums whitespace-nowrap">
                {#if liveById[n.id]}
                  {liveById[n.id].nodes.toLocaleString()}
                {:else}
                  <span class="text-dim">—</span>
                {/if}
              </td>
              <td class="border-b border-edge px-3.5 py-2.5 text-right font-mono text-[0.82rem] tabular-nums whitespace-nowrap">
                {#if liveById[n.id]}
                  {liveById[n.id].observers.toLocaleString()}
                {:else}
                  <span class="text-dim">—</span>
                {/if}
              </td>
            {/if}
            <td class="border-b border-edge px-3.5 py-2.5">
              {#if n.status}
                <span class="text-[0.85rem] font-medium {NETWORK_STATUS_META[n.status]?.tw ?? 'text-dim'}">
                  {NETWORK_STATUS_META[n.status]?.label ?? n.status}
                </span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <p class="text-dim">No networks recorded yet.</p>
{/if}
