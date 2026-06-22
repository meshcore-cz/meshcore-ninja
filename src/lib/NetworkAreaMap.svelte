<script>
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import 'leaflet/dist/leaflet.css';

  let { networks = [] } = $props();

  let mapEl = $state(null);
  let status = $state('');
  // The map stays hidden behind a loading overlay until every area's GeoJSON
  // has been fetched (one combined request) and drawn.
  let loaded = $state(false);
  let hasAreas = $derived(networks.some((n) => n.areaUrl));

  // Fullscreen pins the map below the sticky site header (which stays visible)
  // and fills the rest of the viewport. headerH tracks the header's height so
  // the map starts right beneath it regardless of how the header wraps.
  let fullscreen = $state(false);
  let headerH = $state(0);

  function toggleFullscreen() {
    fullscreen = !fullscreen;
    const header = document.querySelector('header');
    headerH = header ? header.offsetHeight : 0;
    document.body.style.overflow = fullscreen ? 'hidden' : '';
    // The map element's own class is static (Leaflet adds .leaflet-container
    // and friends to it at runtime, and a reactive class would wipe them); the
    // size lives on the wrapper instead. A ResizeObserver (set up in init)
    // re-invalidates Leaflet whenever that wrapper resizes.
  }

  function onWindowKeydown(e) {
    if (e.key === 'Escape' && fullscreen) toggleFullscreen();
  }

  const COLORS = ['#4dd0a7', '#5aa9ff', '#d29922', '#f85149', '#a78bfa', '#f97316'];

  onMount(() => {
    if (!mapEl || !hasAreas) return;

    let disposed = false;
    let map;
    let baseLayer;
    let observer;
    let resizeObserver;

    async function init() {
      let L;
      try {
        const leaflet = await import('leaflet');
        L = leaflet.default ?? leaflet;
      } catch (e) {
        status = `Could not start map: ${e.message}`;
        return;
      }
      if (disposed || !mapEl) return;

      try {
        map = L.map(mapEl, {
          fadeAnimation: false,
          markerZoomAnimation: false,
          scrollWheelZoom: false,
          zoomAnimation: false,
          worldCopyJump: true
        })
        map.on('click dragstart', enableWheelZoom);

        setBaseLayer(L);
        observer = new MutationObserver(() => setBaseLayer(L));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        // Whenever the container's box changes (fullscreen toggle, header wrap,
        // window resize), Leaflet must recompute its size and reload tiles for
        // the new viewport — otherwise the base tile layer goes blank.
        let firstResize = true;
        resizeObserver = new ResizeObserver(() => {
          // Skip the initial observe callback (map is already sized) to avoid a
          // redundant invalidate before any tiles have loaded.
          if (firstResize) {
            firstResize = false;
            return;
          }
          map?.invalidateSize();
        });
        resizeObserver.observe(mapEl);
      } catch (e) {
        status = `Could not start map: ${e.message}`;
        return;
      }

      // Every area arrives in one combined FeatureCollection (built by
      // scripts/build-data.js), so we fetch once and regroup features by their
      // networkId tag instead of issuing a request per network.
      let byNetwork = new Map();
      try {
        const res = await fetch(`${base}/network-area/all.geojson`);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const all = await res.json();
        if (disposed || !map) return;
        for (const feature of all.features ?? []) {
          const id = feature.properties?.networkId;
          if (!id) continue;
          if (!byNetwork.has(id)) byNetwork.set(id, []);
          byNetwork.get(id).push(feature);
        }
      } catch (e) {
        status = `Could not load network areas: ${e.message}`;
        loaded = true;
        return;
      }

      const bounds = L.latLngBounds([]);
      // Draw largest areas first so smaller networks end up on top and stay
      // hoverable/clickable even when they sit inside a bigger one's polygon.
      const areaNetworks = networks
        .filter((n) => n.areaUrl && byNetwork.has(n.id))
        .sort((a, b) => (b.areaKm2 ?? 0) - (a.areaKm2 ?? 0));

      for (const [index, network] of areaNetworks.entries()) {
        const geojson = { type: 'FeatureCollection', features: byNetwork.get(network.id) };

        const color = COLORS[index % COLORS.length];
        const layer = L.geoJSON(geojson, {
          style: {
            color,
            weight: 1,
            opacity: 0.5,
            fillColor: color,
            fillOpacity: 0.18
          },
          onEachFeature: (_feature, featureLayer) => {
            featureLayer.bindPopup(
              `<strong>${escapeHtml(network.name)}</strong><br><a href="${base}/network/${network.id}/">Open network</a>`
            );
          }
        }).addTo(map);

        // Dim boundary by default; reveal it fully while hovering the area.
        layer.on({
          mouseover: () => layer.setStyle({ opacity: 1 }),
          mouseout: () => layer.setStyle({ opacity: 0.5 })
        });

        const layerBounds = layer.getBounds();
        if (layerBounds.isValid()) bounds.extend(layerBounds);
      }

      if (bounds.isValid()) {
        if (areaNetworks.length >= 3) {
          map.setView([30, 0], 2);
        } else {
          map.fitBounds(bounds.pad(0.18), { maxZoom: 7 });
        }
      } else {
        status = 'No valid network area shapes found yet.';
      }

      // Areas are drawn and the view is framed — reveal the map.
      loaded = true;
    }

    init();

    return () => {
      disposed = true;
      observer?.disconnect();
      resizeObserver?.disconnect();
      map?.remove();
      document.body.style.overflow = '';
    };

    function setBaseLayer(L) {
      if (!map) return;
      const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
      const tiles =
        theme === 'light'
          ? {
              url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
              key: 'carto-voyager'
            }
          : {
              url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
              key: 'carto-dark-matter'
            };

      if (baseLayer?.options?.atlasKey === tiles.key) return;
      if (baseLayer) map.removeLayer(baseLayer);

      baseLayer = L.tileLayer(tiles.url, {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
        atlasKey: tiles.key
      }).addTo(map);
    }

    function enableWheelZoom() {
      if (!map) return;
      map.scrollWheelZoom.enable();
      map.off('click dragstart', enableWheelZoom);
    }
  });

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if hasAreas}
  <section
    class="overflow-hidden border border-edge bg-elev {fullscreen
      ? 'fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-none border-x-0 border-b-0'
      : 'mb-6 rounded-xl xl:relative xl:left-1/2 xl:w-[min(1600px,94vw)] xl:max-w-none xl:-translate-x-1/2'}"
    style={fullscreen ? `top:${headerH}px` : ''}
  >
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-4 py-3">
      <div>
        <h2 class="text-[1.05rem] font-semibold">Network areas</h2>
        <p class="text-[0.82rem] text-dim">Published coverage/coordination shapes from network records.</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="rounded-md bg-elev2 px-2 py-1 text-[0.72rem] text-dim">
          {networks.filter((n) => n.areaUrl).length} shaped
        </span>
        <button
          type="button"
          onclick={toggleFullscreen}
          aria-label={fullscreen ? 'Exit full screen' : 'Full screen map'}
          title={fullscreen ? 'Exit full screen (Esc)' : 'Full screen'}
          class="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-edge text-dim hover:border-accent hover:text-ink"
        >
          {#if fullscreen}
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M9 4v3a2 2 0 0 1-2 2H4M20 9h-3a2 2 0 0 1-2-2V4M15 20v-3a2 2 0 0 1 2-2h3M4 15h3a2 2 0 0 1 2 2v3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          {:else}
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M4 9V6a2 2 0 0 1 2-2h3M20 9V6a2 2 0 0 0-2-2h-3M4 15v3a2 2 0 0 0 2 2h3M20 15v3a2 2 0 0 1-2 2h-3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          {/if}
        </button>
      </div>
    </div>
    <!-- Size lives on this wrapper; the inner map element keeps a STATIC class
         so Svelte never rewrites it and clobbers Leaflet's runtime classes. -->
    <div
      class={'relative ' +
        (fullscreen
          ? 'min-h-0 flex-1'
          : 'h-[360px] md:h-[430px] xl:h-[560px] 2xl:h-[640px]')}
    >
      <div bind:this={mapEl} class="network-area-map bg-bg h-full"></div>
      {#if !loaded}
        <!-- Covers the map (incl. Leaflet controls at z-index 1000) until every
             area is fetched and drawn, so the user never sees a half-empty map. -->
        <div
          class="absolute inset-0 z-[1100] flex flex-col items-center justify-center gap-3 bg-bg"
        >
          <span class="map-spinner" aria-hidden="true"></span>
          <p class="text-[0.82rem] text-dim">Loading network areas…</p>
        </div>
      {/if}
    </div>
    {#if status}
      <p class="border-t border-edge px-4 py-2 text-[0.82rem] text-warn">{status}</p>
    {/if}
  </section>
{/if}

<style>
  .network-area-map {
    background: var(--color-bg);
    /* Leaflet's container CSS only sets overflow:hidden, so the element is
       position:static and its absolutely-positioned panes resolve against the
       nearest positioned ancestor. In fullscreen that ancestor is a
       position:fixed section, and Chromium then collapses the transformed tile
       layer to 0 width (the basemap vanishes while the SVG overlay survives).
       Making the container its own positioning context keeps Leaflet's panes
       contained and fixes it. */
    position: relative;
  }

  .map-spinner {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 3px solid var(--color-edge);
    border-top-color: var(--color-accent2);
    animation: map-spin 0.7s linear infinite;
  }

  @keyframes map-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .network-area-map :global(.leaflet-container) {
    background: var(--color-bg);
    color: var(--color-ink);
    font-family: inherit;
  }

  .network-area-map :global(.leaflet-pane),
  .network-area-map :global(.leaflet-tile),
  .network-area-map :global(.leaflet-tile-container),
  .network-area-map :global(.leaflet-overlay-pane svg),
  .network-area-map :global(.leaflet-marker-icon),
  .network-area-map :global(.leaflet-popup),
  .network-area-map :global(.leaflet-zoom-animated),
  .network-area-map :global(.leaflet-fade-anim .leaflet-tile),
  .network-area-map :global(.leaflet-fade-anim .leaflet-popup) {
    animation: none !important;
    transition: none !important;
  }

  .network-area-map :global(.leaflet-tile) {
    opacity: 1 !important;
  }

  /* Smoothly fade a network boundary between its dim and hovered opacity. */
  .network-area-map :global(.leaflet-overlay-pane path) {
    transition: stroke-opacity 0.25s ease;
  }

  .network-area-map :global(.leaflet-control-zoom a),
  .network-area-map :global(.leaflet-control-attribution),
  .network-area-map :global(.leaflet-popup-content-wrapper),
  .network-area-map :global(.leaflet-popup-tip) {
    background: color-mix(in srgb, var(--color-elev) 94%, transparent);
    border-color: var(--color-edge);
    color: var(--color-ink);
  }

  .network-area-map :global(.leaflet-control-zoom) {
    border-color: var(--color-edge);
  }

  .network-area-map :global(.leaflet-control-zoom a) {
    border-bottom-color: var(--color-edge);
  }

  .network-area-map :global(.leaflet-control-zoom a:hover),
  .network-area-map :global(.leaflet-control-attribution a),
  .network-area-map :global(.leaflet-popup-content a) {
    color: var(--color-accent2);
  }

  .network-area-map :global(.leaflet-popup-content) {
    color: var(--color-ink);
  }
</style>
