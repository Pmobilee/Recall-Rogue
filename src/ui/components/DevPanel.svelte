<script lang="ts">
  import type Phaser from 'phaser'
  import { get } from 'svelte/store'
  import { BALANCE } from '../../data/balance'
  import { FOSSIL_SPECIES } from '../../data/fossils'
  import { deleteSave, save } from '../../services/saveService'
  import { SCENARIO_PRESETS, type ScenarioPreset } from '../../dev/presets'
  import { listSnapshots, storeSnapshot, deleteSnapshot, exportSnapshotBlob, parseSnapshotFile, type SaveSnapshot } from '../../dev/snapshotStore'
  import { factsDB } from '../../services/factsDB'
  import { getGM } from '../../game/gameManagerRef'
  import { currentScreen, tickCount, layerTickCount, o2DepthMultiplier, type Screen, addConsumableToDive, pendingArtifacts } from '../stores/gameState'
  import { savePendingArtifacts } from '../stores/playerData'
  import {
    addLearnedFact,
    addMinerals,
    initPlayer,
    persistPlayer,
    playerSave,
  } from '../stores/playerData'
  import type { FossilState } from '../../data/types'
  import { ALL_BIOMES, type BiomeId } from '../../data/biomes'
  import { queryGpuMemory } from '../../services/gpuMemoryService'

  // ─── panel open/close ───────────────────────────────────────
  let open = $state(false)

  // ─── biome selector ──────────────────────────────────────────
  let forcedBiomeId = $state<BiomeId | ''>('')

  function toggle(): void {
    open = !open
  }

  // ─── collapsible section state ───────────────────────────────
  let sectionsOpen = $state<Record<string, boolean>>({
    presets: false,
    snapshots: false,
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

  // ─── dev quiz every block toggle ─────────────────────────────
  let quizEveryBlock = $state<boolean>(false)

  // ─── Presets ─────────────────────────────────────────────────
  function loadPreset(preset: ScenarioPreset): void {
    const builtSave = preset.buildSave(Date.now())
    deleteSave()
    save(builtSave)
    playerSave.set(builtSave)
    currentScreen.set('base')
    open = false
  }

  // ─── Snapshots ──────────────────────────────────────────────
  let snapshots = $state<SaveSnapshot[]>([])
  let snapshotLabel = $state<string>('')
  let snapshotError = $state<string>('')
  let fileInputRef = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (open && sectionsOpen.snapshots) {
      snapshots = listSnapshots()
    }
  })

  function saveCurrentSnapshot(): void {
    const current = get(playerSave)
    if (!current) return
    const label = snapshotLabel.trim() || undefined
    storeSnapshot(current, label)
    snapshotLabel = ''
    snapshots = listSnapshots()
  }

  function exportSnapshot(snap: SaveSnapshot): void {
    const blob = exportSnapshotBlob(snap)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `terra-gacha-snapshot-${snap.snapshotId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function loadSnapshot(snap: SaveSnapshot): void {
    if (!confirm(`Load snapshot "${snap.label}"? Current save will be overwritten.`)) return
    save(snap.save)
    playerSave.set(snap.save)
    currentScreen.set('base')
    open = false
  }

  function removeSnapshot(snap: SaveSnapshot): void {
    deleteSnapshot(snap.snapshotId)
    snapshots = listSnapshots()
  }

  function importSnapshot(): void {
    fileInputRef?.click()
  }

  function handleFileImport(e: Event): void {
    snapshotError = ''
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      const parsed = parseSnapshotFile(text)
      if (!parsed) {
        snapshotError = 'Invalid snapshot file'
        return
      }
      save(parsed.save)
      playerSave.set(parsed.save)
      currentScreen.set('base')
      open = false
    }
    reader.readAsText(file)
    input.value = ''
  }

  function formatDate(ms: number): string {
    return new Date(ms).toISOString().replace('T', ' ').slice(0, 16)
  }

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
    const facts = getGM()?.getFacts() ?? []
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

  function giveOxygen(): void {
    playerSave.update(s => s ? { ...s, oxygen: (s.oxygen || 0) + 3 } : s)
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

  function addTestArtifacts(): void {
    const testFacts = factsDB.isReady() ? factsDB.getAll().slice(0, 5) : []
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const
    const newArtifacts = testFacts.map((f, i) => ({
      factId: f.id,
      rarity: rarities[i % rarities.length] as import('../../data/types').Rarity,
      minedAt: Date.now(),
    }))
    if (newArtifacts.length === 0) {
      // Fallback if DB not ready
      for (let i = 0; i < 5; i++) {
        newArtifacts.push({
          factId: `nsci-00${i + 1}`,
          rarity: rarities[i] as import('../../data/types').Rarity,
          minedAt: Date.now(),
        })
      }
    }
    pendingArtifacts.update(existing => [...existing, ...newArtifacts])
    savePendingArtifacts([...get(pendingArtifacts)])
    persistPlayer()
  }

  // ─── Section 5: Navigation ────────────────────────────────────

  function jumpToLayer(targetLayer1Indexed: number): void {
    // Ensure at least 1 O2 tank exists for the dive
    const save = get(playerSave)
    if (save && save.oxygen < 1) {
      playerSave.update(s => s ? { ...s, oxygen: 1 } : s)
      persistPlayer()
    }
    // Start MineScene at the target layer (0-indexed), optionally with a forced biome
    const g = getGM()?.getGame()
    if (g) {
      const biomeOverride = forcedBiomeId ? ALL_BIOMES.find(b => b.id === forcedBiomeId) : undefined
      g.scene.stop('MineScene')
      g.scene.start('MineScene', {
        seed: Date.now(),
        oxygenTanks: 3,
        inventorySlots: 6,
        facts: [],
        layer: targetLayer1Indexed - 1,
        inventory: [],
        blocksMinedThisRun: 0,
        artifactsFound: [],
        ...(biomeOverride ? { biome: biomeOverride } : {}),
      })
      currentScreen.set('mining')
    }
    open = false
  }

  function quickDive(): void {
    // Ensure at least 1 O2 tank exists
    const save = get(playerSave)
    if (save && save.oxygen < 1) {
      playerSave.update(s => s ? { ...s, oxygen: 1 } : s)
      persistPlayer()
    }
    getGM()?.startDive(1)
  }

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

  // ─── Performance Stats (Phase 28) ─────────────────────────────

  interface PerfStats {
    fps: number
    drawCalls: number
    sprites: number
    gpuMB: number
    heapMB: number
    dirtyTiles: number
    saveSizeKB: number
  }
  let perfStats = $state<PerfStats>({ fps: 0, drawCalls: 0, sprites: 0, gpuMB: 0, heapMB: 0, dirtyTiles: 0, saveSizeKB: 0 })
  let perfInterval: ReturnType<typeof setInterval> | null = null

  function startPerfPolling(): void {
    if (perfInterval) return
    perfInterval = setInterval(() => {
      const gm = getGM()
      const game = (gm as unknown as { game?: Phaser.Game })?.game
      if (!game) return
      const renderer = game.renderer as (Phaser.Renderer.WebGL.WebGLRenderer & { drawCount?: number }) | undefined
      const fps = Math.round(game.loop.actualFps)
      const drawCalls = (renderer as unknown as { drawCount?: number })?.drawCount ?? 0
      let sprites = 0
      game.scene.scenes.forEach((s) => { sprites += s.children?.length ?? 0 })
      const gpu = queryGpuMemory()
      const gpuMB = gpu.textureBytes / 1024 / 1024
      const perfMem = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory
      const heapMB = (perfMem?.usedJSHeapSize ?? 0) / 1024 / 1024
      // Dirty tile count: read from MineScene if accessible
      const mineScene = game.scene.getScene('MineScene') as unknown as { dirtyTracker?: { pendingCount: number } } | null
      const dirtyTiles = mineScene?.dirtyTracker?.pendingCount ?? 0
      // Save size from localStorage
      const raw = localStorage.getItem('terra-gacha-save') ?? ''
      const saveSizeKB = Math.round(raw.length / 1024)
      perfStats = { fps, drawCalls, sprites, gpuMB, heapMB, dirtyTiles, saveSizeKB }
    }, 500)
  }

  function stopPerfPolling(): void {
    if (perfInterval) { clearInterval(perfInterval); perfInterval = null }
  }

  $effect(() => {
    if (open && sectionsOpen.debug) startPerfPolling()
    else stopPerfPolling()
  })
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

    <!-- ── Section: Presets ── -->
    <section class="dev-section">
      <button
        class="section-toggle"
        type="button"
        onclick={() => toggleSection('presets')}
        aria-expanded={sectionsOpen.presets}
      >
        <span class="chevron" class:open={sectionsOpen.presets}>▶</span>
        Presets
      </button>
      {#if sectionsOpen.presets}
        <div class="section-body">
          {#each SCENARIO_PRESETS as preset (preset.id)}
            <button
              class="btn-preset btn-wide"
              type="button"
              title={preset.description}
              onclick={() => loadPreset(preset)}
            >
              {preset.label}
            </button>
          {/each}
        </div>
      {/if}
    </section>

    <!-- ── Section: Snapshots ── -->
    <section class="dev-section">
      <button
        class="section-toggle"
        type="button"
        onclick={() => toggleSection('snapshots')}
        aria-expanded={sectionsOpen.snapshots}
      >
        <span class="chevron" class:open={sectionsOpen.snapshots}>▶</span>
        Snapshots
      </button>
      {#if sectionsOpen.snapshots}
        <div class="section-body">
          <div class="custom-row">
            <input
              type="text"
              bind:value={snapshotLabel}
              placeholder="Snapshot label"
              class="custom-input"
              style="flex:3"
              aria-label="Snapshot label"
            />
            <button class="btn-give" type="button" onclick={saveCurrentSnapshot}>Save Snapshot</button>
          </div>
          <div class="custom-row">
            <button class="btn-nav btn-wide" type="button" onclick={importSnapshot}>Import JSON</button>
            <input
              type="file"
              accept=".json"
              bind:this={fileInputRef}
              style="display:none"
              onchange={handleFileImport}
            />
          </div>
          {#if snapshotError}
            <div class="snapshot-error">{snapshotError}</div>
          {/if}
          {#if snapshots.length > 0}
            <div class="snapshot-list">
              {#each snapshots as snap (snap.snapshotId)}
                <div class="snapshot-row">
                  <div class="snapshot-info">
                    <span class="snapshot-label">{snap.label}</span>
                    <span class="snapshot-meta">v{snap.gameVersion} · {formatDate(snap.createdAt)}</span>
                  </div>
                  <div class="snapshot-actions">
                    <button class="btn-snap" type="button" title="Load" onclick={() => loadSnapshot(snap)}>↩</button>
                    <button class="btn-snap" type="button" title="Export" onclick={() => exportSnapshot(snap)}>↓</button>
                    <button class="btn-snap btn-snap-del" type="button" title="Delete" onclick={() => removeSnapshot(snap)}>✕</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </section>

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
          <button class="btn-give btn-wide" type="button" onclick={giveOxygen}>+3 O2 Tanks</button>
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
          <!-- Force Quiz (Phase 8.8) -->
          <button class="btn-give btn-wide" data-testid="dev-force-quiz" type="button" onclick={() => { getGM()?.forceQuiz?.() }}>Force Quiz</button>
          <!-- Quiz Every Block toggle -->
          <button
            class="btn-give btn-wide"
            class:btn-active={quizEveryBlock}
            data-testid="dev-quiz-every-block"
            type="button"
            onclick={() => {
              quizEveryBlock = !quizEveryBlock
              const qm = getGM()?.getQuizManager?.()
              if (qm) qm.devForceQuizEveryBlock = quizEveryBlock
            }}
          >Quiz Every Block: {quizEveryBlock ? 'ON' : 'OFF'}</button>
          <!-- Consumables (Phase 8.6) -->
          <div style="margin-top:6px">
            <span style="font-size:0.72rem;opacity:0.65">Consumables (dive only):</span>
            <div class="btn-grid" style="margin-top:4px">
              <button class="btn-give" data-testid="dev-add-consumable-bomb" type="button" onclick={() => { addConsumableToDive('bomb') }}>+Bomb</button>
              <button class="btn-give" data-testid="dev-add-consumable-flare" type="button" onclick={() => { addConsumableToDive('flare') }}>+Flare</button>
              <button class="btn-give" data-testid="dev-add-consumable-shield" type="button" onclick={() => { addConsumableToDive('shield_charge') }}>+Shield</button>
              <button class="btn-give" data-testid="dev-add-consumable-drill" type="button" onclick={() => { addConsumableToDive('drill_charge') }}>+Drill</button>
              <button class="btn-give" data-testid="dev-add-consumable-sonar" type="button" onclick={() => { addConsumableToDive('sonar_pulse') }}>+Sonar</button>
            </div>
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
            <button class="btn-give" type="button" onclick={addTestArtifacts}>+5 Artifacts</button>
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
          <button class="btn-nav btn-wide" type="button" onclick={quickDive}>Quick Dive (with O2)</button>
          <div>
            <label style="font-size:11px;color:#aaa;">Jump to Layer:
              <input
                type="number"
                min="1"
                max="20"
                value="5"
                data-testid="dev-set-layer"
                style="width:50px;margin-left:6px;"
                onchange={(e) => {
                  const val = parseInt((e.currentTarget as HTMLInputElement).value)
                  if (val >= 1 && val <= 20) jumpToLayer(val)
                }}
              />
            </label>
          </div>
          <div>
            <label style="font-size:11px;color:#aaa;">Force Biome:
              <select
                bind:value={forcedBiomeId}
                class="custom-select"
                style="margin-left:6px;max-width:160px;"
                aria-label="Force biome override"
              >
                <option value="">(random / tier)</option>
                {#each ALL_BIOMES as b (b.id)}
                  <option value={b.id}>[{b.tier}] {b.label}</option>
                {/each}
              </select>
            </label>
          </div>
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
          <div class="debug-row" data-testid="debug-tick-count">
            <span class="debug-key">Ticks:</span>
            <span class="debug-val">{$tickCount} (Layer: {$layerTickCount})</span>
          </div>
          <div class="debug-row">
            <span class="debug-key">O2 Mult:</span>
            <span class="debug-val">x{$o2DepthMultiplier.toFixed(2)}</span>
          </div>
          <div class="debug-row">
            <span class="debug-key">Zero-dive %:</span>
            <span class="debug-val">{$playerSave?.stats.totalSessions ? Math.round(($playerSave.stats.zeroDiveSessions / $playerSave.stats.totalSessions) * 100) : 0}%</span>
          </div>
          <!-- Performance Stats Overlay (Phase 28) -->
          <div class="perf-overlay">
            <div class="perf-row" class:warn={perfStats.fps < 30} class:ok={perfStats.fps >= 55}>
              FPS: {perfStats.fps} {perfStats.fps >= 55 ? '✓' : perfStats.fps >= 30 ? '⚠' : '✗'}
            </div>
            <div class="perf-row" class:warn={perfStats.drawCalls > 50}>
              Draw calls: {perfStats.drawCalls}{perfStats.drawCalls > 50 ? ' ⚠ DD-V2-186' : ''}
            </div>
            <div class="perf-row" class:warn={perfStats.sprites > 300}>
              Sprites: {perfStats.sprites}
            </div>
            <div class="perf-row" class:warn={perfStats.gpuMB > 60}>
              GPU tex: {perfStats.gpuMB.toFixed(1)} MB{perfStats.gpuMB > 80 ? ' ✗ OVER BUDGET' : perfStats.gpuMB > 60 ? ' ⚠' : ''}
            </div>
            <div class="perf-row" class:warn={perfStats.heapMB > 100}>
              JS heap: {perfStats.heapMB.toFixed(1)} MB
            </div>
            <div class="perf-row">Dirty tiles: {perfStats.dirtyTiles}</div>
            <div class="perf-row" class:warn={perfStats.saveSizeKB > 200}>
              Save: {perfStats.saveSizeKB} KB{perfStats.saveSizeKB > 200 ? ' ⚠ large' : ''}
            </div>
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

  /* Active/toggled state (e.g. Quiz Every Block ON) */
  .btn-active {
    background: #4ecca3 !important;
    color: #0a0a1a !important;
    border-color: #4ecca3 !important;
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

  /* Purple: preset */
  .btn-preset {
    border: 1px solid #4a1a7e;
    background: #1e0a3a;
    color: #c090ff;
    text-align: left;
    font-size: 9px;
  }

  /* Snapshot section */
  .snapshot-error {
    color: #e94560;
    font-size: 9px;
    padding: 4px 0;
  }

  .snapshot-list {
    max-height: 240px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .snapshot-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 6px;
    background: #1a1a2e;
    border-radius: 4px;
    border: 1px solid #2a2a40;
  }

  .snapshot-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }

  .snapshot-label {
    color: #c090ff;
    font-size: 9px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .snapshot-meta {
    color: #666;
    font-size: 8px;
  }

  .snapshot-actions {
    display: flex;
    gap: 3px;
    flex-shrink: 0;
  }

  .btn-snap {
    padding: 2px 6px;
    border: 1px solid #333;
    border-radius: 3px;
    background: #1a1a2e;
    color: #888;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
  }

  .btn-snap:hover {
    background: #2a2a4e;
    color: #ccc;
  }

  .btn-snap-del:hover {
    background: #3a1020;
    color: #e94560;
    border-color: #7a2030;
  }

  /* ─── Performance overlay (Phase 28) ────────────────────── */
  .perf-overlay {
    background: rgba(0, 0, 0, 0.7);
    color: #eee;
    padding: 6px 8px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.6;
    margin-top: 8px;
  }

  .perf-row { color: #ccc; }
  .perf-row.warn { color: #ffaa00; }
  .perf-row.ok   { color: #44ff88; }
</style>
