<script module>
  // Survives across client navigations (instance state would reset every mount).
  // The first mount in a session is the prerendered page hydrating — render
  // everything so the HTML matches and SEO stays intact; later mounts are
  // client-side navigations, where we progressively reveal cards to avoid one
  // long render task on slower phones.
  let warmedUp = false;
</script>

<script>
  // Shared software catalogue: search box, kind-filter chips and the grouped
  // card grid. `activeKind` comes from the route (/software/ or /software/<kind>/)
  // so each filtered view is its own prerendered page — no post-hydration flicker.
  // The free-text query stays client-side and is mirrored to `?q=`.
  import { href } from '$lib/i18n.js';
  import { m } from '$lib/paraglide/messages.js';
  import { SOFTWARE_KIND_META, softwareKindsInUse, LICENSE_TYPE_META, licenseType, descriptionToPlain, softwareKindLabel, licenseTypeLabel } from '$lib/data.js';
  import { displayVersion, relativeTime, fullDateTime, releaseFreshnessTone } from '$lib/format.js';
  import PageHeader from '$lib/PageHeader.svelte';
  import ToolLink from '$lib/ToolLink.svelte';
  import Card from '$lib/Card.svelte';
  import SoftwareIcon from '$lib/SoftwareIcon.svelte';
  import SpriteIcon from '$lib/SpriteIcon.svelte';
  import PlatformIcon from '$lib/PlatformIcon.svelte';
  import ProgrammingLanguageIcon from '$lib/ProgrammingLanguageIcon.svelte';
  import { uniquePlatformsForIcons, platformMeta } from '$lib/platforms.js';
  import { programmingLanguageLabel } from '$lib/programming-languages.js';
  import { onMount, untrack } from 'svelte';
  import { browser } from '$app/environment';

  let { software, activeKind = 'all' } = $props();

  const kinds = softwareKindsInUse();

  // Free-text query is mirrored to `?q=`. It starts empty so the first client
  // render matches the prerendered HTML; the URL is read in onMount, after
  // hydration — reading it at init would diverge and corrupt hydration.
  let query = $state('');
  let hydrated = $state(false);

  // How many cards to mount. Starts unbounded on a cold/hydrating page (so the
  // prerendered HTML is complete); a warm client navigation starts windowed and
  // grows as the sentinel scrolls into view.
  const PAGE = 24;
  let limit = $state(warmedUp ? PAGE : Infinity);
  let sentinel = $state(null);

  onMount(() => {
    query = new URLSearchParams(location.search).get('q') ?? '';
    hydrated = true;
    warmedUp = true;
  });

  // Reset the window whenever the visible set changes (route filter or query),
  // but never below what a cold page already rendered. `limit` is read/written
  // untracked so this can't form a loop with the grow-on-scroll effect below.
  $effect(() => {
    activeKind;
    query;
    untrack(() => {
      if (limit !== Infinity) limit = PAGE;
    });
  });

  // Grow the window when the bottom sentinel approaches the viewport. An idle
  // fallback eventually mounts the rest so in-page find (Ctrl+F) still works.
  $effect(() => {
    if (!browser || !sentinel) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) limit += PAGE;
      },
      { rootMargin: '600px' }
    );
    io.observe(sentinel);
    const ric = (window.requestIdleCallback ?? ((cb) => setTimeout(cb, 800)))(() => {
      limit = Infinity;
    });
    return () => {
      io.disconnect();
      (window.cancelIdleCallback ?? clearTimeout)(ric);
    };
  });

  $effect(() => {
    if (!browser || !hydrated) return;
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    const qs = p.toString();
    history.replaceState(history.state, '', qs ? `${location.pathname}?${qs}` : location.pathname);
  });

  // Compact star count: 1240 → "1.2k", 980 → "980".
  function fmtStars(n) {
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  // Lowercased searchable blob per item; matches name, aliases, description,
  // tags, languages, platforms and maintainers — same fields as the Cmd+K index.
  function searchText(s) {
    return [
      s.name,
      s.short_name,
      ...(s.also_known_as ?? []),
      descriptionToPlain(s.description),
      ...(s.tags ?? []),
      ...(s.languages ?? []),
      ...(s.platforms ?? []),
      ...(s.maintainers ?? []).map((m) => m.name)
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function softwareStars(s) {
    return s.popularity?.githubStars ?? -1;
  }

  // Search blobs are built once per software set (per navigation), not per
  // keystroke — so typing only does cheap `includes()` lookups.
  let searchIndex = $derived(new Map(software.map((s) => [s.id, searchText(s)])));

  let filtered = $derived(
    software.filter((s) => {
      if (activeKind !== 'all' && s.kind !== activeKind) return false;
      const q = query.trim().toLowerCase();
      return !q || (searchIndex.get(s.id) ?? '').includes(q);
    })
  );

  let groups = $derived(
    kinds
      .map((k) => ({
        kind: k,
        meta: SOFTWARE_KIND_META[k],
        items: filtered.filter((s) => s.kind === k).sort((a, b) => softwareStars(b) - softwareStars(a))
      }))
      .filter((g) => g.items.length)
  );

  // A search query collapses the per-kind sections into a single flat,
  // star-ranked grid of matches; without one the grouped view stays.
  let collapsed = $derived(query.trim().length > 0);
  let flatSorted = $derived([...filtered].sort((a, b) => softwareStars(b) - softwareStars(a)));

  // Apply the progressive-mount window. Groups are filled in order against one
  // shared budget so the sections reveal top-to-bottom; `more` gates the
  // scroll sentinel.
  let visibleFlat = $derived(flatSorted.slice(0, limit));
  let visibleGroups = $derived.by(() => {
    let remaining = limit;
    const out = [];
    for (const g of groups) {
      if (remaining <= 0) break;
      const items = g.items.slice(0, remaining);
      remaining -= items.length;
      out.push({ ...g, items, total: g.items.length });
    }
    return out;
  });
  let more = $derived(limit < filtered.length);
</script>

<PageHeader collection="software" subtitleClass="max-w-[75ch]">
  {#snippet actions()}
    <ToolLink id="releases" to="/releases/?kind=software" />
    <ToolLink id="languages" />
  {/snippet}
  {m.sw_list_subtitle()}
</PageHeader>

<!-- Kind filter — links so each view is its own prerendered route. -->
<div class="mb-3 flex flex-wrap gap-1.5">
  <a
    href={href('/software/')}
    class="rounded-md border px-2.5 py-1 text-[0.78rem] font-medium transition {activeKind === 'all'
      ? 'border-accent bg-accent/15 text-accent'
      : 'border-edge text-dim hover:text-ink'}"
  >{m.filter_all()} <span class="text-dim">({software.length})</span></a>
  {#each kinds as k (k)}
    <a
      href={href(`/software/${k}/`)}
      class="rounded-md border px-2.5 py-1 text-[0.78rem] font-medium transition {activeKind === k
        ? 'border-accent bg-accent/15 text-accent'
        : 'border-edge text-dim hover:text-ink'}"
    >{softwareKindLabel(k)}</a>
  {/each}
</div>

<!-- Search -->
<input
  type="search"
  placeholder={m.sw_list_search()}
  bind:value={query}
  class="mb-7 w-full rounded-lg border border-edge bg-bg px-3 py-2.5 text-[0.95rem] outline-none focus:border-transparent focus:ring-2 focus:ring-accent"
/>

{#snippet swCard(s)}
  {@const licensing = licenseType(s)}
  {@const isLibrary = s.kind === 'library'}
          <Card href={href(`/software/${s.id}/`)} class="sw-card flex flex-col p-4">
            <div class="flex items-start justify-between gap-2">
              <span class="flex min-w-0 gap-2">
                <SoftwareIcon
                  src={s.imageUrl}
                  name={s.name}
                  kind={s.kind}
                  class="h-10 w-10 rounded-md"
                />
                <span class="min-w-0">
                  <span class="font-semibold group-hover:text-accent">{s.name}</span>
                  {#if s.short_name && s.short_name !== s.name}
                    <span class="block font-mono text-[0.74rem] text-dim">{s.short_name}</span>
                  {/if}
                </span>
              </span>
              <span class="flex shrink-0 flex-col items-end gap-1">
                <!-- Libraries & SDKs are an exception: they surface the concrete
                     license and the programming languages, where other kinds show
                     the licensing class and the platforms. -->
                {#if isLibrary && s.license}
                  <span class="rounded-md px-1.5 py-0.5 text-[0.6rem] font-medium whitespace-nowrap {LICENSE_TYPE_META[licensing]?.tw ?? 'bg-elev2 text-dim'}" title={licenseTypeLabel(licensing)}>
                    {s.license}
                  </span>
                {:else if licensing}
                  <span class="rounded-md px-1.5 py-0.5 text-[0.6rem] font-medium whitespace-nowrap {LICENSE_TYPE_META[licensing]?.tw ?? ''}">
                    {licenseTypeLabel(licensing)}
                  </span>
                {/if}
                {#if isLibrary}
                  {#if s.languages?.length}
                    <span class="flex flex-wrap justify-end gap-1.5">
                      {#each s.languages.slice(0, 3) as l (l)}
                        <ProgrammingLanguageIcon language={l} size={16} />
                      {/each}
                      {#if s.languages.length > 3}
                        <span class="self-center font-mono text-[0.6rem] text-dim" title={s.languages.map((l) => programmingLanguageLabel(l)).join(', ')}>+{s.languages.length - 3}</span>
                      {/if}
                    </span>
                  {/if}
                {:else if s.platforms?.length}
                  {@const iconPlatforms = uniquePlatformsForIcons(s.platforms)}
                  <span class="flex flex-wrap justify-end gap-1.5">
                    {#each iconPlatforms.slice(0, 3) as p (p)}
                      <PlatformIcon platform={p} class="opacity-75" />
                    {/each}
                    {#if iconPlatforms.length > 3}
                      <span class="self-center font-mono text-[0.6rem] text-dim" title={s.platforms.map((p) => platformMeta(p).label).join(', ')}>+{iconPlatforms.length - 3}</span>
                    {/if}
                  </span>
                {/if}
              </span>
            </div>
            {#if s.description}
              <p class="mt-1.5 line-clamp-3 text-[0.85rem] text-dim">{descriptionToPlain(s.description)}</p>
            {/if}
            {#if s.tags?.length}
              <div class="my-2.5 flex flex-wrap gap-1">
                {#each s.tags as t (t)}
                  <span class="rounded-full bg-elev2 px-1.5 py-0.5 font-mono text-[0.66rem] text-dim">#{t}</span>
                {/each}
              </div>
            {/if}

            <!-- Popularity / freshness footer: stars, latest version + when, and
                 the lead maintainer. Each piece is optional, so the row hides
                 entirely when a record has none of them. -->
            {@const stars = s.popularity?.githubStars}
            {@const author = s.maintainers?.[0]?.name}
            {#if stars != null || s.latest_version || author}
              <div class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-edge/60 pt-2.5 text-[0.72rem] text-dim">
                {#if stars != null}
                  <span class="inline-flex items-center gap-1" title="{stars.toLocaleString()} GitHub stars">
                    <SpriteIcon id="ui-star" size={14} class="text-warn" />
                    <span class="tabular-nums">{fmtStars(stars)}</span>
                  </span>
                {/if}
                {#if s.latest_version}
                  <span class="inline-flex items-center gap-1" title={s.released ? `Released ${fullDateTime(s.released)}` : ''}>
                    <span class="font-mono text-ink/80">{displayVersion(s.latest_version)}</span>
                    {#if s.released}<span class="text-dim/80">· <span class={releaseFreshnessTone(s.released)}>{relativeTime(s.released)}</span></span>{/if}
                  </span>
                {/if}
                {#if author}
                  <span class="inline-flex min-w-0 items-center gap-1">
                    <SpriteIcon id="ui-user" size={14} class="shrink-0" />
                    <span class="truncate">{author}{s.maintainers.length > 1 ? ` +${s.maintainers.length - 1}` : ''}</span>
                  </span>
                {/if}
              </div>
            {/if}
          </Card>
{/snippet}

{#snippet cardGrid(items)}
  <div class="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
    {#each items as s (s.id)}
      {@render swCard(s)}
    {/each}
  </div>
{/snippet}

{#if !filtered.length}
  <p class="text-dim">{m.sw_list_empty()}</p>
{:else if collapsed}
  {@render cardGrid(visibleFlat)}
{:else}
  {#each visibleGroups as g (g.kind)}
    <section class="mb-9">
      <h2 class="mb-3 flex items-baseline gap-2 border-b border-edge pb-1.5 text-[1.1rem] font-semibold">
        {softwareKindLabel(g.kind)}
        <span class="text-[0.85rem] font-normal text-dim">{g.total}</span>
      </h2>
      {@render cardGrid(g.items)}
    </section>
  {/each}
{/if}

<!-- Grows the mounted-card window as it nears the viewport (warm client navs). -->
{#if more}
  <div bind:this={sentinel} aria-hidden="true" class="h-px w-full"></div>
{/if}

<style>
  /* Skip layout/paint for off-screen cards; the reserved size keeps the
     scrollbar honest before a card is rendered. */
  :global(.sw-card) {
    content-visibility: auto;
    contain-intrinsic-size: auto 13rem;
  }
</style>
