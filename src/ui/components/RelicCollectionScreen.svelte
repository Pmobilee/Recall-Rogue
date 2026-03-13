<script lang="ts">
  import { FULL_RELIC_CATALOGUE, STARTER_RELIC_IDS, RELIC_BY_ID } from '../../data/relics/index'
  import type { RelicDefinition, RelicRarity, RelicCategory } from '../../data/relics/types'
  import { playerSave, getMasteryBalance, unlockRelic, toggleRelicExclusion } from '../stores/playerData'
  import { getRelicIconPath, getUIIconPath } from '../utils/iconAssets'

  interface Props {
    onBack: () => void
  }

  let { onBack }: Props = $props()

  /* ── reactive state ── */
  let activeFilter = $state<RelicRarity | 'all'>('all')
  let categoryFilter = $state<RelicCategory | 'all'>('all')
  let selectedRelic = $state<RelicDefinition | null>(null)
  let unlockMessage = $state('')

  /* ── derived from store ── */
  const save = $derived($playerSave)
  const balance = $derived(getMasteryBalance())
  const unlockedIds = $derived(new Set(save?.unlockedRelicIds ?? []))
  const excludedIds = $derived(new Set(save?.excludedRelicIds ?? []))
  const starterIds = $derived(new Set(STARTER_RELIC_IDS))

  function isOwned(id: string): boolean {
    return starterIds.has(id) || unlockedIds.has(id)
  }

  const totalOwned = $derived(
    FULL_RELIC_CATALOGUE.filter((r) => isOwned(r.id)).length
  )

  const filteredRelics = $derived.by(() => {
    return FULL_RELIC_CATALOGUE.filter((r) => {
      if (activeFilter !== 'all' && r.rarity !== activeFilter) return false
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
      return true
    })
  })

  /* ── rarity colours ── */
  const RARITY_COLOR: Record<RelicRarity, string> = {
    common: '#9ca3af',
    uncommon: '#22c55e',
    rare: '#3b82f6',
    legendary: '#f59e0b',
  }

  /* ── filter options ── */
  const rarityOptions: Array<{ value: RelicRarity | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'common', label: 'Common' },
    { value: 'uncommon', label: 'Uncommon' },
    { value: 'rare', label: 'Rare' },
    { value: 'legendary', label: 'Legendary' },
  ]

  const categoryOptions: Array<{ value: RelicCategory | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'offensive', label: 'Offensive' },
    { value: 'defensive', label: 'Defensive' },
    { value: 'sustain', label: 'Sustain' },
    { value: 'tactical', label: 'Tactical' },
    { value: 'knowledge', label: 'Knowledge' },
    { value: 'economy', label: 'Economy' },
    { value: 'cursed', label: 'Cursed' },
  ]

  /* ── unlock flow ── */
  let messageTimer: ReturnType<typeof setTimeout> | undefined

  function handleUnlock(relicId: string): void {
    const success = unlockRelic(relicId)
    if (messageTimer) clearTimeout(messageTimer)
    unlockMessage = success ? 'Relic unlocked!' : 'Not enough coins'
    messageTimer = setTimeout(() => {
      unlockMessage = ''
    }, 2000)
  }

  function handleToggleExclusion(relicId: string): void {
    toggleRelicExclusion(relicId)
  }

  function openDetail(relic: RelicDefinition): void {
    selectedRelic = relic
  }

  function closeDetail(): void {
    selectedRelic = null
    unlockMessage = ''
  }

  function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
</script>

