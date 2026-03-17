<script lang="ts">
  import { isLandscape } from '../../stores/layoutStore'

  interface Props {
    streak: number
    dustBalance: number
    hasActiveRunBanner?: boolean
  }

  let { streak, dustBalance, hasActiveRunBanner = false }: Props = $props()
</script>

<!-- In landscape, this component is rendered inside .hub-center (position: relative),
     so left/right: 0 constrains it to the center column automatically.
     No viewport-spanning occurs — positioning is correct in both modes. -->
<div class="hud-overlay" class:banner-offset={hasActiveRunBanner} class:landscape={$isLandscape} aria-label="Camp HUD">
  <div class="hud-pill hud-left">
    <span class="hud-icon">&#x1F525;</span>
    <span class="hud-value">{streak}</span>
  </div>
  <div class="hud-pill hud-right" aria-label="Dust">
    <span class="hud-icon">✦</span>
    <span class="hud-value">{dustBalance}</span>
  </div>
</div>

<style>
  .hud-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    pointer-events: none;
  }

  .hud-pill {
    position: absolute;
    top: calc(12px + var(--safe-top));
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    background: rgba(10, 15, 25, 0.75);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .hud-left {
    left: 12px;
  }

  .hud-right {
    right: 12px;
  }

  .hud-icon {
    font-size: 14px;
    line-height: 1;
  }

  .hud-value {
    font-size: 13px;
    color: #fff;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    line-height: 1;
  }

  .hud-overlay.banner-offset .hud-pill {
    top: calc(76px + var(--safe-top));
    transition: top 200ms ease;
  }

  /* Landscape: HUD is inside .hub-center so left/right: 0 is already correct.
     Tighten top padding slightly since no mobile safe area needed. */
  .hud-overlay.landscape .hud-pill {
    top: 10px;
  }

  .hud-overlay.landscape.banner-offset .hud-pill {
    top: calc(76px);
    transition: top 200ms ease;
  }
</style>
