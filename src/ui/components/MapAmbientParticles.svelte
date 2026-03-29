<script lang="ts">
  // =========================================================
  // Props
  // =========================================================

  interface Props {
    segment: 1 | 2 | 3 | 4
  }

  let { segment }: Props = $props()

  // =========================================================
  // Seeded pseudo-random — deterministic per particle index
  // =========================================================

  function seededRandom(i: number, offset: number): number {
    const x = Math.sin(i * 9301 + offset * 49297) * 49297
    return x - Math.floor(x)
  }

  // =========================================================
  // Segment particle colors
  // =========================================================

  const SEGMENT_PARTICLE_COLOR: Record<1 | 2 | 3 | 4, string> = {
    1: 'rgba(255, 180, 80, VAR)',   // warm amber dust motes
    2: 'rgba(140, 180, 255, VAR)',  // cool blue wisps
    3: 'rgba(180, 200, 255, VAR)',  // ice crystal sparkles
    4: 'rgba(180, 120, 255, VAR)',  // arcane purple glyphs
  }

  let particleColor = $derived(SEGMENT_PARTICLE_COLOR[segment])
</script>

<div class="ambient-particles" aria-hidden="true">
  {#each Array(20) as _, i}
    {@const top = seededRandom(i, 1) * 100}
    {@const left = seededRandom(i, 2) * 100}
    {@const size = 3 + seededRandom(i, 3) * 4}
    {@const duration = 8 + seededRandom(i, 4) * 12}
    {@const delay = -(seededRandom(i, 5) * 20)}
    {@const opacity = 0.04 + seededRandom(i, 6) * 0.08}
    <div
      class="particle"
      style="
        top: {top}%;
        left: {left}%;
        width: calc({size}px * var(--layout-scale, 1));
        height: calc({size}px * var(--layout-scale, 1));
        background: {particleColor.replace('VAR', String(opacity))};
        animation-duration: {duration}s;
        animation-delay: {delay}s;
      "
    ></div>
  {/each}
</div>

<style>
  .ambient-particles {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    overflow: hidden;
  }

  .particle {
    position: absolute;
    border-radius: 50%;
    animation: particleFloat linear infinite;
    will-change: transform;
    contain: strict;
  }

  @keyframes particleFloat {
    0% {
      transform: translateY(0) translateX(0);
    }
    25% {
      transform: translateY(calc(-15px * var(--layout-scale, 1))) translateX(calc(8px * var(--layout-scale, 1)));
    }
    50% {
      transform: translateY(calc(-25px * var(--layout-scale, 1))) translateX(calc(-5px * var(--layout-scale, 1)));
    }
    75% {
      transform: translateY(calc(-10px * var(--layout-scale, 1))) translateX(calc(12px * var(--layout-scale, 1)));
    }
    100% {
      transform: translateY(0) translateX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .particle {
      animation: none;
    }
  }
</style>
