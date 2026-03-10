<script lang="ts">
  import type { FactDomain } from '../../data/card-types'
  import { normalizeFactDomain } from '../../data/card-types'
  import { getAllDomainMetadata } from '../../data/domainMetadata'
  import { getDomainIconPath } from '../utils/domainAssets'
  import { ENABLE_LANGUAGE_DOMAINS } from '../../data/balance'
  import { playerSave, persistPlayer } from '../stores/playerData'
  import { hasArcanePass } from '../../services/subscriptionService'
  import { getDomainSubcategories } from '../../services/domainSubcategoryService'

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
  const arcanePassActive = $derived($playerSave ? hasArcanePass($playerSave) : false)

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

  function getStoredFilter(domainId: FactDomain): string[] {
    const filters = $playerSave?.subscriberCategoryFilters ?? {}
    const key = normalizeFactDomain(domainId)
    const value = filters[key]
    return Array.isArray(value) ? [...value] : []
  }

  function openFilterModal(domainId: FactDomain): void {
    if (!arcanePassActive) return
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
</script>

<div class="domain-selection-overlay">
  <button class="back-btn" onclick={onback}>&larr; Back</button>

  <h1 class="title">What are you curious about?</h1>
  <p class="subtitle">Pick 2 to specialize in. You can always add more later.</p>
  {#if arcanePassActive}
    <p class="subtitle subtitle-pass">Arcane Pass: selected domains can be filtered by sub-category.</p>
  {:else}
    <p class="subtitle subtitle-pass locked">Arcane Pass unlocks sub-category filters.</p>
  {/if}

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

  {#if primaryDomain || secondaryDomain}
    <div class="selected-filters">
      {#if primaryDomain}
        <button
          type="button"
          class="selected-filter-btn"
          onclick={() => { if (primaryDomain) openFilterModal(primaryDomain) }}
          disabled={!arcanePassActive}
        >
          Filter PRIMARY: {DOMAINS.find((entry) => entry.id === primaryDomain)?.shortName}
        </button>
      {/if}
      {#if secondaryDomain}
        <button
          type="button"
          class="selected-filter-btn"
          onclick={() => { if (secondaryDomain) openFilterModal(secondaryDomain) }}
          disabled={!arcanePassActive}
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
  .subtitle-pass {
    margin-top: -16px;
    margin-bottom: 20px;
    font-size: 12px;
  }
  .subtitle-pass.locked {
    color: #94a3b8;
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
  .selected-filters {
    width: 100%;
    max-width: 520px;
    display: grid;
    gap: 8px;
    margin-bottom: 12px;
  }
  .selected-filter-btn {
    min-height: 40px;
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: rgba(30, 41, 59, 0.78);
    color: #dbeafe;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .selected-filter-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
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

  .filter-overlay {
    position: fixed;
    inset: 0;
    z-index: 220;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .filter-modal {
    width: min(520px, 100%);
    max-height: 84vh;
    overflow-y: auto;
    border-radius: 12px;
    background: linear-gradient(180deg, #111827, #1f2937);
    border: 1px solid rgba(148, 163, 184, 0.45);
    padding: 14px;
    color: #e2e8f0;
  }

  .filter-modal h2 {
    margin: 0;
    font-size: 16px;
  }

  .filter-modal p {
    margin: 6px 0 10px;
    font-size: 12px;
    color: #cbd5e1;
  }

  .filter-list {
    display: grid;
    gap: 6px;
  }

  .filter-item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 8px;
    padding: 7px;
    font-size: 12px;
  }

  .count {
    color: #93c5fd;
    font-size: 11px;
  }

  .filter-error {
    margin: 8px 0 0;
    color: #fca5a5;
    font-size: 12px;
  }

  .filter-actions {
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn-ghost,
  .btn-save {
    min-height: 38px;
    padding: 0 10px;
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
    }
  }
</style>
