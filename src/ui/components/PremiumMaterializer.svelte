<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { craftPremiumRecipe } from '../../services/saveService'
  import {
    PREMIUM_RECIPES,
    PREMIUM_MATERIALS,
    getPremiumRecipesByCategory,
    type PremiumRecipe,
    type PremiumMaterial,
  } from '../../data/premiumRecipes'
  import type { MineralTier } from '../../data/types'
  import { audioManager } from '../../services/audioService'

  interface Props {
    onBack: () => void
  }

  let { onBack }: Props = $props()

  // ---- derived state ----

  const premiumMaterials = $derived($playerSave?.premiumMaterials ?? {})
  const minerals = $derived($playerSave?.minerals ?? { dust: 0, shard: 0, crystal: 0, geode: 0, essence: 0 })
  const craftedItems = $derived($playerSave?.craftedItems ?? {})
  const activeConsumables = $derived($playerSave?.activeConsumables ?? [])
  const ownedCosmetics = $derived($playerSave?.ownedCosmetics ?? [])
  const fossils = $derived($playerSave?.fossils ?? {})

  // ---- category tabs ----

  type TabKey = 'cosmetic' | 'convenience' | 'pet_variant'
  let activeTab = $state<TabKey>('cosmetic')

  const cosmeticRecipes = $derived(getPremiumRecipesByCategory('cosmetic'))
  const convenienceRecipes = $derived(getPremiumRecipesByCategory('convenience'))
  const petVariantRecipes = $derived(getPremiumRecipesByCategory('pet_variant'))

  const currentRecipes = $derived(
    activeTab === 'cosmetic' ? cosmeticRecipes
    : activeTab === 'convenience' ? convenienceRecipes
    : petVariantRecipes
  )

  // ---- premium material metadata ----

  const PREMIUM_IDS: PremiumMaterial[] = ['star_dust', 'void_crystal', 'ancient_essence']

  const MATERIAL_META: Record<PremiumMaterial, { name: string; icon: string; color: string }> = {
    star_dust: { name: 'Star Dust', icon: '\u2728', color: '#ffe97a' },
    void_crystal: { name: 'Void Crystal', icon: '\u{1F48E}', color: '#b388ff' },
    ancient_essence: { name: 'Ancient Essence', icon: '\u{1F300}', color: '#69f0ae' },
  }

  const MINERAL_COLORS: Record<MineralTier, string> = {
    dust: '#4ecca3',
    shard: '#ffd369',
    crystal: '#e94560',
    geode: '#9b59b6',
    essence: '#ffd700',
  }

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

  function canAfford(recipe: PremiumRecipe): boolean {
    for (const [key, required] of Object.entries(recipe.cost) as [string, number][]) {
      if (PREMIUM_IDS.includes(key as PremiumMaterial)) {
        if ((premiumMaterials[key] ?? 0) < required) return false
      } else {
        if ((minerals[key as MineralTier] ?? 0) < required) return false
      }
    }
    return true
  }

  function isMaxed(recipe: PremiumRecipe): boolean {
    if (recipe.maxCrafts <= 0) return false
    return (craftedItems[recipe.id] ?? 0) >= recipe.maxCrafts
  }

  function craftCount(recipe: PremiumRecipe): number {
    return craftedItems[recipe.id] ?? 0
  }

  function activeCount(recipeId: string): number {
    return activeConsumables.filter(id => id === recipeId).length
  }

  function isOwned(recipe: PremiumRecipe): boolean {
    return ownedCosmetics.includes(recipe.id)
  }

  /**
   * Returns true when a pet variant recipe's unlock condition is met.
   * The condition is: the relevant fossil must be revived.
   * We use a simple heuristic: the recipe id prefix matches a known fossil species id.
   */
  function isPetVariantUnlocked(recipe: PremiumRecipe): boolean {
    if (!recipe.unlockCondition) return true
    // Map recipe id to a species id fragment (e.g. 'golden_trilobite' → 'trilobite')
    const fossilKeys = Object.keys(fossils)
    if (recipe.id === 'golden_trilobite') return fossilKeys.some(k => k.includes('trilobite') && fossils[k]?.revived)
    if (recipe.id === 'crystal_mammoth') return fossilKeys.some(k => k.includes('mammoth') && fossils[k]?.revived)
    if (recipe.id === 'ancient_trex') return fossilKeys.some(k => (k.includes('trex') || k.includes('t_rex') || k.includes('t-rex')) && fossils[k]?.revived)
    return false
  }

  function handleCraft(recipe: PremiumRecipe): void {
    const currentSave = $playerSave
    if (!currentSave) return
    if (recipe.category === 'pet_variant' && !isPetVariantUnlocked(recipe)) return

    audioManager.playSound('button_click')
    const { success, updatedSave } = craftPremiumRecipe(currentSave, recipe.id)
    playerSave.set(updatedSave)
    showResult(recipe.id, success)
  }

  // ---- cost rendering ----

  function costEntries(recipe: PremiumRecipe): { key: string; amount: number; isPremium: boolean }[] {
    return Object.entries(recipe.cost).map(([key, amount]) => ({
      key,
      amount: amount as number,
      isPremium: PREMIUM_IDS.includes(key as PremiumMaterial),
    }))
  }

  function costColor(key: string, isPremium: boolean): string {
    if (isPremium) return MATERIAL_META[key as PremiumMaterial]?.color ?? '#fff'
    return MINERAL_COLORS[key as MineralTier] ?? '#aaa'
  }

  function costLabel(key: string, isPremium: boolean): string {
    if (isPremium) return MATERIAL_META[key as PremiumMaterial]?.name ?? key
    return key.charAt(0).toUpperCase() + key.slice(1)
  }

  function cantAffordPiece(key: string, amount: number, isPremium: boolean): boolean {
    if (isPremium) return (premiumMaterials[key] ?? 0) < amount
    return (minerals[key as MineralTier] ?? 0) < amount
  }
