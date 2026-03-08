<script lang="ts">
  import type { FactDomain } from '../../data/card-types'

  interface Props {
    onstart: (primary: FactDomain, secondary: FactDomain) => void
    onback: () => void
  }

  let { onstart, onback }: Props = $props()

  interface DomainInfo {
    id: FactDomain
    name: string
    icon: string
    color: string
    unlocked: boolean
  }

  const DOMAINS: DomainInfo[] = [
    { id: 'science', name: 'Science & Nature', icon: '\u2694\uFE0F', color: '#E74C3C', unlocked: true },
    { id: 'history', name: 'History & Culture', icon: '\uD83D\uDEE1\uFE0F', color: '#3498DB', unlocked: true },
    { id: 'language', name: 'Language & Vocab', icon: '\uD83D\uDC9A', color: '#2ECC71', unlocked: true },
    { id: 'geography', name: 'Geography & World', icon: '\u2B50', color: '#F1C40F', unlocked: false },
    { id: 'math', name: 'Math & Logic', icon: '\u2B06\uFE0F', color: '#9B59B6', unlocked: false },
    { id: 'arts', name: 'Arts & Literature', icon: '\u2B07\uFE0F', color: '#E67E22', unlocked: false },
    { id: 'medicine', name: 'Medicine & Health', icon: '\u2795', color: '#1ABC9C', unlocked: false },
    { id: 'technology', name: 'Technology', icon: '\uD83D\uDC8E', color: '#95A5A6', unlocked: false },
  ]

  let primaryDomain = $state<FactDomain | null>(null)
  let secondaryDomain = $state<FactDomain | null>(null)

  let canStart = $derived(primaryDomain !== null && secondaryDomain !== null)

  function handleDomainTap(domain: DomainInfo): void {
    if (!domain.unlocked) return

    if (primaryDomain === domain.id) {
      // Deselect primary
      primaryDomain = null
      return
    }
    if (secondaryDomain === domain.id) {
      // Deselect secondary
      secondaryDomain = null
      return
    }

    // Select: primary first, then secondary
    if (primaryDomain === null) {
      primaryDomain = domain.id
    } else if (secondaryDomain === null) {
      secondaryDomain = domain.id
    }
    // Both already selected — ignore tap on third domain
  }

  function handleStart(): void {
    if (primaryDomain && secondaryDomain) {
      onstart(primaryDomain, secondaryDomain)
    }
  }

  function getBorderColor(domain: DomainInfo): string {
    if (primaryDomain === domain.id) return '#F1C40F' // gold
    if (secondaryDomain === domain.id) return '#BDC3C7' // silver
    return 'transparent'
  }

  function getSelectionLabel(domain: DomainInfo): string {
    if (primaryDomain === domain.id) return 'PRIMARY'
    if (secondaryDomain === domain.id) return 'SECONDARY'
    return ''
  }
</script>

<div class="domain-selection-overlay">
  <button class="back-btn" onclick={onback}>&larr; Back</button>

  <h1 class="title">Choose Your Domains</h1>
  <p class="subtitle">Primary (40% cards) &mdash; Secondary (30% cards)</p>

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
        <span class="domain-icon">{domain.icon}</span>
        <span class="domain-name">{domain.name}</span>
        {#if !domain.unlocked}
          <span class="locked-label">Locked</span>
        {/if}
        {#if getSelectionLabel(domain)}
          <span class="selection-label" style="color: {primaryDomain === domain.id ? '#F1C40F' : '#BDC3C7'}">{getSelectionLabel(domain)}</span>
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
    background: #0D1117;
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
    color: #8B949E;
    font-size: 16px;
    cursor: pointer;
    padding: 8px;
  }

  .title {
    font-size: 20px;
    color: #E6EDF3;
    margin: 16px 0 4px;
    text-align: center;
  }

  .subtitle {
    font-size: 14px;
    color: #8B949E;
    margin: 0 0 24px;
    text-align: center;
  }

  .domain-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    width: 100%;
    max-width: 340px;
    margin-bottom: 24px;
  }

  .domain-card {
    width: 100%;
    height: 80px;
    background: #1E2D3D;
    border: 2px solid transparent;
    border-radius: 8px;
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
    transform: scale(1.03);
  }

  .domain-card.locked {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .domain-card.selected {
    border-width: 2px;
  }

  .domain-icon {
    font-size: 24px;
  }

  .domain-name {
    font-size: 12px;
    color: #E6EDF3;
    text-align: center;
    line-height: 1.2;
  }

  .locked-label {
    font-size: 10px;
    color: #8B949E;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .selection-label {
    position: absolute;
    top: 4px;
    right: 6px;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .start-btn {
    width: 200px;
    height: 56px;
    background: #27AE60;
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
    background: #2D333B;
    color: #484F58;
    cursor: not-allowed;
  }
</style>
