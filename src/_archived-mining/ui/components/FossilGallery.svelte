<script lang="ts">
  import { FOSSIL_SPECIES, getSpeciesById } from '../../data/fossils'
  import { playerSave, persistPlayer, setActiveCompanion } from '../stores/playerData'
  import type { FossilState } from '../../data/types'
  import { audioManager } from '../../services/audioService'

  interface Props {
    onBack: () => void
  }

  let { onBack }: Props = $props()

  const fossils = $derived($playerSave?.fossils ?? {} as Record<string, FossilState>)
  const learnedCount = $derived($playerSave?.learnedFacts.length ?? 0)
  const activeCompanionId = $derived($playerSave?.activeCompanion ?? null)

  const speciesWithState = $derived(
    FOSSIL_SPECIES.map(species => {
      const state = fossils[species.id]
      return { species, state: state ?? null }
    })
  )

  const discoveredCount = $derived(
    Object.keys(fossils).length
  )

  const revivedCount = $derived(
    Object.values(fossils).filter(f => f.revived).length
  )

  // ─── Tab state (Phase 16.1) ────────────────────────────────
  let activeTab = $state<'animals' | 'crops'>('animals')

  const animalSpecies = $derived(FOSSIL_SPECIES.filter(s => !s.isCrop))
  const cropSpecies   = $derived(FOSSIL_SPECIES.filter(s =>  s.isCrop))

  const visibleSpecies = $derived(
    (activeTab === 'animals' ? animalSpecies : cropSpecies).map(species => {
      const state = fossils[species.id]
      return { species, state: state ?? null }
    })
  )

  function getRarityColor(rarity: string): string {
    switch (rarity) {
      case 'common': return '#9ca3af'
      case 'uncommon': return '#22c55e'
      case 'rare': return '#3b82f6'
      case 'legendary': return '#f59e0b'
      default: return '#9ca3af'
    }
  }

  function getRarityLabel(rarity: string): string {
    return rarity.charAt(0).toUpperCase() + rarity.slice(1)
  }

  function canRevive(speciesId: string): boolean {
    const state = fossils[speciesId]
    if (!state || state.revived) return false
    if (state.fragmentsFound < state.fragmentsNeeded) return false
    const species = getSpeciesById(speciesId)
    if (!species) return false
    // Phase 16.2: per-species fact gate
    if (species.requiredSpeciesFacts && species.requiredSpeciesFacts.length > 0) {
      const learnedSet = new Set($playerSave?.learnedFacts ?? [])
      return species.requiredSpeciesFacts.every(id => learnedSet.has(id))
    }
    // Fallback: global fact count (backward compat)
    return learnedCount >= species.requiredFacts
  }

  function speciesFactsProgress(speciesId: string): { learned: number; total: number } {
    const species = getSpeciesById(speciesId)
    if (!species || !species.requiredSpeciesFacts || species.requiredSpeciesFacts.length === 0) {
      // Fallback for species without per-species facts
      return { learned: Math.min(learnedCount, species?.requiredFacts ?? 0), total: species?.requiredFacts ?? 0 }
    }
    const learnedSet = new Set($playerSave?.learnedFacts ?? [])
    const learnedFactCount = species.requiredSpeciesFacts.filter(id => learnedSet.has(id)).length
    return { learned: learnedFactCount, total: species.requiredSpeciesFacts.length }
  }

  function handleRevive(speciesId: string): void {
    if (!canRevive(speciesId)) return
    audioManager.playSound('collect')
    playerSave.update(s => {
      if (!s) return s
      const existing = s.fossils?.[speciesId]
      if (!existing) return s
      return {
        ...s,
        fossils: {
          ...s.fossils,
          [speciesId]: {
            ...existing,
            revived: true,
            revivedAt: Date.now(),
          },
        },
      }
    })
    persistPlayer()
  }

  function handleSetCompanion(speciesId: string): void {
    audioManager.playSound('collect')
    setActiveCompanion(speciesId)
  }

  function handleRemoveCompanion(): void {
    audioManager.playSound('button_click')
    setActiveCompanion(null)
  }

  function handleBack(): void {
    audioManager.playSound('button_click')
    onBack()
  }
