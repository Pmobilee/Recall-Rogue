<script lang="ts">
  import { playerSave, persistPlayer } from '../stores/playerData'
  import { audioManager } from '../../services/audioService'
  import {
    collectFarmResources,
    placeFarmAnimal,
    removeFarmAnimal,
    expandFarm,
  } from '../../services/saveService'
  import {
    calculateProduction,
    calculateHourlyRates,
    calculateTotalPending,
    getCropGrowthStage,
    getCropGrowthPercent,
    CROP_CYCLE_HOURS,
    FARM_PRODUCTION,
    FARM_EXPANSION_COSTS,
    FARM_MAX_SLOTS,
  } from '../../data/farm'
  import { FOSSIL_SPECIES } from '../../data/fossils'
  import type { FarmSlot } from '../../data/types'

  interface Props {
    /** Called when the user presses the Back button. */
    onBack: () => void
  }

  let { onBack }: Props = $props()

  // ---- Derived state ----

  const farm = $derived($playerSave?.farm ?? { slots: [null, null, null], maxSlots: 3 })
  const fossilsRecord = $derived($playerSave?.fossils ?? {})

  /** Revived species that are not already placed on the farm. */
  const availableCompanions = $derived.by(() => {
    const placedIds = new Set(
      farm.slots.filter((s): s is FarmSlot => s !== null).map(s => s.speciesId),
    )
    return FOSSIL_SPECIES.filter(
      sp => !sp.isCrop && fossilsRecord[sp.id]?.revived && !placedIds.has(sp.id),
    )
  })

  /** Revived CROP species not yet placed on farm. */
  const availableCrops = $derived.by(() => {
    const placedIds = new Set(
      farm.slots.filter((s): s is FarmSlot => s !== null).map(s => s.speciesId),
    )
    return FOSSIL_SPECIES.filter(
      sp => sp.isCrop === true && fossilsRecord[sp.id]?.revived && !placedIds.has(sp.id),
    )
  })

  const hourlyRates = $derived(calculateHourlyRates(farm.slots))
  const pendingTotals = $derived(calculateTotalPending(farm.slots))

  const anyPending = $derived(
    pendingTotals.dust > 0 || pendingTotals.shard > 0 || pendingTotals.crystal > 0,
  )

  const canExpand = $derived(farm.maxSlots < FARM_MAX_SLOTS)
  const expansionCost = $derived.by(() => {
    const idx = farm.maxSlots - 3
    return FARM_EXPANSION_COSTS[idx] ?? null
  })

  function canAffordExpansion(): boolean {
    const save = $playerSave
    if (!save || !expansionCost) return false
    for (const [tier, amount] of Object.entries(expansionCost) as ['dust' | 'shard' | 'crystal', number][]) {
      if ((save.minerals[tier] ?? 0) < amount) return false
    }
    return true
  }

  const canAffordExpand = $derived.by(() => {
    $playerSave
    return canAffordExpansion()
  })

  // ---- Slot interaction state ----

  /** Index of the slot whose remove confirmation is showing (-1 = none). */
  let confirmRemoveIndex = $state(-1)

  /** Index of the empty slot that is showing the "place companion" dropdown (-1 = none). */
  let placingInSlot = $state(-1)

  /** Index of the empty slot showing the "plant crop" picker (-1 = none). */
  let plantingInSlot = $state(-1)

  // ---- Handlers ----

  function handleBack(): void {
    audioManager.playSound('button_click')
    onBack()
  }

  function handleCollectAll(): void {
    const save = $playerSave
    if (!save || !anyPending) return
    audioManager.playSound('button_click')
    const { updatedSave } = collectFarmResources(save)
    playerSave.set(updatedSave)
  }

  function handleCollectSlot(slotIndex: number): void {
    const save = $playerSave
    if (!save) return
    const slot = save.farm.slots[slotIndex]
    if (!slot) return
    const result = calculateProduction(slot)
    if (!result || result.amount <= 0) return
    audioManager.playSound('button_click')
    // Collect only this one slot by temporarily zeroing others to avoid double-counting
    // Instead, collect all (simpler, correct) — the GAIA toast in App handles messaging
    const { updatedSave } = collectFarmResources(save)
    playerSave.set(updatedSave)
  }

  function isCropSpecies(speciesId: string): boolean {
    return FOSSIL_SPECIES.find(s => s.id === speciesId)?.isCrop === true
  }

  function getGrowthStageIcon(stage: string, speciesIcon: string): string {
    switch (stage) {
      case 'seed': return '🌰'
      case 'sprout': return '🌱'
      case 'mature': return '🌿'
      case 'harvestable': return speciesIcon
      default: return '🌰'
    }
  }

  function getGrowthStageLabel(stage: string): string {
    switch (stage) {
      case 'seed': return 'Seed'
      case 'sprout': return 'Sprout'
      case 'mature': return 'Mature'
      case 'harvestable': return 'Harvestable!'
      default: return ''
    }
  }

  function handlePlantOpen(slotIndex: number): void {
    audioManager.playSound('button_click')
    plantingInSlot = slotIndex
    placingInSlot = -1
    confirmRemoveIndex = -1
  }

  function handlePlantCrop(speciesId: string): void {
    const save = $playerSave
    if (!save) return
    audioManager.playSound('button_click')
    const { success, updatedSave } = placeFarmAnimal(save, plantingInSlot, speciesId)
    if (success) {
      playerSave.set(updatedSave)
    }
    plantingInSlot = -1
  }

  function handlePlaceOpen(slotIndex: number): void {
    audioManager.playSound('button_click')
    placingInSlot = slotIndex
    confirmRemoveIndex = -1
  }

  function handlePlaceCompanion(speciesId: string): void {
    const save = $playerSave
    if (!save) return
    audioManager.playSound('button_click')
    const { success, updatedSave } = placeFarmAnimal(save, placingInSlot, speciesId)
    if (success) {
      playerSave.set(updatedSave)
    }
    placingInSlot = -1
  }

  function handleRemoveRequest(slotIndex: number): void {
    audioManager.playSound('button_click')
    confirmRemoveIndex = slotIndex
    placingInSlot = -1
    plantingInSlot = -1
  }

  function handleRemoveConfirm(): void {
    const save = $playerSave
    if (!save || confirmRemoveIndex < 0) return
    audioManager.playSound('button_click')
    const { success, updatedSave } = removeFarmAnimal(save, confirmRemoveIndex)
    if (success) {
      playerSave.set(updatedSave)
    }
    confirmRemoveIndex = -1
  }

  function handleRemoveCancel(): void {
    audioManager.playSound('button_click')
    confirmRemoveIndex = -1
  }

  function handleExpandFarm(): void {
    const save = $playerSave
    if (!save || !canAffordExpand) return
    audioManager.playSound('button_click')
    const { success, updatedSave } = expandFarm(save)
    if (success) {
      playerSave.set(updatedSave)
    }
  }

  function formatRate(rate: number): string {
    if (rate === 0) return '0'
    if (rate < 1) return rate.toFixed(1)
    return rate.toFixed(rate % 1 === 0 ? 0 : 1)
  }

  function formatExpansionCost(cost: Partial<Record<'dust' | 'shard' | 'crystal', number>>): string {
    return Object.entries(cost)
      .map(([tier, amount]) => `${amount} ${tier}`)
      .join(' + ')
  }

  function getSpeciesInfo(speciesId: string) {
    return FOSSIL_SPECIES.find(s => s.id === speciesId)
  }

  function getSlotPending(slot: FarmSlot | null): { tier: string; amount: number } | null {
    if (!slot) return null
    return calculateProduction(slot)
  }

  function getProductionRate(speciesId: string): string {
    const prod = FARM_PRODUCTION[speciesId]
    if (!prod) return '?'
    return `${formatRate(prod.amountPerHour)} ${prod.mineralTier}/hr`
  }
