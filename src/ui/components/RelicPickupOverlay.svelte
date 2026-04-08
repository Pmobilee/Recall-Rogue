<script lang="ts">
  import type { RelicDefinition } from '../../data/relics/types'
  import { isLandscape } from '../../stores/layoutStore'
  import { playCardAudio } from '../../services/cardAudioManager'

  interface Props {
    relic: RelicDefinition
    onAccept: () => void
    onDecline: () => void
  }

  let { relic, onAccept, onDecline }: Props = $props()

  const rarityColors: Record<string, string> = {
    common: '#aaaaaa',
    uncommon: '#44cc44',
    rare: '#4488ff',
    legendary: '#ffcc00',
  }
</script>

<div class="relic-overlay" class:landscape={$isLandscape} role="dialog" aria-modal="true">
  <div class="relic-backdrop"></div>
  <div class="relic-panel">
    <div class="relic-icon-wrap" style="--rarity-color: {rarityColors[relic.rarity] ?? '#aaa'};">
      <span class="relic-icon-large">{relic.icon}</span>
    </div>
    <h2 class="relic-title">{relic.name}</h2>
    <span class="relic-rarity" style="color: {rarityColors[relic.rarity] ?? '#aaa'};">{relic.rarity}</span>
    <p class="relic-description">{relic.description}</p>
    {#if relic.effects.length > 0}
      <div class="relic-effect-list">
        {#each relic.effects as effect}
          <span class="relic-effect-line">{effect.description}</span>
        {/each}
      </div>
    {/if}
    <div class="relic-buttons">
      <button class="btn-take" onclick={() => { playCardAudio('relic-acquired'); onAccept() }}>Accept</button>
      <button class="btn-leave" onclick={onDecline}>Leave</button>
    </div>
  </div>
</div>

<style>
  .relic-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    animation: relicFadeIn 200ms ease-out;
  }

  .relic-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(calc(8px * var(--layout-scale, 1)));
  }

  .relic-panel {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    background: rgba(15, 20, 35, 0.95);
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    border-radius: calc(16px * var(--layout-scale, 1));
    padding: calc(32px * var(--layout-scale, 1)) calc(28px * var(--layout-scale, 1));
    max-width: calc(360px * var(--layout-scale, 1));
    width: 90%;
    box-shadow: 0 calc(8px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.6);
    animation: relicScaleIn 250ms ease-out;
  }

  .relic-icon-wrap {
    width: calc(96px * var(--layout-scale, 1));
    height: calc(96px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.04);
    filter: drop-shadow(0 0 calc(16px * var(--layout-scale, 1)) var(--rarity-color));
    margin-bottom: calc(12px * var(--layout-scale, 1));
    animation: relicFloat 2.4s ease-in-out infinite;
  }

  .relic-icon-large {
    font-size: calc(48px * var(--text-scale, 1));
    line-height: 1;
  }

  .relic-title {
    font-family: var(--font-rpg, 'Cinzel', 'Georgia', serif);
    font-size: calc(20px * var(--text-scale, 1));
    font-weight: 700;
    color: #f0f0f0;
    margin: 0 0 calc(4px * var(--layout-scale, 1));
    letter-spacing: 0.02em;
  }

  .relic-rarity {
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin-bottom: calc(16px * var(--layout-scale, 1));
  }

  .relic-description {
    font-size: calc(20px * var(--text-scale, 1));
    color: #c8c8d0;
    line-height: 1.5;
    margin: 0 0 calc(8px * var(--layout-scale, 1));
    max-width: calc(280px * var(--layout-scale, 1));
  }

  .relic-effect-list {
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
    margin-bottom: calc(20px * var(--layout-scale, 1));
  }

  .relic-effect-line {
    font-size: calc(20px * var(--text-scale, 1));
    color: #6ee7b7;
    line-height: 1.3;
  }

  .relic-buttons {
    display: flex;
    flex-direction: row;
    gap: calc(12px * var(--layout-scale, 1));
    width: 100%;
    justify-content: center;
    margin-top: calc(8px * var(--layout-scale, 1));
  }

  .btn-take {
    background: linear-gradient(180deg, #35c173, #249752);
    color: #fff;
    border: none;
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(28px * var(--layout-scale, 1));
    font-size: calc(20px * var(--text-scale, 1));
    font-weight: 800;
    font-family: inherit;
    cursor: pointer;
    min-height: calc(48px * var(--layout-scale, 1));
    min-width: calc(140px * var(--layout-scale, 1));
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3);
    transition: transform 100ms ease, box-shadow 100ms ease;
  }

  .btn-take:hover {
    transform: scale(1.04);
    box-shadow: 0 calc(6px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.4);
  }

  /* Leave = red "danger" button so players notice it's the reject action */
  .btn-leave {
    background: #dc2626;
    color: #fff;
    border: none;
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(28px * var(--layout-scale, 1));
    font-size: calc(20px * var(--text-scale, 1));
    font-weight: 800;
    font-family: inherit;
    cursor: pointer;
    min-height: calc(48px * var(--layout-scale, 1));
    min-width: calc(140px * var(--layout-scale, 1));
    transition: background 100ms ease;
  }

  .btn-leave:hover {
    background: #991b1b;
  }

  /* Landscape overrides */
  .relic-overlay.landscape .relic-panel {
    max-width: min(55vw, calc(520px * var(--layout-scale, 1)));
    padding: calc(36px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1));
  }

  .relic-overlay.landscape .relic-icon-large {
    font-size: calc(56px * var(--text-scale, 1));
  }

  .relic-overlay.landscape .relic-title {
    font-size: calc(24px * var(--text-scale, 1));
  }

  .relic-overlay.landscape .relic-description {
    font-size: calc(20px * var(--text-scale, 1));
    max-width: calc(380px * var(--layout-scale, 1));
  }

  @keyframes relicFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(calc(-8px * var(--layout-scale, 1))); }
  }

  @keyframes relicFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes relicScaleIn {
    from { transform: scale(0.85); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .relic-icon-wrap { animation: none; }
  }
</style>
