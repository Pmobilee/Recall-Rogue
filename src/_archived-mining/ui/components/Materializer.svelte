<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { craftRecipe, getScaledCost, getCraftScaleMultiplier } from '../../services/saveService'
  import { RECIPES, getRecipesByCategory } from '../../data/recipes'
  import type { Recipe } from '../../data/recipes'
  import type { MineralTier } from '../../data/types'
  import { audioManager } from '../../services/audioService'
  import { upgradeFloor } from '../stores/playerData'
  import FloorUpgradePanel from './FloorUpgradePanel.svelte'
  import DuplicateMixingModal from './DuplicateMixingModal.svelte'
  import type { FloorUpgradeTier } from '../../data/hubLayout'
  import { currentFloorIndex } from '../stores/gameState'
  import { getDefaultHubStack } from '../../data/hubFloors'
  import { BALANCE } from '../../data/balance'
  import { getUpgradeDef, canUpgrade } from '../../data/hubUpgrades'

  interface Props {
    onBack: () => void
  }

  let { onBack }: Props = $props()

  // ---- derived state ----

  const minerals = $derived($playerSave?.minerals ?? { dust: 0, shard: 0, crystal: 0, geode: 0, essence: 0 })
  const craftedItems = $derived($playerSave?.craftedItems ?? {})
  const craftCounts = $derived($playerSave?.craftCounts ?? {})
  const activeConsumables = $derived($playerSave?.activeConsumables ?? [])
  const divesCompleted = $derived($playerSave?.stats.totalDivesCompleted ?? 0)

  const permanentRecipes = $derived(getRecipesByCategory('permanent'))
  const consumableRecipes = $derived(getRecipesByCategory('consumable'))

  // ---- feedback ----

  let lastCraftResult = $state<{ recipeId: string; success: boolean } | null>(null)
  let resultTimer: ReturnType<typeof setTimeout> | null = null

  function showResult(recipeId: string, success: boolean): void {
    if (resultTimer) clearTimeout(resultTimer)
    lastCraftResult = { recipeId, success }
    resultTimer = setTimeout(() => {
      lastCraftResult = null
    }, 1800)
  }

  // ---- helpers ----

  function scaledCostFor(recipe: Recipe): Partial<Record<MineralTier, number>> {
    return getScaledCost(recipe, craftCounts)
  }

  function canAfford(recipe: Recipe): boolean {
    const cost = scaledCostFor(recipe)
    for (const [tier, required] of Object.entries(cost) as [MineralTier, number][]) {
      if ((minerals[tier] ?? 0) < required) return false
    }
    return true
  }

  function isLocked(recipe: Recipe): boolean {
    return divesCompleted < recipe.unlockAfterDives
  }

  function isMaxed(recipe: Recipe): boolean {
    if (recipe.maxCrafts === 0) return false
    return (craftedItems[recipe.id] ?? 0) >= recipe.maxCrafts
  }

  function craftCount(recipe: Recipe): number {
    return craftedItems[recipe.id] ?? 0
  }

  function activeCount(recipeId: string): number {
    return activeConsumables.filter(id => id === recipeId).length
  }

  function scaleMultiplier(recipe: Recipe): number {
    return getCraftScaleMultiplier(recipe, craftCounts)
  }

  function handleCraft(recipe: Recipe): void {
    const save = $playerSave
    if (!save) return

    audioManager.playSound('button_click')
    const { success, updatedSave } = craftRecipe(save, recipe.id)
    playerSave.set(updatedSave)
    showResult(recipe.id, success)
  }

  // ---- mineral display ----

  const TIER_COLORS: Record<MineralTier, string> = {
    dust: '#4ecca3',
    shard: '#ffd369',
    crystal: '#e94560',
    geode: '#9b59b6',
    essence: '#ffd700',
  }

  function tierLabel(tier: MineralTier): string {
    return tier.charAt(0).toUpperCase() + tier.slice(1)
  }

  // Tab state
  let activeTab = $state<'crafting' | 'dome'>('crafting')

  // Floor upgrade state
  let showUpgradePanel = $state(false)
  let showMixingModal = $state(false)
  const hubStack = getDefaultHubStack()
  const unlockedIds = $derived($playerSave?.hubState?.unlockedFloorIds ?? ['starter'])
  const floorTiers = $derived(($playerSave?.hubState?.floorTiers ?? { starter: 0 }) as Record<string, number>)
  const unlockedFloors = $derived(hubStack.floors.filter(f => unlockedIds.includes(f.id)))
  const currentFloorId = $derived(unlockedFloors[$currentFloorIndex]?.id ?? 'starter')
  const currentFloorTier = $derived((floorTiers[currentFloorId] ?? 0) as FloorUpgradeTier)
  const isMaxTier = $derived(currentFloorTier >= 3)
  const currentTierInfo = $derived(BALANCE.DOME_TIER_INFO[currentFloorTier] ?? BALANCE.DOME_TIER_INFO[0])
  const nextTierNum = $derived((currentFloorTier + 1) as FloorUpgradeTier)
  const nextTierInfo = $derived(currentFloorTier < 3 ? BALANCE.DOME_TIER_INFO[currentFloorTier + 1] : null)
  const nextUpgradeDef = $derived(getUpgradeDef(currentFloorId, nextTierNum))
  const nextUpgradeCheck = $derived(
    $playerSave && !isMaxTier ? canUpgrade(currentFloorId, nextTierNum, $playerSave) : { allowed: false, reason: 'Max Tier Reached' }
  )

  function handleUpgrade(floorId: string, targetTier: FloorUpgradeTier): void {
    upgradeFloor(floorId, targetTier)
    showUpgradePanel = false
  }
