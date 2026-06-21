<script>
  import { base } from '$app/paths';
  import { STATUS_META, TYPE_META } from '$lib/data.js';
  import Seo from '$lib/Seo.svelte';
  let { data } = $props();
</script>

<Seo
  title="Compatibility Matrix"
  description={`Device × firmware support across ${data.rows.length} devices and ${data.firmwares.length} MeshCore firmwares — at a glance.`}
/>

<h1 class="mb-1 text-[clamp(1.5rem,5vw,2rem)] font-bold">Compatibility matrix</h1>
<p class="mb-4 max-w-[60ch] text-dim">
  Device × firmware support across all {data.rows.length} devices. A dot means no
  firmware lists that board yet. Hover a cell for notes.
</p>

<div class="mb-5 flex flex-wrap gap-2">
  {#each Object.values(STATUS_META) as meta}
    <span class="rounded-full px-2.5 py-0.5 text-[0.78rem] {meta.tw}">{meta.symbol} {meta.label}</span>
  {/each}
</div>

<div class="overflow-x-auto rounded-xl border border-edge">
  <!-- Fixed layout so every firmware column is the same width regardless of name
       length. Firmware names are rotated vertical so columns stay tight; an
       instant CSS tooltip (no native-title delay) shows the full name + type on
       hover, so you don't have to tilt your head. Fills the container when it
       fits; grows past it (scrolling) only when there are enough firmwares. -->
  <table class="table-fixed border-collapse" style="width: max(100%, {180 + data.firmwares.length * 46}px);">
    <thead>
      <tr>
        <th class="w-[180px] border-b border-edge px-3.5 py-2.5 text-left align-bottom text-[0.8rem] text-dim">Device</th>
        {#each data.firmwares as fw}
          <th class="group relative h-[150px] w-[46px] border-b border-l border-edge p-0 text-center align-bottom">
            <a
              class="mx-auto inline-block rotate-180 pb-2.5 text-[0.78rem] leading-[1.05] font-semibold text-accent2 [writing-mode:vertical-rl] hover:underline"
              href="{base}/firmware/{fw.id}/"
            >{fw.name}</a>
            <!-- Instant tooltip, anchored below the header so it isn't clipped
                 by the table's horizontal scroll container. -->
            <span
              class="pointer-events-none absolute top-full left-1/2 z-30 hidden -translate-x-1/2 translate-y-1 rounded-md border border-edge bg-elev2 px-2 py-1 text-[0.72rem] font-medium whitespace-nowrap text-ink shadow-lg group-hover:block"
            >
              {fw.name} · <span class="text-dim">{TYPE_META[fw.type]?.label ?? fw.type}</span>
            </span>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each data.rows as row}
        <tr class="group">
          <th class="sticky left-0 border-b border-edge bg-elev px-3.5 py-1.5 text-left font-medium group-hover:bg-elev2">
            <a class="flex items-center gap-2.5 text-[0.88rem] hover:text-accent" href="{base}/device/{row.device.id}/">
              <span class="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded bg-elev2 p-0.5 text-muted">
                {#if row.device.imageUrl}
                  <img src={row.device.imageUrl} alt="" class="max-h-full max-w-full object-contain" />
                {:else}
                  <svg aria-hidden="true" viewBox="0 0 24 24" class="h-[17px] w-[17px]">
                    <rect x="7" y="4" width="10" height="16" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.8" />
                    <path d="M10 2.8v2.4M14 2.8v2.4M10 18.8v2.4M14 18.8v2.4M5.2 8h2.4M5.2 12h2.4M5.2 16h2.4M16.4 8h2.4M16.4 12h2.4M16.4 16h2.4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.4" />
                  </svg>
                {/if}
              </span>
              <span>{row.device.name}</span>
            </a>
          </th>
          {#each data.firmwares as fw}
            {@const cell = row.cells[fw.id]}
            {@const meta = cell ? STATUS_META[cell.status] : null}
            <td
              class="cursor-default border-b border-l border-edge text-center text-base {meta
                ? meta.cell
                : 'text-edge'}"
              title={cell ? `${meta?.label}${cell.target ? ' · ' + cell.target : ''}${cell.notes ? ' — ' + cell.notes : ''}` : 'No data'}
            >
              {meta ? meta.symbol : '·'}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
