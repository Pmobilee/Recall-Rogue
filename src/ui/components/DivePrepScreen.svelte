<script lang="ts">
  import { BALANCE } from '../../data/balance'

  interface Props {
    availableTanks: number
    onStartDive: (tanks: number) => void
    onBack: () => void
    nextBiomeName?: string
    nextBiomeDesc?: string
  }

  let { availableTanks, onStartDive, onBack, nextBiomeName, nextBiomeDesc }: Props = $props()

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

  function startDive(): void {
    if (!hasTanks) return
    onStartDive(selectedTanks)
  }
</script>

<section class="dive-prep" aria-label="Prepare for Dive">
  <div class="panel">
    <h1>Prepare for Dive</h1>
    <p class="available">Oxygen Tanks: {availableTanks} available</p>

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
          ></button>
        {/each}
      </div>

      <button class="stepper" type="button" onclick={increaseTanks} disabled={!canIncrease}>+</button>
    </div>

    <p class="oxygen-estimate">Estimated Oxygen: {estimatedOxygen} O2</p>
    <p class={`dive-estimate ${diveTone}`}>{diveLabel}</p>

    {#if nextBiomeName}
      <div class="biome-preview">
        <span class="biome-label">Biome:</span>
        <span class="biome-name">{nextBiomeName}</span>
        {#if nextBiomeDesc}
          <p class="biome-desc">{nextBiomeDesc}</p>
        {/if}
      </div>
    {/if}

    <button class="enter-btn" type="button" onclick={startDive} disabled={!hasTanks}>
      Enter Mine
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
  }

  .tank-icon.selected {
    box-shadow: 0 0 0 2px color-mix(in srgb, #5dade2 30%, white 70%), 0 0 14px #5dade2;
    transform: translateY(-1px);
  }

  .oxygen-estimate {
    color: var(--color-text);
    font-size: 1.05rem;
  }

  .dive-estimate {
    font-size: 1.05rem;
    font-weight: 700;
  }

  .dive-estimate.short {
    color: #ff6b6b;
  }

  .dive-estimate.medium {
    color: var(--color-warning);
  }

  .dive-estimate.long {
    color: var(--color-success);
  }

  .enter-btn {
    border: 2px solid color-mix(in srgb, var(--color-success) 75%, white 25%);
    border-radius: 14px;
    padding: 0.85rem 1rem;
    background: color-mix(in srgb, var(--color-success) 65%, #0f2d26 35%);
    color: #e9fff8;
    font-size: 1.05rem;
    font-weight: 700;
  }

  .back-btn {
    border: 1px solid color-mix(in srgb, var(--color-text-dim) 60%, transparent 40%);
    border-radius: 12px;
    padding: 0.65rem 1rem;
    background: transparent;
    color: var(--color-text-dim);
    font-size: 0.95rem;
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
