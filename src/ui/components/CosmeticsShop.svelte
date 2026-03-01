<script lang="ts">
  import { COSMETICS, getCosmeticsByCategory } from '../../data/cosmetics'
  import type { Cosmetic } from '../../data/cosmetics'
  import type { MineralTier } from '../../data/types'
  import { playerSave, buyCosmetic, equipCosmetic } from '../stores/playerData'
  import { audioManager } from '../../services/audioService'

  interface Props {
    onBack: () => void
  }

  let { onBack }: Props = $props()

  type Category = Cosmetic['category']
  const CATEGORIES: { key: Category; label: string }[] = [
    { key: 'helmet', label: 'Helmets' },
    { key: 'suit', label: 'Suits' },
    { key: 'trail', label: 'Trails' },
    { key: 'aura', label: 'Auras' },
  ]

  let activeCategory = $state<Category>('helmet')

  const visibleCosmetics = $derived(getCosmeticsByCategory(activeCategory))

  const ownedCosmetics = $derived($playerSave?.ownedCosmetics ?? [])
  const equippedCosmetic = $derived($playerSave?.equippedCosmetic ?? null)
  const minerals = $derived($playerSave?.minerals ?? { dust: 0, shard: 0, crystal: 0, geode: 0, essence: 0 })
  const playerStats = $derived($playerSave?.stats ?? { totalDivesCompleted: 0, totalFactsLearned: 0, deepestLayerReached: 0 })

  /** Returns the unlock status string if the player hasn't met the requirement, else null. */
  function unlockText(cosmetic: Cosmetic): string | null {
    const req = cosmetic.unlockRequirement
    if (!req) return null
    if (req.type === 'dives' && playerStats.totalDivesCompleted < req.value) {
      return `Complete ${req.value} dives`
    }
    if (req.type === 'facts' && playerStats.totalFactsLearned < req.value) {
      return `Learn ${req.value} facts`
    }
    if (req.type === 'depth' && playerStats.deepestLayerReached < req.value) {
      return `Reach depth ${req.value}`
    }
    return null
  }

  /** Returns whether the player can afford this cosmetic. */
  function canAfford(cosmetic: Cosmetic): boolean {
    for (const [tier, required] of Object.entries(cosmetic.cost) as [MineralTier, number][]) {
      if ((minerals[tier] ?? 0) < required) return false
    }
    return true
  }

  /** Returns a human-readable cost string. */
  function costLabel(cosmetic: Cosmetic): string {
    return Object.entries(cosmetic.cost)
      .map(([tier, amount]) => `${amount} ${tier}`)
      .join(', ')
  }

  function handleBuy(cosmetic: Cosmetic): void {
    audioManager.playSound('button_click')
    buyCosmetic(cosmetic.id, cosmetic.cost)
  }

  function handleEquip(cosmetic: Cosmetic): void {
    audioManager.playSound('button_click')
    if (equippedCosmetic === cosmetic.id) {
      equipCosmetic(null)
    } else {
      equipCosmetic(cosmetic.id)
    }
  }

  function handleBack(): void {
    audioManager.playSound('button_click')
    onBack()
  }

  const CATEGORY_BORDER: Record<Category, string> = {
    helmet: '#ffd700',
    suit: '#e94560',
    trail: '#ffd369',
    aura: '#a78bfa',
  }
</script>