</script>

<section class="materializer" aria-label="Materializer crafting station">
  <!-- Header -->
  <div class="header">
    <button class="back-btn" type="button" onclick={onBack} aria-label="Back to base">
      &larr; Back
    </button>
    <div class="title-block">
      <h1>Materializer</h1>
      <p class="subtitle">Spend minerals to craft permanent upgrades and consumables</p>
    </div>
  </div>

  <!-- Mineral summary bar -->
  <div class="mineral-bar" aria-label="Current minerals">
    {#each (['dust', 'shard', 'crystal', 'geode', 'essence'] as MineralTier[]) as tier}
      <div class="mineral-pill">
        <span class="mdot" style="background: {TIER_COLORS[tier]};"></span>
        <span class="mval">{minerals[tier] ?? 0}</span>
        <span class="mlabel">{tierLabel(tier)}</span>
      </div>
    {/each}
  </div>

  <!-- Tab bar -->
  <div class="tab-bar">
    <button
      class="tab-btn"
      class:active={activeTab === 'crafting'}
      type="button"
      onclick={() => { audioManager.playSound('button_click'); activeTab = 'crafting' }}
    >
      ⚗️ Crafting
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === 'dome'}
      type="button"
      onclick={() => { audioManager.playSound('button_click'); activeTab = 'dome' }}
    >
      🏗️ Dome Upgrades
    </button>
  </div>

  {#if activeTab === 'crafting'}
  <!-- Permanent upgrades section -->
  <div class="section">
    <h2 class="section-title permanent-title">Permanent Upgrades</h2>
    <div class="recipe-list">
      {#each permanentRecipes as recipe (recipe.id)}
        {@const locked = isLocked(recipe)}
        {@const maxed = isMaxed(recipe)}
        {@const affordable = canAfford(recipe)}
        {@const count = craftCount(recipe)}
        {@const justCrafted = lastCraftResult?.recipeId === recipe.id && lastCraftResult?.success}
        {@const scaledCost = scaledCostFor(recipe)}
        {@const multiplier = scaleMultiplier(recipe)}
        <div
          class="recipe-card"
          class:locked
          class:maxed
          class:unaffordable={!affordable && !locked && !maxed}
          class:flash-success={justCrafted}
          aria-label="{recipe.name} recipe card"
        >
          <div class="recipe-main">
            <span class="recipe-icon">{recipe.icon}</span>
            <div class="recipe-info">
              <span class="recipe-name">{recipe.name}</span>
              <span class="recipe-desc">{recipe.description}</span>
              <div class="recipe-cost" aria-label="Cost">
                {#each Object.entries(scaledCost) as [tier, amount]}
                  <span class="cost-item">
                    <span class="cdot" style="background: {TIER_COLORS[tier as MineralTier]};"></span>
                    <span
                      class="camount"
                      class:cant-afford={(minerals[tier as MineralTier] ?? 0) < amount}
                    >{amount} {tier}</span>
                  </span>
                {/each}
                {#if multiplier > 1}
                  <span class="scale-badge">{multiplier.toFixed(2)}x</span>
                {/if}
              </div>
            </div>
            <div class="recipe-actions">
              {#if locked}
                <div class="lock-badge" title="Unlocks after {recipe.unlockAfterDives} dives">
                  <span class="lock-icon">🔒</span>
                  <span class="lock-text">After {recipe.unlockAfterDives} dives</span>
                </div>
              {:else if maxed}
                <div class="max-badge">MAX</div>
              {:else}
                <button
                  class="craft-btn permanent-btn"
                  type="button"
                  disabled={!affordable}
                  onclick={() => handleCraft(recipe)}
                  aria-label="Craft {recipe.name}"
                >
                  Craft
                </button>
              {/if}
              {#if recipe.maxCrafts > 0}
                <span class="craft-count" aria-label="Times crafted">{count}/{recipe.maxCrafts}</span>
              {/if}
            </div>
          </div>
          {#if justCrafted}
            <div class="craft-feedback success" aria-live="polite">Crafted!</div>
          {:else if lastCraftResult?.recipeId === recipe.id && !lastCraftResult?.success}
            <div class="craft-feedback fail" aria-live="polite">Cannot craft</div>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- Consumables section -->
  <div class="section">
    <h2 class="section-title consumable-title">Consumables</h2>
    <p class="section-note">Single-use items applied to your next dive</p>
    <div class="recipe-list">
      {#each consumableRecipes as recipe (recipe.id)}
        {@const locked = isLocked(recipe)}
        {@const affordable = canAfford(recipe)}
        {@const queued = activeCount(recipe.id)}
        {@const justCrafted = lastCraftResult?.recipeId === recipe.id && lastCraftResult?.success}
        {@const scaledCost = scaledCostFor(recipe)}
        {@const multiplier = scaleMultiplier(recipe)}
        <div
          class="recipe-card"
          class:locked
          class:unaffordable={!affordable && !locked}
          class:flash-success={justCrafted}
          aria-label="{recipe.name} recipe card"
        >
          <div class="recipe-main">
            <span class="recipe-icon">{recipe.icon}</span>
            <div class="recipe-info">
              <span class="recipe-name">{recipe.name}</span>
              <span class="recipe-desc">{recipe.description}</span>
              <div class="recipe-cost" aria-label="Cost">
                {#each Object.entries(scaledCost) as [tier, amount]}
                  <span class="cost-item">
                    <span class="cdot" style="background: {TIER_COLORS[tier as MineralTier]};"></span>
                    <span
                      class="camount"
                      class:cant-afford={(minerals[tier as MineralTier] ?? 0) < amount}
                    >{amount} {tier}</span>
                  </span>
                {/each}
                {#if multiplier > 1}
                  <span class="scale-badge">{multiplier.toFixed(2)}x</span>
                {/if}
              </div>
            </div>
            <div class="recipe-actions">
              {#if locked}
                <div class="lock-badge" title="Unlocks after {recipe.unlockAfterDives} dives">
                  <span class="lock-icon">🔒</span>
                  <span class="lock-text">After {recipe.unlockAfterDives} dives</span>
                </div>
              {:else}
                <button
                  class="craft-btn consumable-btn"
                  type="button"
                  disabled={!affordable}
                  onclick={() => handleCraft(recipe)}
                  aria-label="Craft {recipe.name}"
                >
                  Craft
                </button>
              {/if}
              {#if queued > 0}
                <span class="queued-badge" title="{queued} queued for next dive">{queued} ready</span>
              {/if}
            </div>
          </div>
          {#if justCrafted}
            <div class="craft-feedback success" aria-live="polite">Added to next dive!</div>
          {:else if lastCraftResult?.recipeId === recipe.id && !lastCraftResult?.success}
            <div class="craft-feedback fail" aria-live="polite">Cannot craft</div>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- Active consumables summary -->
  {#if activeConsumables.length > 0}
    <div class="active-consumables-card">
      <h3 class="active-title">Ready for Next Dive</h3>
      <div class="active-list">
        {#each [...new Set(activeConsumables)] as recipeId}
          {@const recipe = RECIPES.find(r => r.id === recipeId)}
          {#if recipe}
            <span class="active-item">
              {recipe.icon} {recipe.name}
              {#if activeConsumables.filter(id => id === recipeId).length > 1}
                <span class="active-count">x{activeConsumables.filter(id => id === recipeId).length}</span>
              {/if}
            </span>
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  <!-- Recycle Artifacts -->
  <section class="recycle-section">
    <h3 class="section-heading">Recycle Artifacts</h3>
    <p class="recycle-desc">Combine 3+ duplicate artifact cards for a chance at a rarity upgrade.</p>
    <button class="recycle-btn" type="button" onclick={() => { audioManager.playSound('button_click'); showMixingModal = true }}>
      Open Artifact Mixer
      <span class="arrow" aria-hidden="true">&rarr;</span>
    </button>
  </section>
  {/if}

  {#if activeTab === 'dome'}
  <!-- Dome Upgrades Section -->
  <section class="dome-upgrades-section">
    <h3 class="section-heading">Dome Upgrades</h3>
    <div class="upgrade-info-row">
      <span class="upgrade-floor-name">{unlockedFloors[$currentFloorIndex]?.name ?? 'Starter Hub'}</span>
      <span class="upgrade-tier-badge">Tier {currentFloorTier}/3</span>
    </div>
    <p class="tier-description">{currentTierInfo.description}</p>

    <!-- Tier progression indicator -->
    <div class="tier-progress-bar">
      {#each [0, 1, 2, 3] as t}
        <div class="tier-pip" class:tier-pip-filled={t <= currentFloorTier} class:tier-pip-next={t === currentFloorTier + 1 && !isMaxTier}></div>
      {/each}
    </div>

    {#if !isMaxTier && nextTierInfo && nextUpgradeDef}
      <div class="next-tier-preview">
        <span class="next-tier-label">Next: {nextUpgradeDef.label} (Tier {nextTierNum})</span>
        <span class="next-tier-desc">{nextTierInfo.description}</span>
        <div class="next-tier-costs">
          <span class="next-tier-cost-item">💎 {nextUpgradeDef.dustCost} dust</span>
          {#each nextUpgradeDef.premiumCosts as pc}
            <span class="next-tier-cost-item">✦ {pc.count}x {pc.materialId}</span>
          {/each}
          <span class="next-tier-cost-item">📚 {nextUpgradeDef.minFactsMastered} mastered facts</span>
        </div>
      </div>
      <button
        class="upgrade-floor-btn"
        type="button"
        disabled={!nextUpgradeCheck.allowed}
        onclick={() => { audioManager.playSound('button_click'); showUpgradePanel = true }}
      >
        {nextUpgradeCheck.allowed ? 'Upgrade Current Floor' : nextUpgradeCheck.reason}
        <span class="arrow" aria-hidden="true">&rarr;</span>
      </button>
    {:else}
      <div class="max-tier-banner">
        <span class="max-tier-icon" aria-hidden="true">&#10003;</span>
        <span class="max-tier-text">Max Tier Reached</span>
      </div>
    {/if}
  </section>
  {/if}

  {#if showUpgradePanel}
    <FloorUpgradePanel
      floorId={currentFloorId}
      currentTier={currentFloorTier}
      onClose={() => { showUpgradePanel = false }}
      onUpgrade={handleUpgrade}
    />
  {/if}

  {#if showMixingModal}
    <DuplicateMixingModal onClose={() => { showMixingModal = false }} />
  {/if}
</section>

<style>
  .materializer {
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
  .header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin: 8px;
    margin-bottom: 4px;
  }

  .back-btn {
    flex-shrink: 0;
    min-height: 42px;
    padding: 0 14px;
    border: 1px solid var(--color-text-dim);
    border-radius: 10px;
    background: var(--color-surface);
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 100ms ease;
  }

  .back-btn:active {
    background: color-mix(in srgb, var(--color-primary) 30%, var(--color-surface) 70%);
  }

  .title-block {
    min-width: 0;
  }

  h1 {
    margin: 0;
    color: #a78bfa;
    font-size: clamp(1.5rem, 5vw, 2rem);
    line-height: 1.1;
  }

  .subtitle {
    margin: 4px 0 0;
    color: var(--color-text-dim);
    font-size: 0.8rem;
    line-height: 1.35;
  }

  /* ---- Mineral bar ---- */
  .mineral-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px;
    padding: 10px 12px;
    background: var(--color-surface);
    border-radius: 10px;
  }

  .mineral-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    background: color-mix(in srgb, var(--color-bg) 40%, var(--color-surface) 60%);
    border-radius: 999px;
    padding: 4px 10px;
  }

  .mdot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .mval {
    color: var(--color-text);
    font-size: 0.85rem;
    font-weight: 700;
  }

  .mlabel {
    color: var(--color-text-dim);
    font-size: 0.75rem;
  }

  /* ---- Tab bar ---- */
  .tab-bar {
    display: flex;
    gap: 4px;
    margin: 8px;
    background: var(--color-surface);
    border-radius: 12px;
    padding: 4px;
  }

  .tab-btn {
    flex: 1;
    min-height: 44px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--color-text-dim);
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }

  .tab-btn.active {
    background: color-mix(in srgb, var(--color-primary, #a78bfa) 25%, var(--color-bg) 75%);
    color: var(--color-text);
  }

  .tab-btn:not(.active):hover {
    background: rgba(255, 255, 255, 0.05);
  }

  /* ---- Sections ---- */
  .section {
    margin: 8px;
  }

  .section-title {
    margin: 0 0 6px;
    font-size: 0.9rem;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .permanent-title {
    color: #a78bfa;
  }

  .consumable-title {
    color: #60a5fa;
  }

  .section-note {
    margin: 0 0 8px;
    color: var(--color-text-dim);
    font-size: 0.78rem;
    font-style: italic;
  }

  /* ---- Recipe cards ---- */
  .recipe-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .recipe-card {
    background: var(--color-surface);
    border-radius: 12px;
    padding: 12px 14px;
    border: 1px solid transparent;
    transition: border-color 200ms ease;
  }

  .recipe-card.unaffordable {
    opacity: 0.75;
  }

  .recipe-card.locked {
    opacity: 0.55;
    filter: grayscale(0.3);
  }

  .recipe-card.maxed {
    border-color: color-mix(in srgb, #a78bfa 40%, transparent 60%);
  }

  .recipe-card.flash-success {
    border-color: var(--color-success);
    animation: flash-border 0.4s ease;
  }

  @keyframes flash-border {
    0% { border-color: var(--color-success); }
    60% { border-color: color-mix(in srgb, var(--color-success) 70%, transparent 30%); }
    100% { border-color: var(--color-success); }
  }

  .recipe-main {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .recipe-icon {
    font-size: 1.6rem;
    flex-shrink: 0;
    line-height: 1;
    margin-top: 2px;
  }

  .recipe-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .recipe-name {
    color: var(--color-text);
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .recipe-desc {
    color: var(--color-text-dim);
    font-size: 0.8rem;
    line-height: 1.35;
  }

  /* ---- Cost display ---- */
  .recipe-cost {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }

  .cost-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .cdot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .camount {
    color: var(--color-text-dim);
    font-size: 0.78rem;
  }

  .camount.cant-afford {
    color: var(--color-accent);
    font-weight: 700;
  }

  .scale-badge {
    font-size: 0.72rem;
    color: var(--color-warning);
    font-weight: 700;
    background: color-mix(in srgb, var(--color-warning) 14%, var(--color-surface) 86%);
    border-radius: 999px;
    padding: 1px 6px;
    white-space: nowrap;
  }

  /* ---- Actions ---- */
  .recipe-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    flex-shrink: 0;
  }

  .craft-btn {
    min-width: 64px;
    min-height: 38px;
    border: 0;
    border-radius: 9px;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 100ms ease, transform 100ms ease;
  }

  .craft-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .craft-btn:not(:disabled):active {
    transform: translateY(1px);
  }

  .permanent-btn {
    background: color-mix(in srgb, #a78bfa 70%, var(--color-surface) 30%);
    color: #fff;
  }

  .consumable-btn {
    background: color-mix(in srgb, #60a5fa 70%, var(--color-surface) 30%);
    color: #fff;
  }

  .max-badge {
    min-width: 48px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: color-mix(in srgb, #a78bfa 35%, var(--color-surface) 65%);
    color: #a78bfa;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 1px;
    border: 1px solid #a78bfa;
  }

  .lock-badge {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .lock-icon {
    font-size: 1.1rem;
    line-height: 1;
  }

  .lock-text {
    color: var(--color-text-dim);
    font-size: 0.7rem;
    white-space: nowrap;
    text-align: right;
  }

  .craft-count {
    color: var(--color-text-dim);
    font-size: 0.72rem;
    text-align: right;
  }

  .queued-badge {
    font-size: 0.72rem;
    color: #60a5fa;
    font-weight: 700;
    text-align: right;
  }

  /* ---- Craft feedback ---- */
  .craft-feedback {
    margin-top: 6px;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 4px 8px;
    border-radius: 6px;
    display: inline-block;
    animation: fade-in-out 1.8s ease forwards;
  }

  .craft-feedback.success {
    color: var(--color-success);
    background: color-mix(in srgb, var(--color-success) 15%, var(--color-surface) 85%);
  }

  .craft-feedback.fail {
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 15%, var(--color-surface) 85%);
  }

  @keyframes fade-in-out {
    0% { opacity: 0; }
    15% { opacity: 1; }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }

  /* ---- Active consumables card ---- */
  .active-consumables-card {
    margin: 8px;
    margin-bottom: 20px;
    padding: 12px 14px;
    background: color-mix(in srgb, #60a5fa 12%, var(--color-surface) 88%);
    border: 1px solid color-mix(in srgb, #60a5fa 40%, transparent 60%);
    border-radius: 12px;
  }

  .active-title {
    margin: 0 0 8px;
    color: #60a5fa;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .active-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .active-item {
    display: flex;
    align-items: center;
    gap: 4px;
    background: color-mix(in srgb, #60a5fa 18%, var(--color-surface) 82%);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 0.82rem;
    color: var(--color-text);
  }

  .active-count {
    color: #60a5fa;
    font-weight: 700;
    font-size: 0.78rem;
  }

  /* ---- Dome Upgrades ---- */
  .dome-upgrades-section {
    background: var(--color-surface, #1e1e3a);
    border-radius: 12px;
    padding: 16px;
    margin-top: 12px;
  }

  .section-heading {
    color: var(--color-accent, #4ecca3);
    font-size: 0.9rem;
    margin: 0 0 10px;
  }

  .upgrade-info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: color-mix(in srgb, var(--color-bg, #0a0e1a) 35%, var(--color-surface, #1e1e3a) 65%);
    border-radius: 8px;
    margin-bottom: 8px;
  }

  .upgrade-floor-name {
    color: var(--color-text, #e8e8f0);
    font-size: 0.9rem;
    font-weight: 600;
  }

  .upgrade-tier-badge {
    color: var(--color-warning, #f0a030);
    font-size: 0.8rem;
    padding: 2px 8px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--color-warning, #f0a030) 15%, transparent);
  }

  .tier-description {
    color: var(--color-text-dim, #8888a0);
    font-size: 0.82rem;
    margin: 0 0 12px;
    line-height: 1.4;
  }

  .tier-progress-bar {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
  }

  .tier-pip {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: background 0.2s, border-color 0.2s;
  }

  .tier-pip-filled {
    background: var(--color-accent, #4ecca3);
    border-color: var(--color-accent, #4ecca3);
  }

  .tier-pip-next {
    border-color: var(--color-accent, #4ecca3);
    animation: pip-pulse 1.5s ease infinite;
  }

  @keyframes pip-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .next-tier-preview {
    background: color-mix(in srgb, var(--color-bg, #0a0e1a) 50%, var(--color-surface, #1e1e3a) 50%);
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 12px;
    border: 1px solid rgba(78, 204, 163, 0.2);
  }

  .next-tier-label {
    display: block;
    color: var(--color-warning, #f0a030);
    font-size: 0.85rem;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .next-tier-desc {
    display: block;
    color: var(--color-text-dim, #8888a0);
    font-size: 0.78rem;
    margin-bottom: 8px;
  }

  .next-tier-costs {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .next-tier-cost-item {
    color: var(--color-text-dim, #8888a0);
    font-size: 0.78rem;
  }

  .max-tier-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px;
    background: color-mix(in srgb, var(--color-accent, #4ecca3) 15%, var(--color-surface, #1e1e3a) 85%);
    border: 1px solid var(--color-accent, #4ecca3);
    border-radius: 10px;
    margin-top: 4px;
  }

  .max-tier-icon {
    color: var(--color-accent, #4ecca3);
    font-size: 1.2rem;
    font-weight: 900;
  }

  .max-tier-text {
    color: var(--color-accent, #4ecca3);
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 1px;
  }

  .upgrade-floor-btn {
    width: 100%;
    min-height: 48px;
    border: 1px solid var(--color-accent, #4ecca3);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-accent, #4ecca3) 20%, var(--color-surface, #1e1e3a) 80%);
    color: var(--color-text, #e8e8f0);
    font-family: inherit;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
  }

  .upgrade-floor-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    border-color: var(--color-text-dim, #8888a0);
    background: color-mix(in srgb, var(--color-text-dim, #8888a0) 10%, var(--color-surface, #1e1e3a) 90%);
  }

  .upgrade-floor-btn:active:not(:disabled) {
    transform: translateY(1px);
  }

  .arrow {
    color: rgba(255, 255, 255, 0.5);
  }

  /* ---- Recycle section ---- */
  .recycle-section {
    background: var(--color-surface, #1e1e3a);
    border-radius: 12px;
    padding: 16px;
    margin-top: 12px;
  }

  .recycle-desc {
    color: var(--color-text-dim, #8888a0);
    font-size: 0.78rem;
    margin: 0 0 10px;
    line-height: 1.4;
  }

  .recycle-btn {
    width: 100%;
    min-height: 48px;
    border: 1px solid #7c3aed;
    border-radius: 10px;
    background: color-mix(in srgb, #7c3aed 20%, var(--color-surface, #1e1e3a) 80%);
    color: var(--color-text, #e8e8f0);
    font-family: inherit;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
  }

  .recycle-btn:active {
    transform: translateY(1px);
  }

  /* ---- Responsive ---- */
  @media (max-width: 400px) {
    .mineral-bar {
      gap: 4px;
    }
    .mineral-pill {
      padding: 3px 7px;
    }
    .mval {
      font-size: 0.78rem;
    }
    .mlabel {
      display: none;
    }
  }
</style>
