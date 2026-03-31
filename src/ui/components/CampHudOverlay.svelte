<script lang="ts">
  import { isLandscape } from '../../stores/layoutStore'
  import { getGreyMatterIconPath } from '../utils/iconAssets'

  interface Props {
    streak: number
    greyMatterBalance: number
    hasActiveRunBanner?: boolean
  }

  let { streak, greyMatterBalance, hasActiveRunBanner = false }: Props = $props()
</script>

<!-- In landscape, this component is rendered inside .hub-center (position: relative),
     so left/right: 0 constrains it to the center column automatically.
     No viewport-spanning occurs — positioning is correct in both modes. -->
<div class="hud-overlay" class:banner-offset={hasActiveRunBanner} class:landscape={$isLandscape} aria-label="Camp HUD">
  <div class="hud-pill hud-left" title="Win Streak">
    <span class="hud-icon">&#x1F525;</span>
    <span class="hud-value">{streak}</span>
  </div>
  <div class="hud-pill hud-right" aria-label="Grey Matter" title="Grey Matter">
    <img class="hud-icon-img" src={getGreyMatterIconPath()} alt="" aria-hidden="true" />
    <span class="hud-value">{greyMatterBalance}</span>
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
    top: calc(calc(12px * var(--layout-scale, 1)) + var(--safe-top));
    display: inline-flex;
    align-items: center;
    gap: calc(5px * var(--layout-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(10, 15, 25, 0.75);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .hud-left {
    left: calc(12px * var(--layout-scale, 1));
  }

  .hud-right {
    right: calc(12px * var(--layout-scale, 1));
  }

  .hud-icon {
    font-size: calc(14px * var(--text-scale, 1));
    line-height: 1;
  }

  .hud-icon-img {
    width: calc(16px * var(--layout-scale, 1));
    height: calc(16px * var(--layout-scale, 1));
    object-fit: contain;
  }

  .hud-overlay.landscape .hud-icon-img {
    width: calc(22px * var(--layout-scale, 1));
    height: calc(22px * var(--layout-scale, 1));
  }

  .hud-value {
    font-size: calc(13px * var(--text-scale, 1));
    color: #fff;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    line-height: 1;
  }

  .hud-overlay.banner-offset .hud-pill {
    top: calc(calc(76px * var(--layout-scale, 1)) + var(--safe-top));
    transition: top 200ms ease;
  }

  /* Landscape: HUD is inside .hub-center so left/right: 0 is already correct.
     Tighten top padding slightly since no mobile safe area needed. */
  .hud-overlay.landscape .hud-pill {
    top: calc(14px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    gap: calc(8px * var(--layout-scale, 1));
  }

  .hud-overlay.landscape .hud-icon {
    font-size: calc(20px * var(--text-scale, 1));
  }

  .hud-overlay.landscape .hud-value {
    font-size: calc(18px * var(--text-scale, 1));
  }

  .hud-overlay.landscape.banner-offset .hud-pill {
    top: calc(76px * var(--layout-scale, 1));
    transition: top 200ms ease;
  }
</style>