</script>

<section class="farm-view" aria-label="The Farm">
  <!-- Header -->
  <div class="farm-header">
    <button class="back-btn" type="button" onclick={handleBack} aria-label="Back">
      Back
    </button>
    <h1 class="farm-title">The Farm</h1>
    {#if anyPending}
      <button class="collect-all-btn" type="button" onclick={handleCollectAll} aria-label="Collect all resources">
        Collect All
      </button>
    {:else}
      <div class="header-spacer"></div>
    {/if}
  </div>

  <!-- Production summary -->
  <div class="card summary-card" aria-label="Farm production rates">
    <div class="summary-title">Hourly Production</div>
    <div class="summary-rates">
      <span class="rate-item rate-dust">
        <span class="rate-dot dust-dot"></span>
        {formatRate(hourlyRates.dust)} dust/hr
      </span>
      <span class="rate-item rate-shard">
        <span class="rate-dot shard-dot"></span>
        {formatRate(hourlyRates.shard)} shard/hr
      </span>
      <span class="rate-item rate-crystal">
        <span class="rate-dot crystal-dot"></span>
        {formatRate(hourlyRates.crystal)} crystal/hr
      </span>
    </div>
    {#if anyPending}
      <div class="pending-banner" aria-live="polite">
        <span class="pending-icon">&#127807;</span>
        Resources ready:
        {#if pendingTotals.dust > 0}<span class="pending-dust">{pendingTotals.dust} dust</span>{/if}
        {#if pendingTotals.shard > 0}<span class="pending-shard">{pendingTotals.shard} shard</span>{/if}
        {#if pendingTotals.crystal > 0}<span class="pending-crystal">{pendingTotals.crystal} crystal</span>{/if}
      </div>
    {/if}
  </div>

  <!-- Empty state banner: shown when no companions have been placed yet -->
  {#if farm.slots.every(s => s === null)}
    <div class="farm-empty-state" aria-label="Farm is empty">
      <p class="farm-empty-text">Your farm is empty. Revive fossils and assign them here to produce resources over time.</p>
    </div>
  {/if}

  <!-- Farm slots grid -->
  <div class="slots-grid" aria-label="Farm slots">
    {#each { length: farm.maxSlots } as _, i}
      {@const slot = farm.slots[i] ?? null}
      {@const species = slot ? getSpeciesInfo(slot.speciesId) : null}
      {@const pending = getSlotPending(slot)}
      {@const isConfirmingRemove = confirmRemoveIndex === i}
      {@const isPlacing = placingInSlot === i}

      <div
        class="slot-card"
        class:slot-occupied={slot !== null}
        class:slot-ready={pending !== null && (pending.amount ?? 0) > 0}
        aria-label={slot ? `${species?.name ?? slot.speciesId} farm slot` : 'Empty farm slot'}
      >
        {#if slot && species}
          <!-- Occupied slot -->
          {#if isCropSpecies(slot.speciesId)}
            <!-- Crop slot with growth stages -->
            {@const cropStage = getCropGrowthStage(slot, slot.speciesId)}
            {@const cropPct = getCropGrowthPercent(slot, slot.speciesId)}
            {@const stageIcon = getGrowthStageIcon(cropStage ?? 'seed', species.icon)}

            <div
              class="slot-icon"
              class:icon-harvestable={cropStage === 'harvestable'}
              aria-hidden="true"
            >{stageIcon}</div>
            <div class="slot-name">{species.name}</div>
            <div class="slot-stage-label stage-{cropStage ?? 'seed'}">{getGrowthStageLabel(cropStage ?? 'seed')}</div>

            <!-- Growth progress bar -->
            <div class="growth-bar-bg" aria-label="Crop growth progress">
              <div class="growth-bar-fill stage-{cropStage ?? 'seed'}" style="width: {cropPct}%"></div>
            </div>

            <div class="slot-rate">{getProductionRate(slot.speciesId)}</div>

            {#if pending && pending.amount > 0}
              <div class="slot-pending" aria-label="Ready to harvest">
                Ready: <span class="pending-amount">{pending.amount} {pending.tier}</span>
              </div>
              <button
                class="slot-btn collect-btn"
                type="button"
                onclick={() => handleCollectSlot(i)}
                aria-label="Harvest {pending.amount} {pending.tier} from {species.name}"
              >
                Harvest
              </button>
            {:else}
              <div class="slot-pending dim">Growing...</div>
            {/if}

            {#if isConfirmingRemove}
              <div class="confirm-row" aria-label="Confirm removal">
                <span class="confirm-text">Uproot {species.name}?</span>
                <button class="slot-btn remove-confirm-btn" type="button" onclick={handleRemoveConfirm}>
                  Yes, Uproot
                </button>
                <button class="slot-btn cancel-btn" type="button" onclick={handleRemoveCancel}>
                  Cancel
                </button>
              </div>
            {:else}
              <button
                class="slot-remove-btn"
                type="button"
                onclick={() => handleRemoveRequest(i)}
                aria-label="Uproot {species.name} from farm"
                title="Uproot crop (uncollected resources lost)"
              >
                Uproot
              </button>
            {/if}
          {:else}
            <!-- Animal companion slot (existing behavior) -->
            <div class="slot-icon" aria-hidden="true">{species.icon}</div>
            <div class="slot-name">{species.name}</div>
            <div class="slot-rate">{getProductionRate(slot.speciesId)}</div>

            {#if pending && pending.amount > 0}
              <div class="slot-pending" aria-label="Ready to collect">
                Ready: <span class="pending-amount">{pending.amount} {pending.tier}</span>
              </div>
              <button
                class="slot-btn collect-btn"
                type="button"
                onclick={() => handleCollectSlot(i)}
                aria-label="Collect {pending.amount} {pending.tier} from {species.name}"
              >
                Collect
              </button>
            {:else}
              <div class="slot-pending dim">No resources yet</div>
            {/if}

            {#if isConfirmingRemove}
              <div class="confirm-row" aria-label="Confirm removal">
                <span class="confirm-text">Remove {species.name}?</span>
                <button class="slot-btn remove-confirm-btn" type="button" onclick={handleRemoveConfirm}>
                  Yes, Remove
                </button>
                <button class="slot-btn cancel-btn" type="button" onclick={handleRemoveCancel}>
                  Cancel
                </button>
              </div>
            {:else}
              <button
                class="slot-remove-btn"
                type="button"
                onclick={() => handleRemoveRequest(i)}
                aria-label="Remove {species.name} from farm"
                title="Remove from farm (uncollected resources lost)"
              >
                Remove
              </button>
            {/if}
          {/if}

        {:else}
          <!-- Empty slot -->
          <div class="slot-empty-icon" aria-hidden="true">&#128203;</div>
          <div class="slot-name dim">Empty Slot</div>

          {#if isPlacing}
            <!-- Companion picker -->
            <div class="companion-picker" aria-label="Choose a companion to place">
              {#if availableCompanions.length === 0}
                <span class="no-companions">No revived companions available</span>
              {:else}
                {#each availableCompanions as sp}
                  <button
                    class="companion-option"
                    type="button"
                    onclick={() => handlePlaceCompanion(sp.id)}
                    aria-label="Place {sp.name}"
                    title="{sp.name} — {getProductionRate(sp.id)}"
                  >
                    <span class="companion-opt-icon">{sp.icon}</span>
                    <span class="companion-opt-name">{sp.name}</span>
                    <span class="companion-opt-rate">{getProductionRate(sp.id)}</span>
                  </button>
                {/each}
              {/if}
              <button
                class="slot-btn cancel-btn"
                type="button"
                onclick={() => { placingInSlot = -1 }}
              >
                Cancel
              </button>
            </div>
          {:else if plantingInSlot === i}
            <!-- Crop picker -->
            <div class="companion-picker" aria-label="Choose a crop to plant">
              {#if availableCrops.length === 0}
                <span class="no-companions">No revived crops available</span>
              {:else}
                {#each availableCrops as sp}
                  <button
                    class="companion-option"
                    type="button"
                    onclick={() => handlePlantCrop(sp.id)}
                    aria-label="Plant {sp.name}"
                  >
                    <span class="companion-opt-icon">{sp.icon}</span>
                    <span class="companion-opt-name">{sp.name}</span>
                    <span class="companion-opt-rate">{getProductionRate(sp.id)}</span>
                  </button>
                {/each}
              {/if}
              <button
                class="slot-btn cancel-btn"
                type="button"
                onclick={() => { plantingInSlot = -1 }}
              >
                Cancel
              </button>
            </div>
          {:else}
            <!-- Default empty state: two buttons -->
            <button
              class="slot-btn place-btn"
              type="button"
              onclick={() => handlePlaceOpen(i)}
              disabled={availableCompanions.length === 0}
              aria-label={availableCompanions.length === 0 ? 'No companions available' : 'Place a companion'}
            >
              {availableCompanions.length === 0 ? 'No companions' : 'Place Companion'}
            </button>
            <button
              class="slot-btn plant-btn"
              type="button"
              onclick={() => handlePlantOpen(i)}
              disabled={availableCrops.length === 0}
              aria-label={availableCrops.length === 0 ? 'No crops available' : 'Plant a crop'}
            >
              {availableCrops.length === 0 ? 'No crops' : 'Plant Crop'}
            </button>
          {/if}
        {/if}
      </div>
    {/each}
  </div>

  <!-- Farm expansion -->
  {#if canExpand}
    <div class="card expand-card" aria-label="Farm expansion">
      <div class="expand-info">
        <span class="expand-label">Expand Farm</span>
        <span class="expand-slots">{farm.maxSlots} / {FARM_MAX_SLOTS} slots</span>
      </div>
      {#if expansionCost}
        <div class="expand-cost">
          Cost: {formatExpansionCost(expansionCost)}
        </div>
        <button
          class="expand-btn"
          type="button"
          onclick={handleExpandFarm}
          disabled={!canAffordExpand}
          aria-label="Expand farm — costs {formatExpansionCost(expansionCost)}"
        >
          {canAffordExpand ? 'Expand Farm' : 'Cannot Afford'}
        </button>
      {/if}
    </div>
  {:else}
    <div class="card expand-card expand-maxed" aria-label="Farm at maximum size">
      <span class="expand-maxed-text">Farm at maximum capacity ({FARM_MAX_SLOTS} slots)</span>
    </div>
  {/if}

  <!-- Help note -->
  <div class="help-card">
    <p class="help-text">
      Revived fossil companions produce resources over real time (up to 24h).
      A companion can work the farm and be your dive companion simultaneously.
    </p>
  </div>
</section>

<style>
  .farm-view {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 30;
    overflow-y: auto;
    background: var(--color-bg);
    padding: 8px;
    font-family: 'Courier New', monospace;
    -webkit-overflow-scrolling: touch;
  }

  /* ---- Header ---- */
  .farm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px;
    margin-bottom: 4px;
  }

  .back-btn {
    border: 1px solid var(--color-text-dim);
    border-radius: 10px;
    background: var(--color-surface);
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    padding: 8px 14px;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .back-btn:active {
    opacity: 0.75;
    transform: translateY(1px);
  }

  .farm-title {
    color: var(--color-success);
    font-size: clamp(1.4rem, 5vw, 2rem);
    font-weight: 800;
    letter-spacing: 2px;
    margin: 0;
    text-align: center;
    flex: 1;
  }

  .collect-all-btn {
    border: 0;
    border-radius: 10px;
    background: var(--color-success);
    color: #0b231a;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 800;
    padding: 8px 14px;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.15s, transform 0.1s;
  }

  .collect-all-btn:active {
    transform: translateY(1px);
    opacity: 0.85;
  }

  .header-spacer {
    min-width: 80px;
  }

  /* ---- Cards ---- */
  .card {
    background: var(--color-surface);
    border-radius: 12px;
    padding: 14px 16px;
    margin: 8px;
  }

  /* ---- Summary ---- */
  .summary-card {
    border: 1px solid rgba(78, 204, 163, 0.3);
  }

  .summary-title {
    color: var(--color-text-dim);
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
  }

  .summary-rates {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .rate-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .rate-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .dust-dot { background: #4ecca3; }
  .shard-dot { background: #ffd369; }
  .crystal-dot { background: #e94560; }

  .rate-dust { color: #4ecca3; }
  .rate-shard { color: #ffd369; }
  .rate-crystal { color: #e94560; }

  .pending-banner {
    margin-top: 10px;
    padding: 8px 10px;
    background: rgba(78, 204, 163, 0.12);
    border: 1px solid rgba(78, 204, 163, 0.4);
    border-radius: 8px;
    font-size: 0.82rem;
    color: var(--color-text);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .pending-icon { font-size: 1rem; }

  .pending-dust  { color: #4ecca3; font-weight: 700; }
  .pending-shard { color: #ffd369; font-weight: 700; }
  .pending-crystal { color: #e94560; font-weight: 700; }

  /* ---- Slots Grid ---- */
  .slots-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding: 0 8px;
    margin-bottom: 4px;
  }

  .slot-card {
    background: var(--color-surface);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 14px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-height: 180px;
    transition: border-color 0.2s;
  }

  .slot-occupied {
    border-color: rgba(78, 204, 163, 0.3);
  }

  .slot-ready {
    border-color: rgba(78, 204, 163, 0.7);
    box-shadow: 0 0 0 1px rgba(78, 204, 163, 0.3);
  }

  .slot-icon {
    font-size: 2rem;
    line-height: 1;
  }

  .slot-empty-icon {
    font-size: 1.6rem;
    opacity: 0.35;
    line-height: 1;
  }

  .slot-name {
    color: var(--color-text);
    font-size: 0.88rem;
    font-weight: 700;
    text-align: center;
  }

  .slot-name.dim {
    color: var(--color-text-dim);
    font-weight: 400;
  }

  .slot-rate {
    color: var(--color-text-dim);
    font-size: 0.75rem;
    text-align: center;
  }

  .slot-pending {
    font-size: 0.78rem;
    color: var(--color-success);
    font-weight: 600;
    text-align: center;
  }

  .slot-pending.dim {
    color: var(--color-text-dim);
    font-weight: 400;
  }

  .pending-amount {
    font-weight: 800;
  }

  /* ---- Buttons inside slots ---- */
  .slot-btn {
    width: 100%;
    border: 0;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 7px 8px;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    margin-top: auto;
  }

  .slot-btn:active {
    transform: translateY(1px);
    opacity: 0.85;
  }

  .slot-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .collect-btn {
    background: var(--color-success);
    color: #0b231a;
  }

  .place-btn {
    background: color-mix(in srgb, var(--color-primary) 60%, var(--color-surface) 40%);
    color: var(--color-text);
  }

  .cancel-btn {
    background: color-mix(in srgb, var(--color-text-dim) 30%, var(--color-surface) 70%);
    color: var(--color-text);
  }

  .remove-confirm-btn {
    background: color-mix(in srgb, var(--color-accent) 60%, var(--color-surface) 40%);
    color: var(--color-text);
  }

  .slot-remove-btn {
    border: 1px solid rgba(233, 69, 96, 0.4);
    border-radius: 7px;
    background: none;
    color: #e94560;
    font-family: inherit;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 5px 10px;
    cursor: pointer;
    margin-top: auto;
    transition: background 0.15s, opacity 0.15s;
  }

  .slot-remove-btn:active {
    background: rgba(233, 69, 96, 0.18);
  }

  /* ---- Confirm row ---- */
  .confirm-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    margin-top: auto;
  }

  .confirm-text {
    color: #e94560;
    font-size: 0.75rem;
    font-weight: 600;
    text-align: center;
  }

  /* ---- Companion Picker ---- */
  .companion-picker {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    margin-top: 4px;
  }

  .no-companions {
    color: var(--color-text-dim);
    font-size: 0.75rem;
    text-align: center;
    font-style: italic;
  }

  .companion-option {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-bg) 50%, var(--color-surface) 50%);
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.78rem;
    padding: 6px 8px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, border-color 0.15s;
  }

  .companion-option:active {
    background: color-mix(in srgb, var(--color-primary) 20%, var(--color-surface) 80%);
    border-color: var(--color-primary);
  }

  .companion-opt-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .companion-opt-name {
    flex: 1;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .companion-opt-rate {
    color: var(--color-text-dim);
    font-size: 0.7rem;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ---- Expansion ---- */
  .expand-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border: 1px solid rgba(255, 211, 105, 0.25);
  }

  .expand-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .expand-label {
    color: var(--color-warning);
    font-size: 0.9rem;
    font-weight: 700;
  }

  .expand-slots {
    color: var(--color-text-dim);
    font-size: 0.8rem;
  }

  .expand-cost {
    color: var(--color-text-dim);
    font-size: 0.8rem;
  }

  .expand-btn {
    border: 0;
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-warning) 30%, var(--color-surface) 70%);
    color: var(--color-warning);
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    padding: 10px 16px;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    letter-spacing: 0.02em;
  }

  .expand-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .expand-btn:not(:disabled):active {
    transform: translateY(1px);
    opacity: 0.85;
  }

  .expand-maxed {
    border-color: rgba(78, 204, 163, 0.25);
    text-align: center;
  }

  .expand-maxed-text {
    color: var(--color-success);
    font-size: 0.85rem;
    font-weight: 600;
  }

  /* ---- Empty state ---- */
  .farm-empty-state {
    margin: 4px 8px 0;
    padding: 1.5rem 1rem;
    text-align: center;
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
  }

  .farm-empty-text {
    color: var(--color-text-dim);
    font-size: 0.82rem;
    line-height: 1.5;
    margin: 0;
    font-style: italic;
  }

  /* ---- Help ---- */
  .help-card {
    margin: 8px;
    padding: 10px 14px;
    background: rgba(20, 20, 40, 0.5);
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .help-text {
    color: var(--color-text-dim);
    font-size: 0.75rem;
    line-height: 1.45;
    margin: 0;
    font-style: italic;
  }

  /* ---- Responsive ---- */
  @media (max-width: 380px) {
    .slots-grid {
      grid-template-columns: 1fr;
    }
  }

  /* ─── Growth stages (Phase 16.3) ─── */
  .growth-bar-bg {
    width: 100%;
    height: 5px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
    margin: 2px 0;
  }

  .growth-bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.5s ease;
  }

  .growth-bar-fill.stage-seed     { background: #a0522d; }
  .growth-bar-fill.stage-sprout   { background: #7ec850; }
  .growth-bar-fill.stage-mature   { background: #3cb371; }
  .growth-bar-fill.stage-harvestable { background: #ffd700; }

  .slot-stage-label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .stage-seed        { color: #a0522d; }
  .stage-sprout      { color: #7ec850; }
  .stage-mature      { color: #3cb371; }
  .stage-harvestable { color: #ffd700; }

  .icon-harvestable {
    animation: crop-pulse 1.4s ease-in-out infinite;
  }

  @keyframes crop-pulse {
    0%   { filter: drop-shadow(0 0 4px #ffd700aa); }
    50%  { filter: drop-shadow(0 0 10px #ffd700ff); }
    100% { filter: drop-shadow(0 0 4px #ffd700aa); }
  }

  .plant-btn {
    background: color-mix(in srgb, #3cb371 50%, var(--color-surface) 50%);
    color: var(--color-text);
  }
</style>
