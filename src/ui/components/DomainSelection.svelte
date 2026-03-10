<script lang="ts">
  import type { FactDomain } from '../../data/card-types'
  import { getAllDomainMetadata } from '../../data/domainMetadata'
  import { getDomainIconPath } from '../utils/domainAssets'
  import { ENABLE_LANGUAGE_DOMAINS } from '../../data/balance'

  interface Props {
    onstart: (primary: FactDomain, secondary: FactDomain) => void
    onback: () => void
  }

  let { onstart, onback }: Props = $props()

  const DOMAINS = getAllDomainMetadata()
    .filter((domain) => ENABLE_LANGUAGE_DOMAINS || domain.id !== 'language')
    .map((domain) => ({
      id: domain.id,
      name: domain.displayName,
      shortName: domain.shortName,
      icon: domain.icon,
      color: domain.colorTint,
      unlocked: !domain.comingSoon,
      comingSoon: domain.comingSoon === true,
    }))

  let primaryDomain = $state<FactDomain | null>(null)
  let secondaryDomain = $state<FactDomain | null>(null)

  let canStart = $derived(primaryDomain !== null && secondaryDomain !== null)

  function handleDomainTap(domain: (typeof DOMAINS)[number]): void {
    if (!domain.unlocked) return

    if (primaryDomain === domain.id) {
      primaryDomain = null
      return
    }
    if (secondaryDomain === domain.id) {
      secondaryDomain = null
      return
    }

    if (primaryDomain === null) {
      primaryDomain = domain.id
    } else if (secondaryDomain === null) {
      secondaryDomain = domain.id
    }
  }

  function handleStart(): void {
    if (primaryDomain && secondaryDomain) {
      onstart(primaryDomain, secondaryDomain)
    }
  }

  function getBorderColor(domain: (typeof DOMAINS)[number]): string {
    if (primaryDomain === domain.id) return '#FCD34D'
    if (secondaryDomain === domain.id) return '#CBD5E1'
    return 'rgba(148, 163, 184, 0.4)'
  }

  function getSelectionLabel(domain: (typeof DOMAINS)[number]): string {
    if (primaryDomain === domain.id) return 'PRIMARY'
    if (secondaryDomain === domain.id) return 'SECONDARY'
    return ''
  }
</script>

<div class="domain-selection-overlay">
  <button class="back-btn" onclick={onback}>&larr; Back</button>

  <h1 class="title">What are you curious about?</h1>
  <p class="subtitle">Pick 2 to specialize in. You can always add more later.</p>

  <div class="domain-grid">
    {#each DOMAINS as domain (domain.id)}
      <button
        class="domain-card"
        class:locked={!domain.unlocked}
        class:selected={primaryDomain === domain.id || secondaryDomain === domain.id}
        style="border-color: {getBorderColor(domain)}; --domain-color: {domain.color}"
        onclick={() => handleDomainTap(domain)}
        disabled={!domain.unlocked}
      >
        <div class="domain-icon-wrap" aria-hidden="true">
          <img class="domain-icon-img" src={getDomainIconPath(domain.id)} alt="" />
          <span class="domain-icon-fallback">{domain.icon}</span>
        </div>
        <span class="domain-name">{domain.shortName}</span>
        {#if domain.comingSoon}
          <span class="locked-label">Coming Soon</span>
        {/if}
        {#if getSelectionLabel(domain)}
          <span class="selection-label">{getSelectionLabel(domain)}</span>
        {/if}
      </button>
    {/each}
  </div>

  <button
    class="start-btn"
    class:disabled={!canStart}
    data-testid="btn-start-run"
    disabled={!canStart}
    onclick={handleStart}
  >
    Start Run
  </button>
</div>

<style>
  .domain-selection-overlay {
    position: fixed;
    inset: 0;
    background: #0d1117;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 16px;
    z-index: 200;
    overflow-y: auto;
  }

  .back-btn {
    position: absolute;
    top: 16px;
    left: 16px;
    background: none;
    border: none;
    color: #8b949e;
    font-size: 16px;
    cursor: pointer;
    padding: 8px;
    min-height: 44px;
  }

  .title {
    font-size: 20px;
    color: #e6edf3;
    margin: 16px 0 4px;
    text-align: center;
  }

  .subtitle {
    font-size: 14px;
    color: #8b949e;
    margin: 0 0 24px;
    text-align: center;
  }

  .domain-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    width: 100%;
    max-width: 520px;
    margin-bottom: 24px;
  }

  .domain-card {
    width: 100%;
    min-height: 88px;
    background: #1e2d3d;
    border: 2px solid rgba(148, 163, 184, 0.4);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
    transition: transform 0.1s, border-color 0.15s;
    position: relative;
    padding: 8px;
  }

  .domain-card:not(.locked):hover {
    transform: scale(1.02);
  }

  .domain-card.locked {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .domain-icon-wrap {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    position: relative;
  }

  .domain-icon-img {
    width: 24px;
    height: 24px;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .domain-icon-fallback {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 18px;
  }

  .domain-name {
    font-size: 12px;
    color: #e6edf3;
    text-align: center;
    line-height: 1.2;
    font-weight: 600;
  }

  .locked-label {
    font-size: 10px;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .selection-label {
    position: absolute;
    top: 4px;
    right: 6px;
    font-size: 9px;
    color: #e2e8f0;
    font-weight: 700;
    letter-spacing: 0.4px;
  }

  .start-btn {
    width: 220px;
    height: 56px;
    background: #16a34a;
    border: none;
    border-radius: 12px;
    color: #fff;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
  }

  .start-btn:hover:not(.disabled) {
    transform: scale(1.03);
  }

  .start-btn.disabled {
    background: #2d333b;
    color: #6b7280;
    cursor: not-allowed;
  }

  @media (min-width: 720px) {
    .domain-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
