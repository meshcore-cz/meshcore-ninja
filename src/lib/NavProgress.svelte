<script>
  // Slim top progress line shown during client-side navigation. SvelteKit
  // renders the next page synchronously, which on slower phones can stall for a
  // beat — this gives immediate "something is happening" feedback so the wait
  // reads as loading, not a frozen tap.
  //
  // A short delay before showing means instant navigations never flash the bar;
  // only the ones slow enough to feel janky get the indicator.
  import { navigating } from '$app/stores';

  let visible = $state(false);

  $effect(() => {
    if (!$navigating) {
      visible = false;
      return;
    }
    const t = setTimeout(() => (visible = true), 120);
    return () => clearTimeout(t);
  });
</script>

{#if visible}
  <div class="nav-progress" role="status" aria-label="Loading">
    <div class="nav-progress-bar"></div>
  </div>
{/if}

<style>
  .nav-progress {
    position: fixed;
    inset: 0 0 auto 0;
    height: 2px;
    z-index: 60;
    overflow: hidden;
    pointer-events: none;
  }
  .nav-progress-bar {
    position: absolute;
    inset: 0 auto 0 0;
    width: 40%;
    border-radius: 0 2px 2px 0;
    background: linear-gradient(90deg, var(--color-accent2), var(--color-accent));
    box-shadow: 0 0 8px var(--color-accent);
    animation: nav-indeterminate 0.9s ease-in-out infinite;
  }
  @keyframes nav-indeterminate {
    0% {
      left: -40%;
    }
    100% {
      left: 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .nav-progress-bar {
      animation-duration: 1.6s;
    }
  }
</style>
