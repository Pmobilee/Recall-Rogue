<script lang="ts">
  /** Pre-computed firefly positions — static, generated once */
  const fireflies = Array.from({ length: 20 }, (_, i) => ({
    x: Math.round((7 + i * 47 + (i * i * 13) % 86) % 100),
    y: Math.round((11 + i * 37 + (i * i * 7) % 79) % 100),
    size: 2 + (i % 3),
    delay: Math.round(((i * 1.7) % 8) * 10) / 10,
    dur: 5 + Math.round(((i * 2.3) % 6) * 10) / 10,
  }))
</script>

<div class="firefly-bg" aria-hidden="true">
  {#each fireflies as fly, i (i)}
    <div
      class="firefly"
      style="left: {fly.x}%; top: {fly.y}%; width: {fly.size}px; height: {fly.size}px; animation-delay: {fly.delay}s; animation-duration: {fly.dur}s;"
    ></div>
  {/each}
</div>

<style>
  .firefly-bg {
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background: #000;
    overflow: hidden;
  }

  .firefly {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 220, 120, 0.7);
    box-shadow: 0 0 6px 2px rgba(255, 220, 120, 0.4);
    animation: firefly-drift ease-in-out infinite;
  }

  @keyframes firefly-drift {
    0%, 100% {
      transform: translate(0, 0);
      opacity: 0.15;
    }
    20% {
      transform: translate(8px, -18px);
      opacity: 0.7;
    }
    45% {
      transform: translate(-6px, -35px);
      opacity: 0.3;
    }
    70% {
      transform: translate(12px, -12px);
      opacity: 0.85;
    }
    90% {
      transform: translate(-3px, -25px);
      opacity: 0.4;
    }
  }

  @media (max-width: 499px) {
    .firefly-bg {
      display: none;
    }
  }
</style>
