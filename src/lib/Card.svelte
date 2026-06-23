<script>
  // Shared card shell: an anchor with the catalog's border / elevation / hover
  // treatment. Callers supply layout (flex, padding, gap) via `class` and the
  // body via children, so only the repeated chrome lives here. Set `hover` to
  // false to drop the lift-and-highlight (e.g. for non-navigational cards).
  let { href, hover = true, class: extra = '', children, ...rest } = $props();
  const base = 'group rounded-xl border border-edge bg-elev transition';
  const hoverCls = 'hover:-translate-y-0.5 hover:border-accent';
</script>

<a {href} class="{base} {hover ? hoverCls : ''} {extra}" {...rest}>
  {@render children?.()}
</a>
