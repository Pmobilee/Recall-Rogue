<script lang="ts">
  import { get } from 'svelte/store'
  import { BALANCE } from '../../data/balance'
  import { FOSSIL_SPECIES } from '../../data/fossils'
  import { deleteSave } from '../../services/saveService'
  import { factsDB } from '../../services/factsDB'
  import { GameManager } from '../../game/GameManager'
  import { currentScreen, type Screen } from '../stores/gameState'
  import {
    addLearnedFact,
    addMinerals,
    initPlayer,
    persistPlayer,
    playerSave,
  } from '../stores/playerData'
  import type { FossilState } from '../../data/types'

  // ─── panel open/close ───────────────────────────────────────
  let open = $state(false)

  function toggle(): void {
    open = !open
  }

  // ─── collapsible section state ───────────────────────────────
  let sectionsOpen = $state<Record<string, boolean>>({
    resources: true,
    progression: false,
    fossils: false,
    inventory: false,
    navigation: false,
    danger: false,
    debug: false,
  })

  function toggleSection(key: string): void {
    sectionsOpen[key] = !sectionsOpen[key]
  }

  // ─── custom amount input ─────────────────────────────────────
  type MineralTier = 'dust' | 'shard' | 'crystal' | 'geode' | 'essence'
  let customTier = $state<MineralTier>('dust')
  let customAmount = $state<number>(100)

  // ─── streak input ─────────────────────────────────────────────
  let streakInput = $state<number>(7)

  const gm = GameManager.getInstance()

  // ─── Section 1: Resources ─────────────────────────────────────

  function giveDust(): void { addMinerals('dust', 500) }
  function giveShards(): void { addMinerals('shard', 50) }
  function giveCrystals(): void { addMinerals('crystal', 20) }
  function giveGeodes(): void { addMinerals('geode', 5) }
  function giveEssence(): void { addMinerals('essence', 2) }

  function giveAllResources(): void {
    addMinerals('dust', 500)
    addMinerals('shard', 50)
    addMinerals('crystal', 20)
    addMinerals('geode', 5)
    addMinerals('essence', 2)
  }

  function givePremiumMaterials(): void {
    playerSave.update(s => {
      if (!s) return s
      const pm = { ...s.premiumMaterials }
      pm['star_dust'] = (pm['star_dust'] ?? 0) + 10
      pm['void_crystal'] = (pm['void_crystal'] ?? 0) + 5
      pm['ancient_essence'] = (pm['ancient_essence'] ?? 0) + 2
      return { ...s, premiumMaterials: pm }
    })
    persistPlayer()
  }

  function giveCustomAmount(): void {
    if (customAmount > 0) {
      addMinerals(customTier, customAmount)
    }
  }

  // ─── Section 2: Progression ───────────────────────────────────

  function unlockAllRooms(): void {
    playerSave.update(s => {
      if (!s) return s
      const allRoomIds = BALANCE.DOME_ROOMS.map(r => r.id)
      const current = s.unlockedRooms ?? ['command']
      const merged = [...new Set([...current, ...allRoomIds])]
      return { ...s, unlockedRooms: merged }
    })
    persistPlayer()
  }

  function setDives(count: number): void {
    playerSave.update(s => {
      if (!s) return s
      return {
        ...s,
        stats: { ...s.stats, totalDivesCompleted: count },
      }
    })
    persistPlayer()
  }

  function setStreak(): void {
    const val = Math.max(0, Math.floor(streakInput))
    playerSave.update(s => {
      if (!s) return s
      return {
        ...s,
        stats: {
          ...s.stats,
          currentStreak: val,
          bestStreak: Math.max(s.stats.bestStreak, val),
        },
      }
    })
    persistPlayer()
  }

  function learn20Facts(): void {
    const facts = gm.getFacts()
    const save = get(playerSave)
    if (!save) return
    const unlearned = facts.filter(f => !save.learnedFacts.includes(f.id))
    for (const fact of unlearned.slice(0, 20)) {
      addLearnedFact(fact.id)
    }
  }

  function maxKnowledgePoints(): void {
    playerSave.update(s => {
      if (!s) return s
      return { ...s, knowledgePoints: 9999 }
    })
    persistPlayer()
  }

  // ─── Section 3: Fossils ───────────────────────────────────────

  function giveAllFossilFragments(): void {
    playerSave.update(s => {
      if (!s) return s
      const fossils = { ...s.fossils }
      for (const species of FOSSIL_SPECIES) {
        const existing = fossils[species.id]
        fossils[species.id] = {
          speciesId: species.id,
          fragmentsFound: species.fragmentsNeeded,
          fragmentsNeeded: species.fragmentsNeeded,
          revived: existing?.revived ?? false,
          revivedAt: existing?.revivedAt,
        }
      }
      return { ...s, fossils }
    })
    persistPlayer()
  }

  function reviveAllFossils(): void {
    playerSave.update(s => {
      if (!s) return s
      const fossils = { ...s.fossils }
      const now = Date.now()
      for (const species of FOSSIL_SPECIES) {
        fossils[species.id] = {
          speciesId: species.id,
          fragmentsFound: species.fragmentsNeeded,
          fragmentsNeeded: species.fragmentsNeeded,
          revived: true,
          revivedAt: fossils[species.id]?.revivedAt ?? now,
        }
      }
      return { ...s, fossils }
    })
    persistPlayer()
  }

  function resetFossils(): void {
    playerSave.update(s => {
      if (!s) return s
      return { ...s, fossils: {} }
    })
    persistPlayer()
  }

  // ─── Section 4: Inventory ─────────────────────────────────────

  function giveMaxOxygen(): void {
    playerSave.update(s => {
      if (!s) return s
      return { ...s, oxygen: 8 * BALANCE.OXYGEN_PER_TANK }
    })
    persistPlayer()
  }

  function give8OxygenTanks(): void {
    playerSave.update(s => {
      if (!s) return s
      return { ...s, oxygen: 8 }
    })
    persistPlayer()
  }

  function fillBackpack(): void {
    // Fill backpack with random minerals and artifacts to test display
    const tiers: MineralTier[] = ['dust', 'shard', 'crystal', 'geode', 'essence']
    const rarities = ['common', 'uncommon', 'rare'] as const
    playerSave.update(s => {
      if (!s) return s
      const slots = Array.from({ length: BALANCE.STARTING_INVENTORY_SLOTS }, (_, i) => {
        if (i % 3 === 2) {
          return {
            type: 'artifact' as const,
            artifactRarity: rarities[i % rarities.length],
            factId: `dev-fact-${i}`,
          }
        }
        return {
          type: 'mineral' as const,
          mineralTier: tiers[i % tiers.length],
          mineralAmount: 5 + i * 2,
        }
      })
      return { ...s }
    })
    // Note: inventory is a run-time store, not persisted in playerSave directly.
    // This button gives minerals to simulate a "full pack" resource-wise.
    addMinerals('dust', 300)
    addMinerals('shard', 25)
    addMinerals('crystal', 8)
    addMinerals('geode', 2)
  }

  // ─── Section 5: Navigation ────────────────────────────────────

  const NAV_SCREENS: { label: string; screen: Screen }[] = [
    { label: 'Base', screen: 'base' },
    { label: 'Mine', screen: 'mining' },
    { label: 'Study', screen: 'studySession' },
    { label: 'Materializer', screen: 'materializer' },
    { label: 'Farm', screen: 'farm' },
    { label: 'Zoo', screen: 'zoo' },
    { label: 'Knowledge Tree', screen: 'knowledgeTree' },
    { label: 'Streak Panel', screen: 'streakPanel' },
    { label: 'Cosmetics', screen: 'cosmeticsShop' },
    { label: 'Prem. Workshop', screen: 'premiumMaterializer' },
  ]

  function goTo(screen: Screen): void {
    currentScreen.set(screen)
    open = false
  }

  // ─── Section 6: Danger Zone ───────────────────────────────────

  function resetSave(): void {
    if (confirm('Delete ALL save data and start fresh? This cannot be undone.')) {
      deleteSave()
      initPlayer('teen')
      persistPlayer()
      currentScreen.set('base')
      open = false
    }
  }

  function resetSaveAndReload(): void {
    if (confirm('Delete ALL save data and reload the page? This cannot be undone.')) {
      deleteSave()
      window.location.reload()
    }
  }

  // ─── Section 7: Debug Info ────────────────────────────────────

  /** Total facts in the facts DB (lazy, computed once panel opens). */
  function totalFactsInDB(): number {
    if (!factsDB.isReady()) return 0
    return factsDB.getAll().length
  }