<section class="relic-screen" aria-label="Relic Archive">
  <!-- Header -->
  <header class="header">
    <button type="button" class="back-btn" onclick={onBack} aria-label="Go back to camp">
      <span aria-hidden="true">&larr;</span>
      <span>Camp</span>
    </button>
    <h2 class="header-title">Relic Archive</h2>
    <div class="coin-display" aria-label="Mastery Coins">
      <span class="coin-icon" aria-hidden="true">&#9889;</span>
      <span class="coin-amount">{balance.available}</span>
    </div>
  </header>

  <!-- Filters -->
  <div class="filter-section">
    <div class="filter-row" role="radiogroup" aria-label="Filter by rarity">
      {#each rarityOptions as opt (opt.value)}
        <button
          type="button"
          class="pill"
          class:active={activeFilter === opt.value}
          onclick={() => (activeFilter = opt.value)}
          aria-pressed={activeFilter === opt.value}
          style={opt.value !== 'all' && activeFilter === opt.value
            ? `border-color: ${RARITY_COLOR[opt.value as RelicRarity]}; color: ${RARITY_COLOR[opt.value as RelicRarity]}`
            : ''}
        >
          {opt.label}
        </button>
      {/each}
    </div>
    <div class="filter-row" role="radiogroup" aria-label="Filter by category">
      {#each categoryOptions as opt (opt.value)}
        <button
          type="button"
          class="pill"
          class:active={categoryFilter === opt.value}
          onclick={() => (categoryFilter = opt.value)}
          aria-pressed={categoryFilter === opt.value}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Stats row -->
  <div class="stats-row">
    <span>Unlocked: {totalOwned}/{FULL_RELIC_CATALOGUE.length}</span>
    <span>Coins: {balance.available}</span>
  </div>

  <!-- Relic grid -->
  <div class="relic-grid">
    {#each filteredRelics as relic (relic.id)}
      {@const owned = isOwned(relic.id)}
      {@const isStarter = starterIds.has(relic.id)}
      {@const isExcluded = excludedIds.has(relic.id)}
      <button
        type="button"
        class="relic-card"
        class:locked={!owned}
        class:excluded={isExcluded && owned}
        onclick={() => { if (owned) openDetail(relic) }}
        style="border-color: {RARITY_COLOR[relic.rarity]}"
        aria-label="{relic.name}, {relic.rarity}{owned ? ', owned' : ', locked'}"
      >
        <div class="relic-icon" aria-hidden="true">
          <img class="relic-icon-img"
            src={owned ? getRelicIconPath(relic.id) : getUIIconPath('unknown')}
            alt=""
            onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement)?.style.setProperty('display', 'inline'); }} />
          <span class="relic-icon-fallback" style="display:none">{owned ? relic.icon : '❓'}</span>
        </div>
        <span class="relic-name">{owned ? relic.name : '???'}</span>
        {#if isExcluded && owned}
          <span class="badge badge-excluded">Excluded</span>
        {:else if owned}
          <span class="badge badge-owned">OWNED</span>
        {:else}
          <span class="badge badge-cost">
            <span class="badge-coin" aria-hidden="true">&#9889;</span>{relic.unlockCost}
          </span>
        {/if}
      </button>
    {/each}
  </div>

  {#if filteredRelics.length === 0}
    <p class="empty-state">No relics match your filters.</p>
  {/if}
</section>

<!-- Detail popup / modal -->
{#if selectedRelic}
  {@const owned = isOwned(selectedRelic.id)}
  {@const isStarter = starterIds.has(selectedRelic.id)}
  {@const isExcluded = excludedIds.has(selectedRelic.id)}
  {@const isCursed = selectedRelic.category === 'cursed'}

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={closeDetail} onkeydown={(e) => { if (e.key === 'Escape') closeDetail() }}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="modal-content"
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label="Relic detail: {selectedRelic.name}"
    >
      <!-- Close button -->
      <button type="button" class="modal-close" onclick={closeDetail} aria-label="Close">
        &times;
      </button>

      <!-- Icon -->
      <div class="modal-icon" aria-hidden="true">
        <img class="modal-icon-img"
          src={getRelicIconPath(selectedRelic.id)}
          alt=""
          onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement)?.style.setProperty('display', 'inline'); }} />
        <span class="modal-icon-fallback" style="display:none">{selectedRelic.icon}</span>
      </div>

      <!-- Name + rarity badge -->
      <h3 class="modal-name">{selectedRelic.name}</h3>
      <div class="modal-badges">
        <span
          class="rarity-pill"
          style="background: {RARITY_COLOR[selectedRelic.rarity]}20; color: {RARITY_COLOR[selectedRelic.rarity]}; border-color: {RARITY_COLOR[selectedRelic.rarity]}50"
        >
          {capitalize(selectedRelic.rarity)}
        </span>
        <span class="category-pill">
          {capitalize(selectedRelic.category)}
        </span>
      </div>

      <!-- Description -->
      <p class="modal-description">{selectedRelic.description}</p>

      <!-- Flavor text -->
      {#if selectedRelic.flavorText}
        <p class="modal-flavor">"{selectedRelic.flavorText}"</p>
      {/if}

      <!-- Effects list -->
      {#if selectedRelic.effects.length > 0}
        <div class="modal-effects">
          <h4>Effects</h4>
          <ul>
            {#each selectedRelic.effects as fx (fx.effectId)}
              <li>{fx.description}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <!-- Curse warning -->
      {#if isCursed && selectedRelic.curseDescription}
        <div class="curse-warning">
          <span class="curse-icon" aria-hidden="true">&#9888;</span>
          <span>{selectedRelic.curseDescription}</span>
        </div>
      {/if}

      <!-- Unlock message -->
      {#if unlockMessage}
        <p class="unlock-msg" class:success={unlockMessage === 'Relic unlocked!'} class:error={unlockMessage !== 'Relic unlocked!'}>
          {unlockMessage}
        </p>
      {/if}

      <!-- Action buttons -->
      <div class="modal-actions">
        {#if isStarter}
          <span class="starter-label">Starter Relic</span>
        {:else if !owned}
          <button
            type="button"
            class="action-btn unlock-btn"
            disabled={balance.available < selectedRelic.unlockCost}
            onclick={() => handleUnlock(selectedRelic!.id)}
          >
            Unlock ({selectedRelic.unlockCost} <span class="action-coin" aria-hidden="true">&#9889;</span>)
          </button>
        {:else}
          <button
            type="button"
            class="action-btn toggle-btn"
            class:is-excluded={isExcluded}
            onclick={() => handleToggleExclusion(selectedRelic!.id)}
          >
            {isExcluded ? 'Include in runs' : 'Exclude from runs'}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── layout ── */
  .relic-screen {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    padding: calc(16px + var(--safe-top)) 12px 32px;
    background:
      radial-gradient(circle at 15% 0%, rgba(250, 204, 21, 0.10), transparent 36%),
      radial-gradient(circle at 85% 5%, rgba(139, 92, 246, 0.10), transparent 32%),
      linear-gradient(180deg, #0b1120, #111827);
    color: #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 50;
  }

  /* ── header ── */
  .header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
  }

  .header-title {
    margin: 0;
    justify-self: center;
    text-align: center;
    color: #fde68a;
    font-size: calc(20px * var(--text-scale, 1));
    font-weight: 800;
    letter-spacing: 0.3px;
  }

  .back-btn {
    min-height: 44px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid rgba(74, 222, 128, 0.50);
    background: rgba(21, 128, 61, 0.35);
    color: #bbf7d0;
    font-weight: 700;
    font-size: calc(13px * var(--text-scale, 1));
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .coin-display {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(120, 53, 15, 0.50);
    border: 1px solid rgba(250, 204, 21, 0.45);
    justify-self: end;
  }

  .coin-icon {
    font-size: calc(14px * var(--text-scale, 1));
    color: #fbbf24;
  }

  .coin-amount {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    color: #fef3c7;
  }

  /* ── filters ── */
  .filter-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .filter-row {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .filter-row::-webkit-scrollbar {
    display: none;
  }

  .pill {
    flex-shrink: 0;
    min-height: 34px;
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.30);
    background: rgba(15, 23, 42, 0.60);
    color: #94a3b8;
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .pill.active {
    background: rgba(59, 130, 246, 0.22);
    color: #e2e8f0;
    border-color: rgba(96, 165, 250, 0.55);
  }

  /* ── stats ── */
  .stats-row {
    display: flex;
    justify-content: space-between;
    font-size: calc(12px * var(--text-scale, 1));
    color: #94a3b8;
    padding: 0 2px;
  }

  /* ── relic grid ── */
  .relic-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .relic-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 6px 10px;
    border-radius: 12px;
    border: 2px solid;
    background: rgba(15, 23, 42, 0.80);
    cursor: pointer;
    transition: transform 0.12s, box-shadow 0.12s;
    min-height: 90px;
  }

  .relic-card:active {
    transform: scale(0.96);
  }

  .relic-card.locked {
    opacity: 0.65;
  }

  .relic-card.excluded {
    opacity: 0.75;
  }

  .relic-card.excluded .relic-name {
    text-decoration: line-through;
    text-decoration-color: rgba(248, 113, 113, 0.7);
  }

  .relic-icon {
    font-size: calc(28px * var(--text-scale, 1));
    line-height: 1;
    width: calc(28px * var(--text-scale, 1));
    height: calc(28px * var(--text-scale, 1));
  }

  .relic-icon-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .relic-icon-fallback {
    font-size: 1.5em;
  }

  .relic-name {
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 600;
    color: #cbd5e1;
    text-align: center;
    line-height: 1.2;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  /* ── badges ── */
  .badge {
    font-size: calc(9px * var(--text-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 1px 6px;
    border-radius: 999px;
    line-height: 1.4;
  }

  .badge-owned {
    color: #93c5fd;
    background: rgba(59, 130, 246, 0.22);
    border: 1px solid rgba(59, 130, 246, 0.45);
  }

  .badge-cost {
    color: #fef3c7;
    background: rgba(245, 158, 11, 0.22);
    border: 1px solid rgba(245, 158, 11, 0.45);
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .badge-coin {
    font-size: calc(9px * var(--text-scale, 1));
    color: #fbbf24;
  }

  .badge-excluded {
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.20);
    border: 1px solid rgba(239, 68, 68, 0.40);
  }

  .empty-state {
    text-align: center;
    color: #64748b;
    font-size: calc(13px * var(--text-scale, 1));
    padding: 24px 0;
  }

  /* ── modal ── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 16px;
  }

  .modal-content {
    position: relative;
    width: 100%;
    max-width: 340px;
    max-height: 85vh;
    overflow-y: auto;
    border-radius: 16px;
    border: 1px solid rgba(148, 163, 184, 0.30);
    background:
      radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.08), transparent 50%),
      linear-gradient(180deg, #111827, #0f172a);
    padding: 24px 20px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: #e2e8f0;
  }

  .modal-close {
    position: absolute;
    top: 8px;
    right: 8px;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: #94a3b8;
    font-size: calc(22px * var(--text-scale, 1));
    cursor: pointer;
    border-radius: 8px;
  }

  .modal-close:hover {
    color: #e2e8f0;
    background: rgba(148, 163, 184, 0.15);
  }

  .modal-icon {
    font-size: calc(48px * var(--text-scale, 1));
    line-height: 1;
    margin-top: 4px;
    width: calc(48px * var(--text-scale, 1));
    height: calc(48px * var(--text-scale, 1));
  }

  .modal-icon-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .modal-icon-fallback {
    font-size: 1em;
  }

  .modal-name {
    margin: 0;
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 800;
    color: #f8fafc;
    text-align: center;
  }

  .modal-badges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .rarity-pill,
  .category-pill {
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    padding: 2px 10px;
    border-radius: 999px;
    border: 1px solid;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .category-pill {
    background: rgba(100, 116, 139, 0.18);
    color: #cbd5e1;
    border-color: rgba(148, 163, 184, 0.35);
  }

  .modal-description {
    margin: 0;
    font-size: calc(13px * var(--text-scale, 1));
    color: #e2e8f0;
    text-align: center;
    line-height: 1.5;
  }

  .modal-flavor {
    margin: 0;
    font-size: calc(12px * var(--text-scale, 1));
    color: #64748b;
    font-style: italic;
    text-align: center;
    line-height: 1.4;
  }

  .modal-effects {
    width: 100%;
  }

  .modal-effects h4 {
    margin: 0 0 4px;
    font-size: calc(12px * var(--text-scale, 1));
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .modal-effects ul {
    margin: 0;
    padding: 0 0 0 16px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .modal-effects li {
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
    line-height: 1.4;
  }

  .curse-warning {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    width: 100%;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(127, 29, 29, 0.30);
    border: 1px solid rgba(248, 113, 113, 0.40);
  }

  .curse-icon {
    color: #f87171;
    font-size: calc(14px * var(--text-scale, 1));
    flex-shrink: 0;
  }

  .curse-warning span:last-child {
    font-size: calc(12px * var(--text-scale, 1));
    color: #fca5a5;
    line-height: 1.4;
  }

  .unlock-msg {
    margin: 0;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
    text-align: center;
  }

  .unlock-msg.success {
    color: #4ade80;
  }

  .unlock-msg.error {
    color: #f87171;
  }

  /* ── action buttons ── */
  .modal-actions {
    width: 100%;
    display: flex;
    justify-content: center;
    margin-top: 4px;
  }

  .starter-label {
    font-size: calc(12px * var(--text-scale, 1));
    color: #6ee7b7;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 8px 0;
  }

  .action-btn {
    min-height: 44px;
    min-width: 160px;
    padding: 8px 16px;
    border-radius: 10px;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
    border: 1px solid;
    transition: opacity 0.12s;
  }

  .unlock-btn {
    background: rgba(120, 53, 15, 0.75);
    border-color: rgba(250, 204, 21, 0.55);
    color: #fef3c7;
  }

  .unlock-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .action-coin {
    font-size: calc(12px * var(--text-scale, 1));
    color: #fbbf24;
  }

  .toggle-btn {
    background: rgba(30, 41, 59, 0.85);
    border-color: rgba(148, 163, 184, 0.45);
    color: #e2e8f0;
  }

  .toggle-btn.is-excluded {
    background: rgba(21, 128, 61, 0.30);
    border-color: rgba(74, 222, 128, 0.50);
    color: #bbf7d0;
  }
</style>
