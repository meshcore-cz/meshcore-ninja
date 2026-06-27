<script>
  import Seo from '$lib/Seo.svelte';
  import DeviceList from '$lib/DeviceList.svelte';
  let { data } = $props();
</script>

<Seo
  title="Devices"
  description={`Browse ${data.devices.length} LoRa devices known to run MeshCore — filter by MCU, radio, node role, connectivity, price and more.`}
/>

<DeviceList devices={data.devices} />