</script>

<!-- DEV toggle button (always visible) -->
<button class="dev-toggle" type="button" onclick={toggle} title="Toggle Dev Panel" aria-label="Toggle Dev Panel">
  DEV
</button>

<!-- Backdrop -->
{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="dev-backdrop" onclick={toggle}></div>

  <!-- Panel -->
  <div class="dev-panel" role="complementary" aria-label="Developer Panel">
    <!-- Header -->
    <div class="dev-header">
      <span class="dev-title">Dev Panel</span>
      <button class="close-btn" type="button" onclick={toggle} aria-label="Close dev panel">✕</button>
    </div>

    <!-- ── Section 1: Resources ── -->
    <section class="dev-section">
      <button
        class="section-toggle"
        type="button"
        onclick={() => toggleSection('resources')}
        aria-expanded={sectionsOpen.resources}
      >
        <span class="chevron" class:open={sectionsOpen.resources}>▶</span>
        Resources
      </button>
      {#if sectionsOpen.resources}
        <div class="section-body">
          <div class="btn-grid">
            <button class="btn-give" type="button" onclick={giveDust}>+500 Dust</button>
            <button class="btn-give" type="button" onclick={giveShards}>+50 Shards</button>
            <button class="btn-give" type="button" onclick={giveCrystals}>+20 Crystals</button>
            <button class="btn-give" type="button" onclick={giveGeodes}>+5 Geodes</button>
            <button class="btn-give" type="button" onclick={giveEssence}>+2 Essence</button>
            <button class="btn-give" type="button" onclick={givePremiumMaterials}>+Prem Mats</button>
          </div>
          <button class="btn-give btn-wide" type="button" onclick={giveAllResources}>Give All Resources</button>
          <!-- Custom amount -->
          <div class="custom-row">
            <select bind:value={customTier} class="custom-select" aria-label="Mineral tier">
              <option value="dust">Dust</option>
              <option value="shard">Shard</option>
              <option value="crystal">Crystal</option>
              <option value="geode">Geode</option>
              <option value="essence">Essence</option>
            </select>
            <input
              type="number"
              bind:value={customAmount}
              min="1"
              max="99999"
              class="custom-input"
              aria-label="Custom amount"
            />
            <button class="btn-give" type="button" onclick={giveCustomAmount}>Give</button>
          </div>
        </div>
      {/if}
    </section>

    <!-- ── Section 2: Progression ── -->
    <section class="dev-section">
      <button
        class="section-toggle"
        type="button"
        onclick={() => toggleSection('progression')}
        aria-expanded={sectionsOpen.progression}
      >
        <span class="chevron" class:open={sectionsOpen.progression}>▶</span>
        Progression
      </button>
      {#if sectionsOpen.progression}
        <div class="section-body">
          <button class="btn-set btn-wide" type="button" onclick={unlockAllRooms}>Unlock All Rooms</button>
          <div class="btn-grid">
            <button class="btn-set" type="button" onclick={() => setDives(10)}>10 Dives Done</button>
            <button class="btn-set" type="button" onclick={() => setDives(50)}>50 Dives Done</button>
          </div>
          <div class="custom-row">
            <label class="custom-label" for="streak-input">Streak:</label>
            <input
              id="streak-input"
              type="number"
              bind:value={streakInput}
              min="0"
              max="9999"
              class="custom-input"
              aria-label="Streak value"
            />
            <button class="btn-set" type="button" onclick={setStreak}>Set</button>
          </div>
          <div class="btn-grid">
            <button class="btn-give" type="button" onclick={learn20Facts}>Learn 20 Facts</button>
            <button class="btn-give" type="button" onclick={maxKnowledgePoints}>Max KP (9999)</button>
          </div>
        </div>
      {/if}
    </section>

    <!-- ── Section 3: Fossils ── -->
    <section class="dev-section">
      <button
        class="section-toggle"
        type="button"
        onclick={() => toggleSection('fossils')}
        aria-expanded={sectionsOpen.fossils}
      >
        <span class="chevron" class:open={sectionsOpen.fossils}>▶</span>
        Fossils
      </button>
      {#if sectionsOpen.fossils}
        <div class="section-body">
          <button class="btn-give btn-wide" type="button" onclick={giveAllFossilFragments}>Give All Fragments</button>
          <button class="btn-give btn-wide" type="button" onclick={reviveAllFossils}>Revive All Fossils</button>
          <button class="btn-danger btn-wide" type="button" onclick={resetFossils}>Reset Fossils</button>
        </div>
      {/if}
    </section>

    <!-- ── Section 4: Inventory ── -->
    <section class="dev-section">
      <button
        class="section-toggle"
        type="button"
        onclick={() => toggleSection('inventory')}
        aria-expanded={sectionsOpen.inventory}
      >
        <span class="chevron" class:open={sectionsOpen.inventory}>▶</span>
        Inventory
      </button>
      {#if sectionsOpen.inventory}
        <div class="section-body">
          <div class="btn-grid">
            <button class="btn-give" type="button" onclick={give8OxygenTanks}>8 O2 Tanks</button>
            <button class="btn-give" type="button" onclick={fillBackpack}>Fill Backpack</button>
          </div>
        </div>
      {/if}
    </section>

    <!-- ── Section 5: Navigation ── -->
    <section class="dev-section">
      <button
        class="section-toggle"
        type="button"
        onclick={() => toggleSection('navigation')}
        aria-expanded={sectionsOpen.navigation}
      >
        <span class="chevron" class:open={sectionsOpen.navigation}>▶</span>
        Navigation
      </button>
      {#if sectionsOpen.navigation}
        <div class="section-body">
          <div class="btn-grid">
            {#each NAV_SCREENS as nav (nav.screen)}
              <button class="btn-nav" type="button" onclick={() => goTo(nav.screen)}>
                {nav.label}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <!-- ── Section 6: Danger Zone ── -->
    <section class="dev-section">
      <button
        class="section-toggle danger-header"
        type="button"
        onclick={() => toggleSection('danger')}
        aria-expanded={sectionsOpen.danger}
      >
        <span class="chevron" class:open={sectionsOpen.danger}>▶</span>
        Danger Zone
      </button>
      {#if sectionsOpen.danger}
        <div class="section-body">
          <button class="btn-danger btn-wide" type="button" onclick={resetSave}>Reset Save</button>
          <button class="btn-danger btn-wide" type="button" onclick={resetSaveAndReload}>Reset + Reload Page</button>
        </div>
      {/if}
    </section>

    <!-- ── Section 7: Debug Info ── -->
    <section class="dev-section">
      <button
        class="section-toggle"
        type="button"
        onclick={() => toggleSection('debug')}
        aria-expanded={sectionsOpen.debug}
      >
        <span class="chevron" class:open={sectionsOpen.debug}>▶</span>
        Debug Info
      </button>
      {#if sectionsOpen.debug}
        <div class="section-body debug-info">
          <div class="debug-row">
            <span class="debug-key">Screen:</span>
            <span class="debug-val">{$currentScreen}</span>
          </div>
          <div class="debug-row">
            <span class="debug-key">Facts in DB:</span>
            <span class="debug-val">{totalFactsInDB()}</span>
          </div>
          <div class="debug-row">
            <span class="debug-key">Save version:</span>
            <span class="debug-val">{$playerSave?.version ?? 'N/A'}</span>
          </div>
          <div class="debug-row">
            <span class="debug-key">O2 tanks:</span>
            <span class="debug-val">{$playerSave?.oxygen ?? 0}</span>
          </div>
          <div class="debug-row">
            <span class="debug-key">Dust:</span>
            <span class="debug-val">{$playerSave?.minerals.dust ?? 0}</span>
          </div>
          <div class="debug-row">
            <span class="debug-key">Facts learned:</span>
            <span class="debug-val">{$playerSave?.learnedFacts.length ?? 0}</span>
          </div>
          <div class="debug-row">
            <span class="debug-key">KP:</span>
            <span class="debug-val">{$playerSave?.knowledgePoints ?? 0}</span>
          </div>
          <div class="debug-row">
            <span class="debug-key">Rooms unlocked:</span>
            <span class="debug-val">{$playerSave?.unlockedRooms?.length ?? 0} / {BALANCE.DOME_ROOMS.length}</span>
          </div>
          <div class="debug-row">
            <span class="debug-key">Streak:</span>
            <span class="debug-val">{$playerSave?.stats.currentStreak ?? 0} days</span>
          </div>
          <div class="debug-row">
            <span class="debug-key">Total dives:</span>
            <span class="debug-val">{$playerSave?.stats.totalDivesCompleted ?? 0}</span>
          </div>
        </div>
      {/if}
    </section>
  </div>
{/if}

<style>
  /* ─── DEV toggle button ─────────────────────────────────── */
  .dev-toggle {
    position: fixed;
    top: 4px;
    right: 4px;
    z-index: 9999;
    pointer-events: auto;
    padding: 4px 8px;
    border: 1px solid #c040c0;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.75);
    color: #c040c0;
    font-family: 'Courier New', monospace;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 120ms ease;
    user-select: none;
  }

  .dev-toggle:hover {
    opacity: 1;
  }

  /* ─── Backdrop ──────────────────────────────────────────── */
  .dev-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9997;
    background: rgba(0, 0, 0, 0.4);
    pointer-events: auto;
    cursor: pointer;
  }

  /* ─── Panel ─────────────────────────────────────────────── */
  .dev-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 9998;
    pointer-events: auto;
    width: min(320px, 95vw);
    display: flex;
    flex-direction: column;
    background: #0f0f1e;
    border-left: 1px solid #3a1a5e;
    overflow-y: auto;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: #ccc;
  }

  /* ─── Header ────────────────────────────────────────────── */
  .dev-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px 8px;
    background: #1a1a2e;
    border-bottom: 1px solid #3a1a5e;
    flex-shrink: 0;
  }

  .dev-title {
    color: #c040c0;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .close-btn {
    background: none;
    border: 1px solid #444;
    border-radius: 4px;
    color: #aaa;
    cursor: pointer;
    padding: 2px 8px;
    font-family: inherit;
    font-size: 12px;
  }

  .close-btn:hover {
    border-color: #888;
    color: #fff;
  }

  /* ─── Sections ──────────────────────────────────────────── */
  .dev-section {
    border-bottom: 1px solid #1c1c30;
    flex-shrink: 0;
  }

  .section-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    background: none;
    border: none;
    color: #a0a0cc;
    font-family: inherit;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    cursor: pointer;
    text-align: left;
    transition: background 120ms ease;
  }

  .section-toggle:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .danger-header {
    color: #e94560 !important;
  }

  .chevron {
    font-size: 8px;
    display: inline-block;
    transition: transform 150ms ease;
    color: #666;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .section-body {
    padding: 6px 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* ─── Button grids ──────────────────────────────────────── */
  .btn-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  /* ─── Base button ───────────────────────────────────────── */
  .dev-panel button[class^="btn-"],
  .dev-panel button[class*=" btn-"] {
    padding: 5px 8px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: filter 120ms ease, background 120ms ease;
  }

  .dev-panel button[class^="btn-"]:hover,
  .dev-panel button[class*=" btn-"]:hover {
    filter: brightness(1.15);
  }

  .dev-panel button[class^="btn-"]:active,
  .dev-panel button[class*=" btn-"]:active {
    filter: brightness(0.9);
  }

  /* Green: give / add */
  .btn-give {
    border: 1px solid #2d6a4f;
    background: #1a3a28;
    color: #6fcf97;
  }

  /* Yellow: set value */
  .btn-set {
    border: 1px solid #7a6a20;
    background: #3a3010;
    color: #f2c94c;
  }

  /* Blue: navigation */
  .btn-nav {
    border: 1px solid #2d5a8e;
    background: #0e2a4a;
    color: #56b0f5;
  }

  /* Red: danger */
  .btn-danger {
    border: 1px solid #7a2030;
    background: #2a0c10;
    color: #e94560;
  }

  /* Full width helpers */
  .btn-wide {
    width: 100%;
  }

  /* ─── Custom row ────────────────────────────────────────── */
  .custom-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .custom-label {
    color: #888;
    font-size: 10px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .custom-select,
  .custom-input {
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 4px;
    color: #ccc;
    font-family: inherit;
    font-size: 10px;
    padding: 4px 6px;
    min-width: 0;
  }

  .custom-select {
    flex: 1.5;
  }

  .custom-input {
    flex: 1;
    width: 60px;
  }

  /* ─── Debug info ────────────────────────────────────────── */
  .debug-info {
    gap: 3px;
  }

  .debug-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 4px;
    padding: 2px 0;
    border-bottom: 1px solid #1a1a2a;
  }

  .debug-key {
    color: #666;
    font-size: 10px;
  }

  .debug-val {
    color: #a0c0ff;
    font-size: 10px;
    font-weight: 600;
    text-align: right;
    word-break: break-all;
  }
</style>
