<script lang="ts">
  import { onMount } from 'svelte'
  import { BALANCE } from '../../data/balance'
  import { CONSUMABLE_DEFS, type ConsumableId } from '../../data/consumables'
  import { RELIC_CATALOGUE, type RelicDefinition } from '../../data/relics'
  import {
    selectedLoadout,
    loadoutReady,
    relicVault,
    equippedRelicsV2,
    currentLayer,
    layerTierLabel,
  } from '../stores/gameState'
  import { playerSave } from '../stores/playerData'
  import MinePreviewThumbnail from './MinePreviewThumbnail.svelte'
  import { minePreviewDataUrl } from '../../game/systems/MinePreview'
  import { generateMine, seededRandom } from '../../game/systems/MineGenerator'
  import { DEFAULT_BIOME, selectBiome } from '../../data/biomes'

  interface Props {
    availableTanks: number
    onStartDive: (tanks: number) => void
    onBack: () => void
    nextBiomeName?: string
    nextBiomeDesc?: string
  }

  let { availableTanks, onStartDive, onBack, nextBiomeName, nextBiomeDesc }: Props = $props()

  // Mine preview thumbnail state (Phase 49.6)
  let previewDataUrl = $state('')
  let previewBiome = $state(DEFAULT_BIOME)

  /** Generate a mine preview thumbnail when the component mounts. */
  function generateDivePreview(): void {
    const seed = Date.now()
    const rng = seededRandom(seed)
    previewBiome = selectBiome(1, rng)
    const { grid } = generateMine(seed, [], 0, previewBiome)
    previewDataUrl = minePreviewDataUrl(grid, previewBiome)
  }

  onMount(() => {
    generateDivePreview()
  })

  // ── Tank selection ────────────────────────────────────────────────────────
  let selectedTanks = $state<number>(1)

  const maxSelectableTanks = $derived(Math.min(availableTanks, 3))
  const canIncrease = $derived(selectedTanks < maxSelectableTanks)
  const canDecrease = $derived(selectedTanks > 1)
  const hasTanks = $derived(availableTanks > 0)
  const estimatedOxygen = $derived(selectedTanks * BALANCE.OXYGEN_PER_TANK)

  const diveLabel = $derived.by(() => {
    if (selectedTanks <= 1) return 'Short Dive'
    if (selectedTanks === 2) return 'Medium Dive'
    return 'Long Dive'
  })

  const diveTone = $derived.by(() => {
    if (selectedTanks <= 1) return 'short'
    if (selectedTanks === 2) return 'medium'
    return 'long'
  })

  $effect(() => {
    if (!hasTanks) {
      selectedTanks = 1
      return
    }
    const clamped = Math.max(1, Math.min(selectedTanks, maxSelectableTanks))
    if (clamped !== selectedTanks) {
      selectedTanks = clamped
    }
  })

  function increaseTanks(): void {
    if (!canIncrease) return
    selectedTanks += 1
  }

  function decreaseTanks(): void {
    if (!canDecrease) return
    selectedTanks -= 1
  }

  function selectTank(tankCount: number): void {
    if (tankCount < 1 || tankCount > maxSelectableTanks) return
    selectedTanks = tankCount
  }

  // ── Pickaxe selection ─────────────────────────────────────────────────────
  interface PickaxeDef {
    id: string
    name: string
    damage: string
    icon: string
  }

  const PICKAXE_OPTIONS: PickaxeDef[] = [
    { id: 'standard_pick', name: 'Standard Pick', damage: '×1.0 dmg', icon: '⛏️' },
    { id: 'reinforced_pick', name: 'Reinforced Pick', damage: '×1.5 dmg', icon: '🪨' },
  ]

  /** Pickaxes the player actually owns. */
  const ownedPickaxes = $derived(
    PICKAXE_OPTIONS.filter(p =>
      ($playerSave?.ownedPickaxes ?? ['standard_pick']).includes(p.id)
    )
  )

  // Auto-select pickaxe if only one available
  $effect(() => {
    if (ownedPickaxes.length === 1 && $selectedLoadout.pickaxeId === null) {
      selectPickaxe(ownedPickaxes[0].id)
    }
  })

  let pickaxeDropdownOpen = $state(false)

  const currentPickaxe = $derived(
    PICKAXE_OPTIONS.find(p => p.id === $selectedLoadout.pickaxeId) ?? PICKAXE_OPTIONS[0]
  )

  function selectPickaxe(id: string): void {
    selectedLoadout.update(l => ({ ...l, pickaxeId: id }))
  }

  // ── Consumable slot selection ─────────────────────────────────────────────
  const CONSUMABLE_OPTIONS = Object.values(CONSUMABLE_DEFS)
  type SlotIndex = 0 | 1 | 2

  /** Consumable types the player actually owns (quantity > 0). */
  const ownedConsumableOptions = $derived(
    CONSUMABLE_OPTIONS.filter(c => {
      const owned = $playerSave?.consumables ?? {}
      return (owned[c.id] ?? 0) > 0
    })
  )

  function cycleConsumableSlot(slot: SlotIndex): void {
    selectedLoadout.update(l => {
      const slots = [...l.consumableSlots] as [string | null, string | null, string | null]
      // Build remaining availability from owned quantities
      const owned: Record<string, number> = {}
      const playerConsumables = $playerSave?.consumables ?? {}
      for (const opt of ownedConsumableOptions) {
        owned[opt.id] = playerConsumables[opt.id] ?? 0
      }
      // Deduct quantities allocated to other slots
      for (let i = 0; i < 3; i++) {
        if (i !== slot && slots[i]) {
          owned[slots[i]!] = Math.max(0, (owned[slots[i]!] ?? 0) - 1)
        }
      }
      const available = ownedConsumableOptions.filter(c => (owned[c.id] ?? 0) > 0)
      if (available.length === 0) {
        slots[slot] = null
        return { ...l, consumableSlots: slots }
      }
      const currentId = slots[slot]
      const currentIdx = currentId ? available.findIndex(c => c.id === currentId) : -1
      if (currentIdx === available.length - 1) {
        slots[slot] = null
      } else if (currentIdx === -1) {
        slots[slot] = available[0].id
      } else {
        slots[slot] = available[currentIdx + 1].id
      }
      return { ...l, consumableSlots: slots }
    })
  }

  function clearConsumableSlot(slot: SlotIndex): void {
    selectedLoadout.update(l => {
      const slots = [...l.consumableSlots] as [string | null, string | null, string | null]
      slots[slot] = null
      return { ...l, consumableSlots: slots }
    })
  }

  function consumableLabel(id: string | null): string {
    if (!id) return 'Empty'
    return CONSUMABLE_DEFS[id as ConsumableId]?.label ?? id
  }

  function consumableIcon(id: string | null): string {
    const icons: Record<ConsumableId, string> = {
      bomb: '💣',
      flare: '🔦',
      shield_charge: '🛡️',
      drill_charge: '🔩',
      sonar_pulse: '📡',
      rescue_beacon: '🔆',
    }
    return id ? (icons[id as ConsumableId] ?? '?') : '＋'
  }

  // ── Relic vault ───────────────────────────────────────────────────────────
  function toggleRelic(id: string): void {
    selectedLoadout.update(l => {
      const isEquipped = l.relicIds.includes(id)
      if (isEquipped) {
        return { ...l, relicIds: l.relicIds.filter(r => r !== id) }
      }
      if (l.relicIds.length >= 3) return l   // max 3
      return { ...l, relicIds: [...l.relicIds, id] }
    })
  }

  function tierColor(tier: RelicDefinition['tier']): string {
    if (tier === 'legendary') return '#ffd700'
    if (tier === 'rare') return '#b388ff'
    return '#78909c'
  }

  // Only show relics the player has actually found
  const displayRelics = $derived($relicVault)

  // ── Difficulty display ────────────────────────────────────────────────────
  const displayLayer = $derived($currentLayer + 1)
  const starRating = $derived(Math.min(5, Math.max(1, Math.ceil(displayLayer / 4))))

  // ── Gate: dive needs tanks AND pickaxe ────────────────────────────────────
  const canDive = $derived(hasTanks && $loadoutReady)

  function startDive(): void {
    if (!canDive) return
    // Sync selected relics into the equippedRelicsV2 store before starting
    const relicDefs = $selectedLoadout.relicIds
      .map(id => RELIC_CATALOGUE.find(r => r.id === id))
      .filter((r): r is RelicDefinition => r !== undefined)
    equippedRelicsV2.set(relicDefs)
    onStartDive(selectedTanks)
  }