</script>

<section class="premium-materializer" aria-label="Premium Materializer crafting station">
  <!-- Header -->
  <div class="header">
    <button class="back-btn" type="button" onclick={onBack} aria-label="Back to base">
      &larr; Back
    </button>
    <div class="title-block">
      <h1>&#x2B50; Premium Workshop</h1>
      <p class="subtitle">Craft rare items with precious in-game drops</p>
    </div>
  </div>

  <!-- Premium material balances -->
  <div class="material-bar" aria-label="Premium material balances">
    {#each PREMIUM_MATERIALS as mat}
      {@const count = premiumMaterials[mat.id] ?? 0}
      <div class="material-pill" style="border-color: {MATERIAL_META[mat.id].color}33;">
        <span class="mat-icon">{mat.icon}</span>
        <span class="mat-count" style="color: {MATERIAL_META[mat.id].color};">{count}</span>
        <span class="mat-name">{mat.name}</span>
        <span class="mat-rarity">{mat.rarity}</span>
      </div>
    {/each}
  </div>

  <!-- Drop rate notice -->
  <div class="drop-notice" aria-label="Drop rates info">
    <span class="drop-icon">&#x2139;&#xFE0F;</span>
    <span class="drop-text">
      ✨ 3% from artifacts &nbsp;&bull;&nbsp;
      💎 1% from geode/essence nodes &nbsp;&bull;&nbsp;
      🌀 0.5% from fossils
    </span>
  </div>

  <!-- Category tabs -->
  <div class="tab-bar" role="tablist" aria-label="Recipe categories">
    <button
      class="tab-btn"
      class:tab-active={activeTab === 'cosmetic'}
      role="tab"
      aria-selected={activeTab === 'cosmetic'}
      type="button"
      onclick={() => { activeTab = 'cosmetic' }}
    >
      👗 Cosmetics
    </button>
    <button
      class="tab-btn"
      class:tab-active={activeTab === 'convenience'}
      role="tab"
      aria-selected={activeTab === 'convenience'}
      type="button"
      onclick={() => { activeTab = 'convenience' }}
    >
      🛠️ Convenience
    </button>
    <button
      class="tab-btn"
      class:tab-active={activeTab === 'pet_variant'}
      role="tab"
      aria-selected={activeTab === 'pet_variant'}
      type="button"
      onclick={() => { activeTab = 'pet_variant' }}
    >
      🐾 Pet Variants
    </button>
  </div>

  <!-- Recipe cards -->
  <div class="recipe-list" role="tabpanel" aria-label="{activeTab} recipes">
    {#each currentRecipes as recipe (recipe.id)}
      {@const maxed = isMaxed(recipe)}
      {@const affordable = canAfford(recipe)}
      {@const count = craftCount(recipe)}
      {@const justCrafted = lastCraftResult?.recipeId === recipe.id && lastCraftResult?.success}
      {@const craftFailed = lastCraftResult?.recipeId === recipe.id && !lastCraftResult?.success}
      {@const petLocked = recipe.category === 'pet_variant' && !isPetVariantUnlocked(recipe)}
      {@const owned = recipe.category === 'cosmetic' && isOwned(recipe)}
      {@const queued = recipe.category === 'convenience' ? activeCount(recipe.id) : 0}

      <div
        class="recipe-card"
        class:maxed
        class:unaffordable={!affordable && !maxed && !petLocked}
        class:pet-locked={petLocked}
        class:flash-success={justCrafted}
        aria-label="{recipe.name} premium recipe"
      >
        <div class="recipe-main">
          <span class="recipe-icon">{recipe.icon}</span>
          <div class="recipe-info">
            <div class="recipe-name-row">
              <span class="recipe-name">{recipe.name}</span>
              {#if owned}
                <span class="owned-badge">Owned</span>
              {/if}
            </div>
            <span class="recipe-desc">{recipe.description}</span>

            <!-- Cost display -->
            <div class="recipe-cost" aria-label="Cost">
              {#each costEntries(recipe) as { key, amount, isPremium }}
                <span class="cost-item">
                  {#if isPremium}
                    <span class="cost-icon">{MATERIAL_META[key as PremiumMaterial]?.icon}</span>
                  {:else}
                    <span class="cdot" style="background: {MINERAL_COLORS[key as MineralTier]};"></span>
                  {/if}
                  <span
                    class="camount"
                    class:cant-afford={cantAffordPiece(key, amount, isPremium)}
                    style="color: {cantAffordPiece(key, amount, isPremium) ? 'var(--color-accent)' : costColor(key, isPremium)};"
                  >{amount} {costLabel(key, isPremium)}</span>
                </span>
              {/each}
            </div>

            {#if petLocked && recipe.unlockCondition}
              <span class="unlock-cond">🔒 Requires: {recipe.unlockCondition}</span>
            {/if}
          </div>

          <!-- Actions -->
          <div class="recipe-actions">
            {#if petLocked}
              <div class="lock-badge" title={recipe.unlockCondition ?? 'Locked'}>
                <span class="lock-icon">🔒</span>
                <span class="lock-text">Locked</span>
              </div>
            {:else if maxed || (recipe.category === 'cosmetic' && owned)}
              <div class="max-badge">{recipe.category === 'cosmetic' ? 'Owned' : 'MAX'}</div>
            {:else}
              <button
                class="craft-btn"
                type="button"
                disabled={!affordable}
                onclick={() => handleCraft(recipe)}
                aria-label="Craft {recipe.name}"
              >
                Craft
              </button>
            {/if}
            {#if recipe.maxCrafts > 0 && recipe.maxCrafts < 99}
              <span class="craft-count" aria-label="Times crafted">{count}/{recipe.maxCrafts}</span>
            {/if}
            {#if queued > 0}
              <span class="queued-badge">{queued} ready</span>
            {/if}
          </div>
        </div>

        {#if justCrafted}
          <div class="craft-feedback success" aria-live="polite">
            {recipe.category === 'convenience' ? 'Added for next dive!' : 'Crafted!'}
          </div>
        {:else if craftFailed}
          <div class="craft-feedback fail" aria-live="polite">Cannot craft</div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Active convenience items summary -->
  {#if activeConsumables.some(id => PREMIUM_RECIPES.find(r => r.id === id))}
    <div class="active-consumables-card">
      <h3 class="active-title">Premium Items for Next Dive</h3>
      <div class="active-list">
        {#each [...new Set(activeConsumables)] as recipeId}
          {@const recipe = PREMIUM_RECIPES.find(r => r.id === recipeId)}
          {#if recipe && recipe.category === 'convenience'}
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
</section>

<style>
  .premium-materializer {
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
    background: color-mix(in srgb, #c084fc 30%, var(--color-surface) 70%);
  }

  .title-block {
    min-width: 0;
  }

  h1 {
    margin: 0;
    background: linear-gradient(135deg, #f0abfc 0%, #fbbf24 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: clamp(1.4rem, 5vw, 1.9rem);
    line-height: 1.1;
  }

  .subtitle {
    margin: 4px 0 0;
    color: var(--color-text-dim);
    font-size: 0.8rem;
    line-height: 1.35;
  }

  /* ---- Premium material balance bar ---- */
  .material-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px;
    padding: 10px 12px;
    background: color-mix(in srgb, #2a0060 60%, var(--color-surface) 40%);
    border: 1px solid rgba(192, 132, 252, 0.3);
    border-radius: 12px;
  }

  .material-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    background: color-mix(in srgb, var(--color-bg) 50%, var(--color-surface) 50%);
    border: 1px solid;
    border-radius: 999px;
    padding: 5px 12px;
  }

  .mat-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .mat-count {
    font-size: 0.95rem;
    font-weight: 800;
  }

  .mat-name {
    color: var(--color-text);
    font-size: 0.78rem;
    font-weight: 600;
  }

  .mat-rarity {
    color: var(--color-text-dim);
    font-size: 0.68rem;
    font-style: italic;
    margin-left: 2px;
  }

  /* ---- Drop rate notice ---- */
  .drop-notice {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 8px 10px;
    padding: 8px 12px;
    background: color-mix(in srgb, #1a0040 70%, var(--color-surface) 30%);
    border-left: 3px solid #c084fc;
    border-radius: 6px;
    font-size: 0.72rem;
    color: #c084fc;
  }

  .drop-icon {
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .drop-text {
    line-height: 1.4;
  }

  /* ---- Tab bar ---- */
  .tab-bar {
    display: flex;
    gap: 6px;
    margin: 0 8px 10px;
  }

  .tab-btn {
    flex: 1;
    min-height: 40px;
    border: 1px solid rgba(192, 132, 252, 0.3);
    border-radius: 9px;
    background: color-mix(in srgb, var(--color-bg) 60%, var(--color-surface) 40%);
    color: var(--color-text-dim);
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
    padding: 6px 4px;
  }

  .tab-btn:active {
    transform: translateY(1px);
  }

  .tab-active {
    background: color-mix(in srgb, #c084fc 22%, var(--color-surface) 78%);
    border-color: #c084fc;
    color: #f0abfc;
  }

  /* ---- Recipe cards ---- */
  .recipe-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0 8px 16px;
  }

  .recipe-card {
    background: color-mix(in srgb, #1a0040 55%, var(--color-surface) 45%);
    border-radius: 12px;
    padding: 12px 14px;
    border: 1px solid rgba(192, 132, 252, 0.2);
    transition: border-color 200ms ease;
  }

  .recipe-card.unaffordable {
    opacity: 0.72;
  }

  .recipe-card.pet-locked {
    opacity: 0.55;
    filter: grayscale(0.4);
  }

  .recipe-card.maxed {
    border-color: color-mix(in srgb, #fbbf24 45%, transparent 55%);
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
    font-size: 1.7rem;
    flex-shrink: 0;
    line-height: 1;
    margin-top: 2px;
  }

  .recipe-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .recipe-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .recipe-name {
    color: #f0abfc;
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .owned-badge {
    font-size: 0.68rem;
    font-weight: 700;
    color: #fbbf24;
    background: color-mix(in srgb, #fbbf24 18%, transparent 82%);
    border: 1px solid #fbbf2488;
    border-radius: 999px;
    padding: 1px 7px;
    letter-spacing: 0.5px;
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

  .cost-icon {
    font-size: 0.9rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .cdot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .camount {
    font-size: 0.78rem;
    font-weight: 600;
  }

  .cant-afford {
    color: var(--color-accent) !important;
    font-weight: 800;
  }

  .unlock-cond {
    color: #c084fc;
    font-size: 0.74rem;
    font-style: italic;
    margin-top: 2px;
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
    background: linear-gradient(135deg, #c084fc 0%, #fbbf24 100%);
    color: #1a0040;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 800;
    cursor: pointer;
    transition: opacity 100ms ease, transform 100ms ease;
    letter-spacing: 0.02em;
  }

  .craft-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    background: var(--color-text-dim);
    color: var(--color-bg);
  }

  .craft-btn:not(:disabled):active {
    transform: translateY(1px);
    opacity: 0.88;
  }

  .max-badge {
    min-width: 52px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: color-mix(in srgb, #fbbf24 25%, var(--color-surface) 75%);
    color: #fbbf24;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.5px;
    border: 1px solid #fbbf2466;
    white-space: nowrap;
    padding: 0 6px;
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
    color: #c084fc;
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

  /* ---- Active convenience items card ---- */
  .active-consumables-card {
    margin: 0 8px 20px;
    padding: 12px 14px;
    background: color-mix(in srgb, #c084fc 10%, var(--color-surface) 90%);
    border: 1px solid color-mix(in srgb, #c084fc 35%, transparent 65%);
    border-radius: 12px;
  }

  .active-title {
    margin: 0 0 8px;
    color: #c084fc;
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
    background: color-mix(in srgb, #c084fc 16%, var(--color-surface) 84%);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 0.82rem;
    color: var(--color-text);
  }

  .active-count {
    color: #c084fc;
    font-weight: 700;
    font-size: 0.78rem;
  }

  /* ---- Responsive ---- */
  @media (max-width: 420px) {
    .material-bar {
      gap: 4px;
    }
    .material-pill {
      padding: 4px 8px;
    }
    .mat-name,
    .mat-rarity {
      display: none;
    }
    .tab-btn {
      font-size: 0.68rem;
    }
  }
</style>
