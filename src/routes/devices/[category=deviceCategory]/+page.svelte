<script>
  import Seo from '$lib/Seo.svelte';
  import DeviceList from '$lib/DeviceList.svelte';
  let { data } = $props();

  const LABELS = {
    'development-board': 'Development boards',
    'companion-radio': 'Companion radios',
    standalone: 'Standalone handhelds',
    tracker: 'Trackers',
    repeater: 'Repeaters & base stations',
    other: 'Other'
  };
  let label = $derived(LABELS[data.category] ?? 'Devices');
  let count = $derived(data.devices.filter((d) => d.category === data.category).length);
</script>

<Seo
  title="{label} — Devices"
  description={`${count} ${label} known to run MeshCore — filter by MCU, radio, node role, connectivity, price and more.`}
/>

<DeviceList devices={data.devices} activeCategory={data.category} />
