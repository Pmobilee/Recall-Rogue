<script lang="ts">
  import type { FactDomain } from '../../data/card-types'
  import { normalizeFactDomain } from '../../data/card-types'
  import { getAllDomainMetadata } from '../../data/domainMetadata'
  import { getDomainIconPath } from '../utils/domainAssets'
  import { ENABLE_LANGUAGE_DOMAINS } from '../../data/balance'
  import { playerSave, persistPlayer } from '../stores/playerData'
  import { getDomainSubcategories } from '../../services/domainSubcategoryService'
  import { ascensionProfile, setAscensionLevel } from '../../services/cardPreferences'
  import { getAscensionRule } from '../../services/ascension'

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
  let showFilterModal = $state(false)
  let filterDomain = $state<FactDomain | null>(null)
  let filterOptions = $state<Array<{ name: string; count: number }>>([])
  let enabledSubcategories = $state<string[]>([])
  let filterError = $state('')

  let canStart = $derived(primaryDomain !== null && secondaryDomain !== null)
  let ascensionRule = $derived(getAscensionRule($ascensionProfile.selectedLevel))
  let ascensionUnlockText = $derived(
    $ascensionProfile.highestUnlockedLevel > 0
      ? `Unlocked: ${$ascensionProfile.highestUnlockedLevel}`
      : 'Unlock by completing a successful floor 9+ run.',
  )

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

  function getStoredFilter(domainId: FactDomain): string[] {
    const filters = $playerSave?.subscriberCategoryFilters ?? {}
    const key = normalizeFactDomain(domainId)
    const value = filters[key]
    return Array.isArray(value) ? [...value] : []
  }

  function openFilterModal(domainId: FactDomain): void {
    const options = getDomainSubcategories(domainId)
    if (options.length === 0) return
    filterDomain = domainId
    filterOptions = options
    const stored = getStoredFilter(domainId)
    enabledSubcategories = stored.length > 0 ? stored : options.map((entry) => entry.name)
    filterError = ''
    showFilterModal = true
  }

  function closeFilterModal(): void {
    showFilterModal = false
    filterDomain = null
    filterOptions = []
    enabledSubcategories = []
    filterError = ''
  }

  function toggleSubcategory(name: string): void {
    if (enabledSubcategories.includes(name)) {
      enabledSubcategories = enabledSubcategories.filter((entry) => entry !== name)
    } else {
      enabledSubcategories = [...enabledSubcategories, name]
    }
  }

  function saveDomainFilter(): void {
    if (!filterDomain) return
    if (enabledSubcategories.length === 0) {
      filterError = 'Keep at least one sub-category enabled.'
      return
    }
    const key = normalizeFactDomain(filterDomain)
    playerSave.update((save) => {
      if (!save) return save
      return {
        ...save,
        subscriberCategoryFilters: {
          ...(save.subscriberCategoryFilters ?? {}),
          [key]: [...enabledSubcategories].sort((a, b) => a.localeCompare(b)),
        },
      }
    })
    persistPlayer()
    closeFilterModal()
  }

  function resetDomainFilter(): void {
    if (!filterDomain) return
    const key = normalizeFactDomain(filterDomain)
    playerSave.update((save) => {
      if (!save) return save
      const next = { ...(save.subscriberCategoryFilters ?? {}) }
      delete next[key]
      return { ...save, subscriberCategoryFilters: next }
    })
    persistPlayer()
    closeFilterModal()
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

  function shiftAscension(delta: number): void {
    const highest = Math.max(0, $ascensionProfile.highestUnlockedLevel ?? 0)
    const next = Math.max(0, Math.min(highest, ($ascensionProfile.selectedLevel ?? 0) + delta))
    setAscensionLevel(next)
  }
</script>

<div class="domain-selection-overlay">
  <button class="back-btn" onclick={onback}>&larr; Back</button>

  <h1 class="title">What are you curious about?</h1>
  <p class="subtitle">Pick 2 to specialize in. You can always add more later.</p>

  <section class="ascension-panel" aria-label="Ascension mode">
    <div class="ascension-header">
      <span class="ascension-title">Ascension</span>
      <span class="ascension-unlock">{ascensionUnlockText}</span>
    </div>
    <div class="ascension-controls">
      <button
        type="button"
        class="ascension-step"
        data-testid="ascension-decrease"
        onclick={() => shiftAscension(-1)}
        disabled={$ascensionProfile.highestUnlockedLevel <= 0 || $ascensionProfile.selectedLevel <= 0}
      >-</button>
      <div class="ascension-level">
        <strong>Level {$ascensionProfile.selectedLevel}</strong>
        <small>
          {#if ascensionRule}
            {ascensionRule.name}: {ascensionRule.effect}
          {:else}
            Off
          {/if}
        </small>
      </div>
      <button
        type="button"
        class="ascension-step"
        data-testid="ascension-increase"
        onclick={() => shiftAscension(1)}
        disabled={$ascensionProfile.highestUnlockedLevel <= 0 || $ascensionProfile.selectedLevel >= $ascensionProfile.highestUnlockedLevel}
      >+</button>
    </div>
  </section>

  <div class="domain-grid">
    {#each DOMAINS as domain (domain.id)}
      <button
        class="domain-card"
        class:locked={!domain.unlocked}
        class:selected={primaryDomain === domain.id || secondaryDomain === domain.id}
        data-testid={`domain-card-${domain.id}`}
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

  {#if primaryDomain || secondaryDomain}
    <div class="selected-filters">
      {#if primaryDomain}
        <button
          type="button"
          class="selected-filter-btn"
          onclick={() => { if (primaryDomain) openFilterModal(primaryDomain) }}
        >
          Filter PRIMARY: {DOMAINS.find((entry) => entry.id === primaryDomain)?.shortName}
        </button>
      {/if}
      {#if secondaryDomain}
        <button
          type="button"
          class="selected-filter-btn"
          onclick={() => { if (secondaryDomain) openFilterModal(secondaryDomain) }}
        >
          Filter SECONDARY: {DOMAINS.find((entry) => entry.id === secondaryDomain)?.shortName}
        </button>
      {/if}
    </div>
  {/if}

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

{#if showFilterModal && filterDomain}
  <div class="filter-overlay" role="dialog" aria-modal="true" aria-label="Domain sub-category filters">
    <div class="filter-modal">
      <h2>{DOMAINS.find((entry) => entry.id === filterDomain)?.name} Filters</h2>
      <p>Select the sub-categories allowed in run pool generation.</p>
      <div class="filter-list">
        {#each filterOptions as option (option.name)}
          <label class="filter-item">
            <input
              type="checkbox"
              checked={enabledSubcategories.includes(option.name)}
              onchange={() => toggleSubcategory(option.name)}
            />
            <span>{option.name}</span>
            <span class="count">{option.count}</span>
          </label>
        {/each}
      </div>
      {#if filterError}
        <p class="filter-error">{filterError}</p>
      {/if}
      <div class="filter-actions">
        <button type="button" class="btn-ghost" onclick={resetDomainFilter}>Reset</button>
        <button type="button" class="btn-ghost" onclick={closeFilterModal}>Cancel</button>
        <button type="button" class="btn-save" onclick={saveDomainFilter}>Save Filter</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .domain-selection-overlay {
    position: fixed;
    inset: 0;
    background: #0d1117;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: calc(calc(24px * var(--layout-scale, 1)) + var(--safe-top)) calc(16px * var(--layout-scale, 1));
    z-index: 200;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .back-btn {
    position: absolute;
    top: calc(calc(16px * var(--layout-scale, 1)) + var(--safe-top));
    left: calc(16px * var(--layout-scale, 1));
    background: none;
    border: none;
    color: #8b949e;
    font-size: 16px;
    cursor: pointer;
    padding: calc(8px * var(--layout-scale, 1));
    min-height: 44px;
  }

  .title {
    font-size: calc(20px * var(--layout-scale, 1));
    color: #e6edf3;
    margin: calc(16px * var(--layout-scale, 1)) 0 4px;
    text-align: center;
  }

  .subtitle {
    font-size: calc(14px * var(--layout-scale, 1));
    color: #8b949e;
    margin: 0 0 calc(24px * var(--layout-scale, 1));
    text-align: center;
  }

  .ascension-panel {
    width: 100%;
    max-width: calc(520px * var(--layout-scale, 1));
    margin: 0 0 calc(16px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 10px;
    background: rgba(15, 23, 35, 0.7);
  }

  .ascension-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    margin-bottom: calc(8px * var(--layout-scale, 1));
  }

  .ascension-title {
    font-size: calc(13px * var(--layout-scale, 1));
    font-weight: 700;
    color: #f8fafc;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }

  .ascension-unlock {
    font-size: calc(11px * var(--layout-scale, 1));
    color: #a8b3c4;
    text-align: right;
  }

  .ascension-controls {
    display: grid;
    grid-template-columns: calc(40px * var(--layout-scale, 1)) 1fr calc(40px * var(--layout-scale, 1));
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .ascension-step {
    min-height: 36px;
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.5);
    background: #1f2b3a;
    color: #e2e8f0;
    font-size: calc(18px * var(--layout-scale, 1));
    font-weight: 700;
    cursor: pointer;
  }

  .ascension-step:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .ascension-level {
    display: grid;
    gap: 2px;
    text-align: center;
  }

  .ascension-level strong {
    color: #facc15;
    font-size: calc(14px * var(--layout-scale, 1));
  }

  .ascension-level small {
    color: #cbd5e1;
    font-size: calc(11px * var(--layout-scale, 1));
    line-height: 1.3;
  }

  .domain-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: calc(12px * var(--layout-scale, 1));
    width: 100%;
    max-width: calc(520px * var(--layout-scale, 1));
    margin-bottom: calc(24px * var(--layout-scale, 1));
  }

  .domain-card {
    width: 100%;
    min-height: calc(88px * var(--layout-scale, 1));
    background: #1e2d3d;
    border: 2px solid rgba(148, 163, 184, 0.4);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(4px * var(--layout-scale, 1));
    cursor: pointer;
    transition: transform 0.1s, border-color 0.15s;
    position: relative;
    padding: calc(8px * var(--layout-scale, 1));
  }

  .domain-card:not(.locked):hover {
    transform: scale(1.02);
  }

  .domain-card.locked {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .domain-icon-wrap {
    width: calc(30px * var(--layout-scale, 1));
    height: calc(30px * var(--layout-scale, 1));
    display: grid;
    place-items: center;
    position: relative;
  }

  .domain-icon-img {
    width: calc(24px * var(--layout-scale, 1));
    height: calc(24px * var(--layout-scale, 1));
    object-fit: contain;
    image-rendering: pixelated;
  }

  .domain-icon-fallback {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: calc(18px * var(--layout-scale, 1));
  }

  .domain-name {
    font-size: calc(12px * var(--layout-scale, 1));
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
    top: calc(4px * var(--layout-scale, 1));
    right: calc(6px * var(--layout-scale, 1));
    font-size: calc(9px * var(--layout-scale, 1));
    color: #e2e8f0;
    font-weight: 700;
    letter-spacing: 0.4px;
  }
  .selected-filters {
    width: 100%;
    max-width: calc(520px * var(--layout-scale, 1));
    display: grid;
    gap: calc(8px * var(--layout-scale, 1));
    margin-bottom: calc(12px * var(--layout-scale, 1));
  }
  .selected-filter-btn {
    min-height: 40px;
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: rgba(30, 41, 59, 0.78);
    color: #dbeafe;
    font-size: calc(12px * var(--layout-scale, 1));
    font-weight: 600;
    cursor: pointer;
  }

  .start-btn {
    width: calc(220px * var(--layout-scale, 1));
    height: calc(56px * var(--layout-scale, 1));
    background: #16a34a;
    border: none;
    border-radius: 12px;
    color: #fff;
    font-size: calc(18px * var(--layout-scale, 1));
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

  .filter-overlay {
    position: fixed;
    inset: 0;
    z-index: 220;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(16px * var(--layout-scale, 1));
  }

  .filter-modal {
    width: min(calc(520px * var(--layout-scale, 1)), 100%);
    max-height: 84vh;
    overflow-y: auto;
    border-radius: 12px;
    background: linear-gradient(180deg, #111827, #1f2937);
    border: 1px solid rgba(148, 163, 184, 0.45);
    padding: calc(14px * var(--layout-scale, 1));
    color: #e2e8f0;
  }

  .filter-modal h2 {
    margin: 0;
    font-size: calc(16px * var(--layout-scale, 1));
  }

  .filter-modal p {
    margin: calc(6px * var(--layout-scale, 1)) 0 calc(10px * var(--layout-scale, 1));
    font-size: calc(12px * var(--layout-scale, 1));
    color: #cbd5e1;
  }

  .filter-list {
    display: grid;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .filter-item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 8px;
    padding: calc(7px * var(--layout-scale, 1));
    font-size: calc(12px * var(--layout-scale, 1));
  }

  .count {
    color: #93c5fd;
    font-size: calc(11px * var(--text-scale, 1));
  }

  .filter-error {
    margin: calc(8px * var(--layout-scale, 1)) 0 0;
    color: #fca5a5;
    font-size: calc(12px * var(--layout-scale, 1));
  }

  .filter-actions {
    margin-top: calc(12px * var(--layout-scale, 1));
    display: flex;
    justify-content: flex-end;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .btn-ghost,
  .btn-save {
    min-height: 38px;
    padding: 0 calc(10px * var(--layout-scale, 1));
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(30, 41, 59, 0.85);
    color: #e2e8f0;
  }

  .btn-save {
    border: none;
    background: linear-gradient(180deg, #16a34a, #15803d);
    color: #f8fafc;
  }

  @media (min-width: 720px) {
    .domain-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      max-width: calc(720px * var(--layout-scale, 1));
    }
  }

  @media (min-width: 1024px) {
    .domain-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      max-width: calc(900px * var(--layout-scale, 1));
    }
  }
</style>