</script>

<div class="fossil-gallery" aria-label="Fossil Gallery">
  <div class="gallery-header">
    <button class="back-btn" type="button" onclick={handleBack}>Back</button>
    <h1 class="gallery-title">Fossil Gallery</h1>
    <div class="gallery-summary">
      {#if discoveredCount === 0}
        <span class="summary-note">No fossils discovered yet</span>
      {:else}
        <span class="summary-note">{revivedCount}/{discoveredCount} revived</span>
      {/if}
    </div>
  </div>

  <!-- Tab row (Phase 16.1) -->
  <div class="tab-row" role="tablist" aria-label="Fossil type tabs">
    <button
      class="tab-btn"
      class:tab-active={activeTab === 'animals'}
      role="tab"
      aria-selected={activeTab === 'animals'}
      type="button"
      onclick={() => { activeTab = 'animals' }}
    >
      Animals ({animalSpecies.length})
    </button>
    <button
      class="tab-btn"
      class:tab-active={activeTab === 'crops'}
      role="tab"
      aria-selected={activeTab === 'crops'}
      type="button"
      onclick={() => { activeTab = 'crops' }}
    >
      Crops ({cropSpecies.length})
    </button>
  </div>

  {#if discoveredCount === 0}
    <div class="gallery-empty-state" aria-label="No fossils discovered yet">
      <p class="gallery-empty-text">No fossils collected yet. Mine below 35% depth to discover fossil nodes!</p>
    </div>
  {/if}

  <div class="species-grid">
    {#each visibleSpecies as { species, state }}
      {@const discovered = state !== null}
      {@const complete = state !== null && state.fragmentsFound >= state.fragmentsNeeded}
      {@const revived = state?.revived ?? false}
      {@const canReviveNow = canRevive(species.id)}
      {@const factsProgress = speciesFactsProgress(species.id)}

      <div
        class="species-card"
        class:card-undiscovered={!discovered}
        class:card-discovered={discovered && !revived}
        class:card-revived={revived}
        aria-label={discovered ? species.name : 'Undiscovered species'}
      >
        <!-- Rarity badge -->
        <div class="rarity-badge" style="color: {getRarityColor(species.rarity)}; border-color: {getRarityColor(species.rarity)}44">
          {getRarityLabel(species.rarity)}
        </div>

        <!-- Icon -->
        <div class="species-icon" class:icon-hidden={!discovered} aria-hidden="true">
          {#if discovered}
            {species.icon}
          {:else}
            ?
          {/if}
        </div>

        <!-- Name and era -->
        <div class="species-name">
          {#if discovered}
            {species.name}
          {:else}
            ???
          {/if}
        </div>
        {#if discovered}
          <div class="species-era">{species.era}</div>
        {/if}

        <!-- Description -->
        {#if discovered}
          <p class="species-desc">{species.description}</p>
        {:else}
          <p class="species-desc dimmed">Discover this fossil during a dive.</p>
        {/if}

        <!-- Fragment progress -->
        {#if discovered && state}
          <div class="fragment-progress" aria-label="Fragment progress">
            <div class="fragment-label">
              Fragments: {state.fragmentsFound}/{state.fragmentsNeeded}
            </div>
            <div class="progress-bar-bg">
              <div
                class="progress-bar-fill"
                class:fill-complete={complete}
                style="width: {Math.min(100, (state.fragmentsFound / state.fragmentsNeeded) * 100)}%"
              ></div>
            </div>
          </div>
        {:else if !discovered}
          <div class="fragment-progress dimmed" aria-label="Fragment progress unknown">
            <div class="fragment-label">Fragments: ?/{species.fragmentsNeeded}</div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: 0%"></div>
            </div>
          </div>
        {/if}

        <!-- Revival section -->
        {#if revived}
          {@const isActive = activeCompanionId === species.id}
          <div class="revival-section">
            {#if species.isCrop}
              <div class="active-badge crop-badge">Revived Crop</div>
            {:else if isActive}
              <div class="active-badge">Active Companion</div>
              {#if species.companionBonus}
                <div class="companion-bonus">{species.companionBonus}</div>
              {/if}
              <button
                class="remove-companion-btn"
                type="button"
                onclick={handleRemoveCompanion}
                aria-label="Remove {species.name} as companion"
              >
                Remove
              </button>
            {:else}
              {#if species.companionBonus}
                <div class="companion-bonus">{species.companionBonus}</div>
              {/if}
              <button
                class="set-companion-btn"
                type="button"
                onclick={() => handleSetCompanion(species.id)}
                aria-label="Set {species.name} as companion"
              >
                Set as Companion
              </button>
            {/if}
          </div>
        {:else if complete}
          {#if canReviveNow}
            <button
              class="revive-btn"
              type="button"
              onclick={() => handleRevive(species.id)}
              aria-label="Revive {species.name}"
            >
              Revive!
            </button>
          {:else}
            <div class="revive-locked">
              Know {factsProgress.learned}/{factsProgress.total} species facts
            </div>
            <div class="species-fact-bar">
              <div class="species-fact-fill" style="width: {(factsProgress.learned / Math.max(1, factsProgress.total)) * 100}%"></div>
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .fossil-gallery {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 30;
    background: var(--color-bg);
    font-family: 'Courier New', monospace;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .gallery-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--color-surface);
    border-bottom: 1px solid rgba(212, 165, 116, 0.3);
    flex-shrink: 0;
  }

  .back-btn {
    min-height: 40px;
    padding: 0 16px;
    border: 1px solid rgba(212, 165, 116, 0.5);
    border-radius: 8px;
    background: rgba(212, 165, 116, 0.15);
    color: #d4a574;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .back-btn:active {
    background: rgba(212, 165, 116, 0.3);
    transform: translateY(1px);
  }

  .gallery-title {
    color: #d4a574;
    font-size: clamp(1.2rem, 4vw, 1.6rem);
    margin: 0;
    flex: 1;
  }

  .gallery-summary {
    flex-shrink: 0;
  }

  .summary-note {
    color: var(--color-text-dim);
    font-size: 0.8rem;
  }

  .gallery-empty-state {
    padding: 2rem 1rem;
    text-align: center;
    flex-shrink: 0;
  }

  .gallery-empty-text {
    color: var(--color-text-dim);
    font-size: 0.85rem;
    line-height: 1.5;
    margin: 0;
    font-style: italic;
  }

  .species-grid {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
    -webkit-overflow-scrolling: touch;
    align-content: start;
  }

  .species-card {
    position: relative;
    border-radius: 12px;
    padding: 14px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    transition: transform 0.1s;
  }

  .card-undiscovered {
    background: color-mix(in srgb, var(--color-bg) 50%, var(--color-surface) 50%);
    border: 1px solid rgba(255, 255, 255, 0.06);
    opacity: 0.65;
  }

  .card-discovered {
    background: color-mix(in srgb, #d4a574 12%, var(--color-surface) 88%);
    border: 1px solid rgba(212, 165, 116, 0.3);
  }

  .card-revived {
    background: color-mix(in srgb, #d4a574 22%, var(--color-surface) 78%);
    border: 1px solid rgba(212, 165, 116, 0.7);
    box-shadow: 0 0 12px rgba(212, 165, 116, 0.2);
  }

  .species-card:active {
    transform: scale(0.98);
  }

  .rarity-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border: 1px solid;
    border-radius: 999px;
    padding: 2px 7px;
  }

  .species-icon {
    font-size: 2.4rem;
    line-height: 1;
    margin-top: 4px;
    margin-bottom: 2px;
  }

  .icon-hidden {
    filter: grayscale(1) opacity(0.4);
    font-size: 2rem;
  }

  .species-name {
    color: var(--color-text);
    font-size: 0.88rem;
    font-weight: 700;
    text-align: center;
    line-height: 1.2;
  }

  .species-era {
    color: #d4a574;
    font-size: 0.72rem;
    text-align: center;
    letter-spacing: 0.03em;
  }

  .species-desc {
    color: var(--color-text-dim);
    font-size: 0.73rem;
    text-align: center;
    line-height: 1.35;
    margin: 0;
  }

  .species-desc.dimmed {
    opacity: 0.6;
    font-style: italic;
  }

  .fragment-progress {
    width: 100%;
    margin-top: 4px;
  }

  .fragment-progress.dimmed {
    opacity: 0.5;
  }

  .fragment-label {
    color: var(--color-text-dim);
    font-size: 0.72rem;
    margin-bottom: 4px;
    text-align: center;
  }

  .progress-bar-bg {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: #d4a574;
    border-radius: 999px;
    transition: width 0.3s ease;
  }

  .fill-complete {
    background: #22c55e;
  }

  .revival-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    width: 100%;
  }

  .active-badge {
    background: color-mix(in srgb, #22c55e 30%, var(--color-surface) 70%);
    color: #22c55e;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 999px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .companion-bonus {
    color: #d4a574;
    font-size: 0.7rem;
    text-align: center;
    font-style: italic;
    line-height: 1.3;
  }

  .revive-btn {
    margin-top: 6px;
    width: 100%;
    min-height: 36px;
    border: 0;
    border-radius: 8px;
    background: color-mix(in srgb, #d4a574 40%, var(--color-surface) 60%);
    color: #1a0e00;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.03em;
    transition: background 0.15s;
  }

  .revive-btn:active {
    transform: translateY(1px);
    background: color-mix(in srgb, #d4a574 55%, var(--color-surface) 45%);
  }

  .set-companion-btn {
    margin-top: 4px;
    width: 100%;
    min-height: 34px;
    border: 1px solid rgba(212, 165, 116, 0.6);
    border-radius: 8px;
    background: color-mix(in srgb, #d4a574 20%, var(--color-surface) 80%);
    color: #d4a574;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.03em;
    transition: background 0.15s, border-color 0.15s;
  }

  .set-companion-btn:active {
    transform: translateY(1px);
    background: color-mix(in srgb, #d4a574 35%, var(--color-surface) 65%);
  }

  .remove-companion-btn {
    margin-top: 4px;
    width: 100%;
    min-height: 30px;
    border: 1px solid rgba(100, 100, 120, 0.4);
    border-radius: 7px;
    background: transparent;
    color: var(--color-text-dim);
    font-family: inherit;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: background 0.15s, border-color 0.15s;
  }

  .remove-companion-btn:active {
    transform: translateY(1px);
    background: rgba(255, 80, 80, 0.12);
    border-color: rgba(255, 80, 80, 0.3);
    color: #ff6b6b;
  }

  .revive-locked {
    margin-top: 6px;
    color: var(--color-text-dim);
    font-size: 0.72rem;
    text-align: center;
    font-style: italic;
    padding: 4px 6px;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    width: 100%;
    box-sizing: border-box;
  }

  @media (max-width: 420px) {
    .species-grid {
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 8px;
    }

    .species-card {
      padding: 10px 8px;
    }

    .species-icon {
      font-size: 1.8rem;
    }
  }

  /* ─── Tabs (Phase 16.1) ─── */
  .tab-row {
    display: flex;
    gap: 4px;
    padding: 8px 12px;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .tab-btn {
    flex: 1;
    border: 1px solid rgba(212, 165, 116, 0.3);
    border-radius: 8px;
    background: transparent;
    color: var(--color-text-dim);
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .tab-active {
    background: rgba(212, 165, 116, 0.2);
    color: #d4a574;
    border-color: rgba(212, 165, 116, 0.6);
  }

  .tab-btn:active {
    transform: translateY(1px);
  }

  .crop-badge {
    background: color-mix(in srgb, #3cb371 30%, var(--color-surface) 70%) !important;
    color: #3cb371 !important;
  }

  /* ─── Species fact progress bar (Phase 16.2) ─── */
  .species-fact-bar {
    width: 100%;
    height: 5px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
    margin-top: 4px;
  }

  .species-fact-fill {
    height: 100%;
    background: linear-gradient(90deg, #22c55e, #4ade80);
    border-radius: 999px;
    transition: width 0.3s ease;
  }
</style>
