<script lang="ts">
  // AR-59.12: STARTER_RELIC_CHOICES was removed from balance.ts (starter relic selection screen is dead code).
  // This component is unreachable but kept pending deletion approval.
  const STARTER_RELIC_CHOICES = ['scholars_hat', 'iron_buckler', 'war_drum'] as const
  import { RELIC_BY_ID } from '../../data/relics/index'
  import { getRelicIconPath } from '../utils/iconAssets'

  interface Props {
    onselect: (relicId: string) => void
  }

  let { onselect }: Props = $props()

  let selectedId = $state<string | null>(null)
  let confirmed = $state(false)

  const choices = STARTER_RELIC_CHOICES.map(id => {
    const def = RELIC_BY_ID[id]
    return {
      id,
      name: def?.name ?? id,
      description: def?.description ?? '',
      icon: def?.icon ?? '?',
      category: def?.category ?? 'tactical',
    }
  })

  const PLAYSTYLE_LABELS: Record<string, string> = {
    scholars_hat: 'Knowledge Path',
    iron_buckler: 'Guardian Path',
    war_drum: 'Warrior Path',
  }

  const PLAYSTYLE_COLORS: Record<string, string> = {
    scholars_hat: '#3498db',
    iron_buckler: '#2ecc71',
    war_drum: '#e74c3c',
  }

  function handleTap(id: string): void {
    if (confirmed) return
    if (selectedId === id) {
      // Second tap = confirm
      confirmed = true
      setTimeout(() => onselect(id), 400)
    } else {
      selectedId = id
    }
  }
</script>

<div class="starter-relic-overlay">
  <div class="starter-content">
    <h1 class="starter-title">Choose Your Path</h1>
    <p class="starter-subtitle">Select a relic to begin your journey</p>

    <div class="relic-choices">
      {#each choices as choice}
        {@const isSelected = selectedId === choice.id}
        {@const color = PLAYSTYLE_COLORS[choice.id] ?? '#aaa'}
        <button
          class="relic-choice"
          class:selected={isSelected}
          class:confirmed={confirmed && isSelected}
          style="--choice-color: {color};"
          onclick={() => handleTap(choice.id)}
          disabled={confirmed && !isSelected}
        >
          <div class="choice-icon-wrap">
            <img
              class="choice-icon"
              src={getRelicIconPath(choice.id)}
              alt={choice.name}
              onerror={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none'
              }}
            />
            <span class="choice-emoji">{choice.icon}</span>
          </div>
          <div class="choice-name">{choice.name}</div>
          <div class="choice-playstyle">{PLAYSTYLE_LABELS[choice.id] ?? ''}</div>
          <div class="choice-desc">{choice.description}</div>
          {#if isSelected && !confirmed}
            <div class="tap-confirm">Tap again to confirm</div>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .starter-relic-overlay {
    position: fixed;
    inset: 0;
    background: linear-gradient(180deg, #080d14 0%, #0f1a2e 50%, #080d14 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
    padding: calc(20px * var(--layout-scale, 1));
  }

  .starter-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(16px * var(--layout-scale, 1));
    max-width: calc(400px * var(--layout-scale, 1));
    width: 100%;
  }

  .starter-title {
    font-size: calc(24px * var(--layout-scale, 1));
    color: #f1f5f9;
    margin: 0;
    text-align: center;
    text-shadow: 0 0 20px rgba(74, 158, 255, 0.4);
  }

  .starter-subtitle {
    font-size: calc(13px * var(--layout-scale, 1));
    color: #94a3b8;
    margin: 0;
    text-align: center;
  }

  .relic-choices {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
    width: 100%;
    justify-content: center;
  }

  .relic-choice {
    flex: 1;
    max-width: calc(120px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-radius: calc(12px * var(--layout-scale, 1));
    border: 2px solid rgba(255, 255, 255, 0.1);
    background: rgba(15, 21, 32, 0.9);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    cursor: pointer;
    transition: transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
    color: #e2e8f0;
    font-family: inherit;
    animation: choiceFloat 3s ease-in-out infinite;
  }

  .relic-choice:nth-child(2) { animation-delay: 0.3s; }
  .relic-choice:nth-child(3) { animation-delay: 0.6s; }

  .relic-choice:hover:not(:disabled) {
    transform: translateY(-4px);
    border-color: var(--choice-color);
    box-shadow: 0 4px 20px color-mix(in srgb, var(--choice-color) 30%, transparent);
  }

  .relic-choice.selected {
    border-color: var(--choice-color);
    box-shadow: 0 0 16px color-mix(in srgb, var(--choice-color) 40%, transparent);
    transform: translateY(-6px) scale(1.05);
    animation: none;
  }

  .relic-choice.confirmed {
    transform: translateY(-6px) scale(1.1);
    box-shadow: 0 0 30px color-mix(in srgb, var(--choice-color) 60%, transparent);
  }

  .relic-choice:disabled:not(.confirmed) {
    opacity: 0.3;
    filter: grayscale(0.8);
    cursor: default;
    animation: none;
  }

  .choice-icon-wrap {
    width: calc(48px * var(--layout-scale, 1));
    height: calc(48px * var(--layout-scale, 1));
    display: grid;
    place-items: center;
  }

  .choice-icon {
    width: calc(44px * var(--layout-scale, 1));
    height: calc(44px * var(--layout-scale, 1));
    object-fit: contain;
    image-rendering: auto;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
  }

  .choice-emoji {
    font-size: calc(28px * var(--layout-scale, 1));
    display: none;
  }

  .choice-name {
    font-size: calc(13px * var(--layout-scale, 1));
    font-weight: 700;
    color: #f8fafc;
    text-align: center;
  }

  .choice-playstyle {
    font-size: calc(10px * var(--layout-scale, 1));
    color: var(--choice-color);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .choice-desc {
    font-size: calc(10px * var(--layout-scale, 1));
    color: #94a3b8;
    text-align: center;
    line-height: 1.3;
  }

  .tap-confirm {
    font-size: calc(9px * var(--layout-scale, 1));
    color: var(--choice-color);
    font-weight: 600;
    animation: confirmPulse 1s ease-in-out infinite;
  }

  @keyframes choiceFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }

  @keyframes confirmPulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .relic-choice { animation: none; }
    .tap-confirm { animation: none; }
  }
</style>
