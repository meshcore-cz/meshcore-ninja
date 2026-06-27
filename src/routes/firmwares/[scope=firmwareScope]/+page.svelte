<script>
  import Seo from '$lib/Seo.svelte';
  import FirmwareList from '$lib/FirmwareList.svelte';
  let { data } = $props();

  const LABELS = {
    universal: 'Universal',
    'platform-specific': 'Platform-specific',
    'function-specific': 'Function-specific',
    'device-specific': 'Device-specific'
  };
  let label = $derived(LABELS[data.scope] ?? 'Firmwares');
  let count = $derived(data.firmwares.filter((fw) => (fw.scope ?? 'device-specific') === data.scope).length);
</script>

<Seo
  title="{label} firmwares"
  description={`${count} ${label} MeshCore firmware${count === 1 ? '' : 's'} — node roles and the devices they run on.`}
/>

<FirmwareList firmwares={data.firmwares} activeScope={data.scope} />
