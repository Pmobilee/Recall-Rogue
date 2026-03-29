<script lang="ts">
  import { playCardAudio } from '../../services/cardAudioManager';

  interface Props {
    domainId: string;
    shortName: string;
    icon: string;
    colorTint: string;
    isSelected: boolean;
    isLocked: boolean;
    ontoggle: (domainId: string) => void;
  }

  let { domainId, shortName, icon, colorTint, isSelected, isLocked, ontoggle }: Props = $props();

  function handleClick() {
    if (isLocked) return;
    playCardAudio('toggle-on');
    ontoggle(domainId);
  }
</script>

<button
  class="domain-card"
  class:selected={isSelected}
  class:locked={isLocked}
  onclick={handleClick}
  style="--color-tint: {colorTint};"
  aria-pressed={isSelected}
  aria-disabled={isLocked}
  title={isLocked ? `${shortName} — Coming Soon` : shortName}
>
  <span class="icon">
    {#if isLocked}
      <span class="lock-overlay">&#128274;</span>
    {/if}
    {#if icon.startsWith('/')}
      <img class="icon-img" src={icon} alt="" />
    {:else}
      {icon}
    {/if}
  </span>
  <span class="name">{shortName}</span>
  {#if isSelected}
    <span class="color-bar"></span>
  {/if}
</button>

<style>
  .domain-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(6px * var(--layout-scale, 1));
    width: calc(140px * var(--layout-scale, 1));
    height: calc(96px * var(--layout-scale, 1));
    border-radius: calc(10px * var(--layout-scale, 1));
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.15s ease;
    opacity: 0.55;
    padding: 0;
    flex-shrink: 0;
    overflow: hidden;
  }

  .domain-card:hover:not(.locked) {
    background: rgba(255, 255, 255, 0.06);
    transform: translateY(calc(-2px * var(--layout-scale, 1)));
  }

  .domain-card.selected {
    border-color: color-mix(in srgb, var(--color-tint) 60%, transparent);
    box-shadow: 0 0 calc(12px * var(--layout-scale, 1)) color-mix(in srgb, var(--color-tint) 20%, transparent);
    background: rgba(255, 255, 255, 0.04);
    opacity: 1;
  }

  .domain-card.locked {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .icon {
    position: relative;
    font-size: calc(28px * var(--text-scale, 1));
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-img {
    width: calc(28px * var(--layout-scale, 1));
    height: calc(28px * var(--layout-scale, 1));
    object-fit: contain;
  }

  .lock-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: calc(14px * var(--text-scale, 1));
    z-index: 1;
  }

  .name {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 600;
    color: #64748b;
    text-align: center;
    line-height: 1.2;
    padding: 0 calc(6px * var(--layout-scale, 1));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .domain-card.selected .name {
    color: #cbd5e1;
  }

  .color-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(3px * var(--layout-scale, 1));
    background: var(--color-tint);
  }
</style>