<div class="shop-overlay" aria-label="Cosmetics Shop">
  <div class="shop-header">
    <button class="back-btn" type="button" onclick={handleBack} aria-label="Back to base">
      Back
    </button>
    <h1 class="shop-title">Cosmetics Shop</h1>
    <div class="header-spacer"></div>
  </div>

  <div class="category-tabs" role="tablist" aria-label="Cosmetic categories">
    {#each CATEGORIES as cat}
      <button
        class="tab-btn"
        class:active={activeCategory === cat.key}
        type="button"
        role="tab"
        aria-selected={activeCategory === cat.key}
        style="--tab-color: {CATEGORY_BORDER[cat.key]}"
        onclick={() => { activeCategory = cat.key }}
      >
        {cat.label}
      </button>
    {/each}
  </div>

  <div class="cosmetics-grid" role="tabpanel">
    {#each visibleCosmetics as cosmetic (cosmetic.id)}
      {@const locked = unlockText(cosmetic)}
      {@const owned = ownedCosmetics.includes(cosmetic.id)}
      {@const equipped = equippedCosmetic === cosmetic.id}
      {@const affordable = !locked && canAfford(cosmetic)}

      <div
        class="cosmetic-card"
        class:card-owned={owned}
        class:card-equipped={equipped}
        class:card-locked={!!locked}
        style="--card-border: {CATEGORY_BORDER[cosmetic.category]}"
        aria-label="{cosmetic.name}: {owned ? (equipped ? 'Equipped' : 'Owned') : (locked ? 'Locked' : 'For sale')}"
      >
        <div class="card-icon" aria-hidden="true">{cosmetic.icon}</div>

        <div class="card-body">
          <div class="card-name">{cosmetic.name}</div>
          <div class="card-desc">{cosmetic.description}</div>

          {#if locked}
            <div class="card-lock-note">{locked}</div>
          {:else}
            <div class="card-cost" class:cost-affordable={!owned && affordable} class:cost-too-expensive={!owned && !affordable}>
              {costLabel(cosmetic)}
            </div>
          {/if}
        </div>

        <div class="card-actions">
          {#if locked}
            <span class="status-badge badge-locked">Locked</span>
          {:else if equipped}
            <button class="action-btn btn-unequip" type="button" onclick={() => handleEquip(cosmetic)}>
              Unequip
            </button>
          {:else if owned}
            <button class="action-btn btn-equip" type="button" onclick={() => handleEquip(cosmetic)}>
              Equip
            </button>
          {:else if affordable}
            <button class="action-btn btn-buy" type="button" onclick={() => handleBuy(cosmetic)}>
              Buy
            </button>
          {:else}
            <span class="status-badge badge-expensive">Can't Afford</span>
          {/if}

          {#if owned && !equipped}
            <span class="status-badge badge-owned">Owned</span>
          {:else if equipped}
            <span class="status-badge badge-equipped">Equipped</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .shop-overlay {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 40;
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
    font-family: 'Courier New', monospace;
    overflow: hidden;
  }

  /* ── Header ──────────────────────────────────────────────── */
  .shop-header {
    display: flex;
    align-items: center;
    padding: 12px 14px 8px;
    gap: 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .shop-title {
    flex: 1;
    text-align: center;
    margin: 0;
    font-size: clamp(1.2rem, 4vw, 1.6rem);
    color: var(--color-warning);
    letter-spacing: 2px;
  }

  .back-btn {
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    background: var(--color-surface);
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    padding: 7px 14px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .back-btn:active {
    transform: translateY(1px);
    opacity: 0.85;
  }

  .header-spacer {
    /* Mirror the back button width to keep title centered */
    width: 64px;
    flex-shrink: 0;
  }

  /* ── Category Tabs ───────────────────────────────────────── */
  .category-tabs {
    display: flex;
    gap: 6px;
    padding: 10px 14px;
    flex-shrink: 0;
  }

  .tab-btn {
    flex: 1;
    border: 2px solid transparent;
    border-radius: 10px;
    background: var(--color-surface);
    color: var(--color-text-dim);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 8px 4px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background-color 0.15s;
  }

  .tab-btn.active {
    border-color: var(--tab-color);
    color: var(--tab-color);
    background: color-mix(in srgb, var(--tab-color) 14%, var(--color-surface) 86%);
  }

  .tab-btn:active {
    transform: translateY(1px);
  }

  /* ── Cosmetics Grid ──────────────────────────────────────── */
  .cosmetics-grid {
    flex: 1;
    overflow-y: auto;
    padding: 8px 14px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    -webkit-overflow-scrolling: touch;
  }

  /* ── Cosmetic Card ───────────────────────────────────────── */
  .cosmetic-card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--color-surface);
    border: 2px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 12px 14px;
    transition: border-color 0.15s;
  }

  .cosmetic-card.card-owned {
    border-color: color-mix(in srgb, var(--card-border) 40%, transparent 60%);
  }

  .cosmetic-card.card-equipped {
    border-color: var(--card-border);
    background: color-mix(in srgb, var(--card-border) 8%, var(--color-surface) 92%);
  }

  .cosmetic-card.card-locked {
    opacity: 0.55;
  }

  .card-icon {
    font-size: 2.2rem;
    flex-shrink: 0;
    width: 48px;
    text-align: center;
    line-height: 1;
  }

  .card-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .card-name {
    color: var(--color-text);
    font-size: 0.95rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-desc {
    color: var(--color-text-dim);
    font-size: 0.78rem;
    line-height: 1.3;
  }

  .card-cost {
    font-size: 0.78rem;
    font-weight: 600;
    margin-top: 2px;
  }

  .cost-affordable {
    color: #4ecca3;
  }

  .cost-too-expensive {
    color: #e94560;
  }

  .card-lock-note {
    font-size: 0.75rem;
    color: var(--color-text-dim);
    font-style: italic;
    margin-top: 2px;
  }

  /* ── Card Actions ────────────────────────────────────────── */
  .card-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    flex-shrink: 0;
  }

  .action-btn {
    border: 0;
    border-radius: 9px;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    padding: 8px 14px;
    cursor: pointer;
    min-width: 72px;
    text-align: center;
  }

  .action-btn:active {
    transform: translateY(1px);
  }

  .btn-buy {
    background: var(--color-success);
    color: #0b231a;
  }

  .btn-equip {
    background: color-mix(in srgb, var(--card-border) 70%, var(--color-surface) 30%);
    color: #fff;
  }

  .btn-unequip {
    background: color-mix(in srgb, var(--color-text-dim) 28%, var(--color-surface) 72%);
    color: var(--color-text);
  }

  .status-badge {
    font-size: 0.7rem;
    font-weight: 700;
    border-radius: 999px;
    padding: 4px 10px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .badge-locked {
    background: color-mix(in srgb, var(--color-text-dim) 20%, var(--color-surface) 80%);
    color: var(--color-text-dim);
  }

  .badge-owned {
    background: color-mix(in srgb, #4ecca3 18%, var(--color-surface) 82%);
    color: #4ecca3;
  }

  .badge-equipped {
    background: color-mix(in srgb, var(--card-border) 22%, var(--color-surface) 78%);
    color: var(--card-border);
  }

  .badge-expensive {
    background: color-mix(in srgb, #e94560 16%, var(--color-surface) 84%);
    color: #e94560;
    font-size: 0.68rem;
    padding: 4px 8px;
    text-align: center;
  }

  @media (max-width: 380px) {
    .shop-header {
      padding: 10px 10px 6px;
    }

    .cosmetics-grid {
      padding: 6px 10px 20px;
    }

    .card-icon {
      font-size: 1.8rem;
      width: 38px;
    }

    .action-btn {
      font-size: 0.76rem;
      padding: 7px 10px;
      min-width: 60px;
    }
  }
</style>
