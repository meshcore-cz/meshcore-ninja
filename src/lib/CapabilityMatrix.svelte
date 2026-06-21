<script module>
  // Grouped capability definitions: [dataKey, label] per item, in display order.
  // Exported so a future firmware-compare view can reuse the same labels/order.
  export const CAPABILITY_GROUPS = [
    {
      key: 'transports',
      label: 'Transports',
      items: [
        ['ble', 'BLE'],
        ['usbSerial', 'USB serial'],
        ['nativeTcp', 'Native TCP'],
        ['wifiAp', 'Wi-Fi AP'],
        ['ethernet', 'Ethernet']
      ]
    },
    {
      key: 'operations',
      label: 'Operations',
      items: [
        ['webFlasher', 'Web flasher'],
        ['ota', 'OTA updates'],
        ['bleDfu', 'BLE DFU'],
        ['configurationBackup', 'Config backup']
      ]
    },
    {
      key: 'networking',
      label: 'Networking',
      items: [
        ['repeater', 'Repeater'],
        ['roomServer', 'Room server'],
        ['observer', 'Observer'],
        ['mqtt', 'MQTT'],
        ['kissModem', 'KISS modem']
      ]
    },
    {
      key: 'hardware',
      label: 'Hardware',
      items: [
        ['gps', 'GPS'],
        ['display', 'Display'],
        ['sensors', 'Sensors'],
        ['lowPowerRx', 'Low-power RX']
      ]
    },
    {
      key: 'protocol',
      label: 'Protocol',
      items: [
        ['meshcoreCompatible', 'MeshCore compatible'],
        ['rawPacketSend', 'Raw packet send'],
        ['rawPacketObserve', 'Raw packet observe']
      ]
    }
  ];
</script>

<script>
  let { capabilities = {} } = $props();

  // Keep only groups that have at least one documented (non-undefined) value,
  // and within each group only the documented items — so sparsely-filled
  // firmwares don't render rows of "unknown".
  let groups = $derived(
    CAPABILITY_GROUPS.map((g) => {
      const section = capabilities?.[g.key] ?? {};
      const items = g.items
        .filter(([k]) => section[k] !== undefined)
        .map(([k, label]) => ({ label, on: section[k] === true }));
      return { label: g.label, items };
    }).filter((g) => g.items.length)
  );
</script>

{#if groups.length}
  <div class="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
    {#each groups as g (g.label)}
      <div class="rounded-xl border border-edge bg-elev p-3.5">
        <h3 class="mb-2 text-[0.72rem] font-semibold tracking-wide text-dim uppercase">{g.label}</h3>
        <ul class="flex flex-col gap-1.5">
          {#each g.items as item (item.label)}
            <li class="flex items-center gap-2 text-[0.88rem] {item.on ? '' : 'text-dim'}">
              {#if item.on}
                <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ok/15 text-[0.7rem] text-ok">✓</span>
              {:else}
                <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-elev2 text-[0.7rem] text-muted">✕</span>
              {/if}
              <span>{item.label}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </div>
{/if}