</script>

<section class="dive-prep" aria-label="Prepare for Dive">
  <div class="panel">
    <h1>Prepare for Dive</h1>
    <p class="available">Oxygen Tanks: {availableTanks} available</p>

    <!-- Tank selector -->
    <div class="tank-selector" aria-label="Select oxygen tanks">
      <button class="stepper" type="button" onclick={decreaseTanks} disabled={!canDecrease}>-</button>

      <div class="tank-icons" role="group" aria-label="Tank options">
        {#each [1, 2, 3] as tankCount}
          {@const isSelected = tankCount <= selectedTanks}
          {@const isEnabled = tankCount <= maxSelectableTanks}
          <button
            class={`tank-icon ${isSelected ? 'selected' : ''}`}
            type="button"
            onclick={() => selectTank(tankCount)}
            disabled={!isEnabled}
            aria-label={`Allocate ${tankCount} tank${tankCount > 1 ? 's' : ''}`}
            aria-pressed={tankCount === selectedTanks}
          >{tankCount}</button>
        {/each}
      </div>

      <button class="stepper" type="button" onclick={increaseTanks} disabled={!canIncrease}>+</button>
    </div>

    <p class="oxygen-estimate">
      {#if !hasTanks}
        <span class="no-tanks-warning">No Oxygen Tanks!</span>
      {:else}
        Estimated Oxygen: {estimatedOxygen} O₂
      {/if}
    </p>
    <p class={`dive-estimate ${diveTone}`}>{diveLabel}</p>

    <!-- Phase 49.6: Mine preview thumbnail -->
    <div class="mine-preview-section">
      <MinePreviewThumbnail
        dataUrl={previewDataUrl}
        biomeLabel={nextBiomeName ?? previewBiome.name}
        layer={$currentLayer + 1}
      />
    </div>

    {#if nextBiomeName}
      <div class="biome-preview">
        <span class="biome-label">Biome:</span>
        <span class="biome-name">{nextBiomeName}</span>
        {#if nextBiomeDesc}
          <p class="biome-desc">{nextBiomeDesc}</p>
        {/if}
      </div>
    {/if}

    <!-- ── Pickaxe selection ──────────────────────────────────────────── -->
    <div class="loadout-section" aria-label="Pickaxe selection">
      <p class="section-label">Pickaxe <span class="required-badge">Required</span></p>
      <div class="gear-slot-wrap">
        <button class="gear-slot-btn" type="button"
          onclick={() => { pickaxeDropdownOpen = !pickaxeDropdownOpen }}>
          <span class="pick-icon">{currentPickaxe.icon}</span>
          <span class="gear-slot-name">{currentPickaxe.name}</span>
          <span class="gear-slot-damage">{currentPickaxe.damage}</span>
          <span class="gear-slot-arrow">{pickaxeDropdownOpen ? '▲' : '▼'}</span>
        </button>
        {#if pickaxeDropdownOpen}
          <div class="gear-dropdown">
            {#each ownedPickaxes as pick}
              <button class="gear-option" class:selected={$selectedLoadout.pickaxeId === pick.id}
                type="button" onclick={() => { selectPickaxe(pick.id); pickaxeDropdownOpen = false }}>
                <span class="pick-icon">{pick.icon}</span>
                <span class="gear-option-name">{pick.name}</span>
                <span class="gear-option-damage">{pick.damage}</span>
                {#if $selectedLoadout.pickaxeId === pick.id}<span class="gear-check">✓</span>{/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- ── Consumable slots ───────────────────────────────────────────── -->
    <div class="loadout-section" aria-label="Consumable loadout">
      <p class="section-label">Consumables <span class="section-hint">(tap to cycle)</span></p>
      {#if ownedConsumableOptions.length === 0}
        <p class="empty-hint">Find consumables while mining to equip them here.</p>
      {:else}
        <div class="consumable-slots">
          {#each [0, 1, 2] as slot}
            {@const slotId = $selectedLoadout.consumableSlots[slot as SlotIndex]}
            <div class="consumable-slot-wrap">
              <button
                class={`consumable-btn${slotId ? ' filled' : ''}`}
                type="button"
                onclick={() => cycleConsumableSlot(slot as SlotIndex)}
                aria-label={`Consumable slot ${slot + 1}: ${consumableLabel(slotId)}. Tap to cycle.`}
              >
                <span class="cons-icon">{consumableIcon(slotId)}</span>
              </button>
              {#if slotId}
                <button
                  class="clear-slot"
                  type="button"
                  onclick={() => clearConsumableSlot(slot as SlotIndex)}
                  aria-label={`Clear slot ${slot + 1}`}
                >×</button>
              {/if}
              <span class="cons-label">{consumableLabel(slotId)}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- ── Relic vault ────────────────────────────────────────────────── -->
    <div class="loadout-section" aria-label="Relic vault">
      <p class="section-label">
        Relics
        <span class="section-hint">
          ({$selectedLoadout.relicIds.length}/3 equipped)
        </span>
      </p>
      {#if displayRelics.length === 0}
        <p class="empty-hint">No relics in vault — find them during dives!</p>
      {:else}
        <div class="relic-list">
          {#each displayRelics as relic}
            {@const isEquipped = $selectedLoadout.relicIds.includes(relic.id)}
            {@const atMax = $selectedLoadout.relicIds.length >= 3 && !isEquipped}
            <button
              class={`relic-btn${isEquipped ? ' equipped' : ''}${atMax ? ' dimmed' : ''}`}
              type="button"
              onclick={() => toggleRelic(relic.id)}
              disabled={atMax}
              aria-pressed={isEquipped}
              aria-label={`${relic.name} (${relic.tier}): ${relic.description}`}
              style="--tier-color: {tierColor(relic.tier)}"
            >
              <span class="relic-icon">{relic.icon}</span>
              <span class="relic-details">
                <span class="relic-name">{relic.name}</span>
                <span class="relic-desc">{relic.description}</span>
              </span>
              <span class="tier-dot" style="background:{tierColor(relic.tier)}" title={relic.tier}></span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- ── Difficulty display ─────────────────────────────────────────── -->
    <div class="difficulty-row" aria-label="Dive difficulty">
      <span class="diff-layer">Layer {displayLayer}</span>
      <span class="diff-tier">{$layerTierLabel}</span>
      <span class="diff-stars" aria-label={`${starRating} stars`}>
        {#each { length: 5 } as _, i}
          <span class={i < starRating ? 'star on' : 'star'}>{i < starRating ? '★' : '☆'}</span>
        {/each}
      </span>
    </div>

    <button class="enter-btn" type="button" onclick={startDive} disabled={!canDive} data-testid="btn-enter-mine">
      {#if !hasTanks}
        No Tanks
      {:else if !$loadoutReady}
        Select a Pickaxe
      {:else}
        Enter Mine
      {/if}
    </button>
    <button class="back-btn" type="button" onclick={onBack}>Back</button>
  </div>
</section>

<style>
  .dive-prep {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 30;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: var(--color-bg);
    font-family: 'Courier New', monospace;
    overflow-y: auto;
  }

  .panel {
    width: min(100%, 30rem);
    border: 2px solid color-mix(in srgb, var(--color-primary) 70%, var(--color-text) 30%);
    border-radius: 16px;
    padding: 1.25rem;
    background: color-mix(in srgb, var(--color-surface) 92%, black 8%);
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    text-align: center;
    margin: auto;
  }

  h1 {
    color: var(--color-warning);
    font-size: clamp(1.65rem, 5vw, 2.2rem);
    line-height: 1.2;
  }

  .available {
    color: var(--color-text);
    font-size: 1rem;
  }

  .tank-selector {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.7rem;
    align-items: center;
  }

  .stepper,
  .tank-icon,
  .enter-btn,
  .back-btn {
    min-height: 48px;
    font: inherit;
    cursor: pointer;
  }

  .stepper {
    width: 48px;
    border: 1px solid var(--color-primary);
    border-radius: 12px;
    background: var(--color-primary);
    color: var(--color-text);
    font-size: 1.4rem;
    line-height: 1;
  }

  .tank-icons {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.55rem;
  }

  .tank-icon {
    border: 1px solid color-mix(in srgb, #5dade2 50%, black 50%);
    border-radius: 999px;
    background: color-mix(in srgb, #5dade2 80%, black 20%);
    transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-text-dim, #aaa);
    font-family: 'Courier New', monospace;
  }

  .tank-icon.selected {
    box-shadow: 0 0 0 2px color-mix(in srgb, #5dade2 30%, white 70%), 0 0 14px #5dade2;
    transform: translateY(-1px);
    color: var(--color-text, #fff);
  }

  .oxygen-estimate {
    color: var(--color-text);
    font-size: 1.05rem;
  }

  .no-tanks-warning {
    color: var(--color-accent, #ff6b6b);
    font-weight: 700;
    animation: pulse-warn 1.5s ease-in-out infinite;
  }

  @keyframes pulse-warn {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .dive-estimate {
    font-size: 1.05rem;
    font-weight: 700;
  }

  .dive-estimate.short  { color: #ff6b6b; }
  .dive-estimate.medium { color: var(--color-warning); }
  .dive-estimate.long   { color: var(--color-success); }

  .enter-btn {
    border: 2px solid color-mix(in srgb, var(--color-success) 75%, white 25%);
    border-radius: 14px;
    padding: 0.85rem 1rem;
    background: color-mix(in srgb, var(--color-success) 65%, #0f2d26 35%);
    color: #e9fff8;
    font-size: 1.05rem;
    font-weight: 700;
    min-height: 44px;
  }

  .back-btn {
    border: 1px solid color-mix(in srgb, var(--color-text-dim) 60%, transparent 40%);
    border-radius: 12px;
    padding: 0.65rem 1rem;
    background: transparent;
    color: var(--color-text-dim);
    font-size: 0.95rem;
    min-height: 44px;
  }

  .biome-preview {
    border: 1px solid color-mix(in srgb, var(--color-primary) 50%, transparent 50%);
    border-radius: 10px;
    padding: 0.6rem 0.8rem;
    background: color-mix(in srgb, var(--color-primary) 12%, transparent 88%);
    text-align: center;
  }

  .biome-label {
    color: var(--color-text-dim);
    font-size: 0.85rem;
    margin-right: 0.3rem;
  }

  .biome-name {
    color: var(--color-primary);
    font-weight: 700;
    font-size: 1rem;
  }

  .biome-desc {
    color: var(--color-text-dim);
    font-size: 0.8rem;
    margin-top: 0.3rem;
    line-height: 1.3;
  }

  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  button:active:not(:disabled) {
    transform: translateY(1px);
  }

  /* ── Loadout sections ────────────────────────────────────────────────── */
  .loadout-section {
    border: 1px solid color-mix(in srgb, var(--color-text-dim) 25%, transparent 75%);
    border-radius: 12px;
    padding: 0.75rem;
    background: color-mix(in srgb, var(--color-surface) 60%, black 40%);
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .section-label {
    color: var(--color-text);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .section-hint {
    color: var(--color-text-dim);
    font-size: 0.75rem;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
  }

  .required-badge {
    background: color-mix(in srgb, #ff6b6b 20%, transparent 80%);
    border: 1px solid #ff6b6b88;
    border-radius: 6px;
    color: #ff9b9b;
    font-size: 0.7rem;
    padding: 0.1rem 0.35rem;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 700;
  }

  /* Pickaxe — gear-slot dropdown */
  .gear-slot-wrap {
    position: relative;
  }

  .gear-slot-btn {
    width: 100%;
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid color-mix(in srgb, var(--color-primary) 50%, transparent 50%);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface) 88%);
    color: var(--color-text);
    cursor: pointer;
    padding: 0.5rem 0.75rem;
    font: inherit;
    transition: border-color 120ms ease, background 120ms ease;
  }

  .gear-slot-name {
    font-size: 0.85rem;
    font-weight: 700;
    flex: 1;
    text-align: left;
  }

  .gear-slot-damage {
    font-size: 0.72rem;
    color: var(--color-text-dim);
  }

  .gear-slot-arrow {
    font-size: 0.7rem;
    color: var(--color-text-dim);
    margin-left: 0.25rem;
  }

  .gear-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 10;
    border: 1px solid color-mix(in srgb, var(--color-primary) 40%, transparent 60%);
    border-radius: 10px;
    background: var(--color-surface);
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }

  .gear-option {
    width: 100%;
    min-height: 48px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: none;
    border-bottom: 1px solid color-mix(in srgb, var(--color-text-dim) 15%, transparent 85%);
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    padding: 0.5rem 0.75rem;
    font: inherit;
    transition: background 80ms ease;
  }

  .gear-option:last-child {
    border-bottom: none;
  }

  .gear-option:hover,
  .gear-option.selected {
    background: color-mix(in srgb, var(--color-primary) 15%, transparent 85%);
  }

  .gear-option-name {
    font-size: 0.82rem;
    font-weight: 700;
    flex: 1;
    text-align: left;
  }

  .gear-option-damage {
    font-size: 0.72rem;
    color: var(--color-text-dim);
  }

  .gear-check {
    color: var(--color-success);
    font-size: 0.9rem;
    font-weight: 700;
  }

  .pick-icon {
    font-size: 1.4rem;
  }

  /* Consumables */
  .consumable-slots {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .consumable-slot-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    position: relative;
  }

  .consumable-btn {
    min-height: 56px;
    width: 100%;
    border: 1px dashed color-mix(in srgb, var(--color-text-dim) 40%, transparent 60%);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-surface) 60%, black 40%);
    display: flex;
    align-items: center;
    justify-content: center;
    font: inherit;
    cursor: pointer;
    transition: border-color 120ms ease, background 120ms ease;
  }

  .consumable-btn.filled {
    border-style: solid;
    border-color: color-mix(in srgb, var(--color-warning) 60%, transparent 40%);
    background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface) 90%);
  }

  .cons-icon {
    font-size: 1.5rem;
  }

  .clear-slot {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 20px;
    height: 20px;
    min-height: 20px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 107, 107, 0.7);
    color: white;
    font-size: 0.75rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .cons-label {
    font-size: 0.7rem;
    color: var(--color-text-dim);
    text-align: center;
    line-height: 1.2;
  }

  /* Relic vault */
  .empty-hint {
    color: var(--color-text-dim);
    font-size: 0.8rem;
    font-style: italic;
    text-align: center;
    padding: 0.5rem 0;
  }

  .relic-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .relic-btn {
    min-height: 44px;
    display: grid;
    grid-template-columns: 1.8rem 1fr auto;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid color-mix(in srgb, var(--color-text-dim) 25%, transparent 75%);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-surface) 70%, black 30%);
    color: var(--color-text);
    cursor: pointer;
    padding: 0.4rem 0.6rem;
    font: inherit;
    text-align: left;
    transition: border-color 120ms ease, background 120ms ease;
  }

  .relic-btn.equipped {
    border-color: var(--tier-color, var(--color-primary));
    background: color-mix(in srgb, var(--tier-color, var(--color-primary)) 12%, var(--color-surface) 88%);
  }

  .relic-btn.dimmed {
    opacity: 0.4;
  }

  .relic-icon {
    font-size: 1.1rem;
    text-align: center;
  }

  .relic-details {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .relic-name {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .relic-desc {
    font-size: 0.68rem;
    color: var(--color-text-dim);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tier-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* Difficulty row */
  .difficulty-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 0.5rem;
    border: 1px solid color-mix(in srgb, var(--color-text-dim) 20%, transparent 80%);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-surface) 50%, black 50%);
  }

  .diff-layer {
    font-size: 0.85rem;
    color: var(--color-text);
    font-weight: 700;
  }

  .diff-tier {
    font-size: 0.8rem;
    color: var(--color-text-dim);
    padding: 0.1rem 0.4rem;
    border: 1px solid color-mix(in srgb, var(--color-text-dim) 30%, transparent 70%);
    border-radius: 6px;
  }

  .diff-stars {
    display: flex;
    gap: 0.05rem;
  }

  .star {
    font-size: 0.95rem;
    color: var(--color-text-dim);
  }

  .star.on {
    color: var(--color-warning);
  }

  @media (max-width: 480px) {
    .panel {
      padding: 1rem;
      gap: 0.8rem;
    }

    .tank-selector {
      gap: 0.5rem;
    }

    .stepper {
      width: 44px;
    }
  }
</style>
